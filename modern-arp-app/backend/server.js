const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path'); // Import path module

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 5000; // Default to 5000 if not specified in .env

// CORS configuration
// For development, allow requests from the Vite frontend (default http://localhost:5173)
// In production, you should restrict this to your frontend's actual domain.
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));

app.use(express.json()); // Middleware to parse JSON bodies

// Placeholder for Nominatim User-Agent
const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT || "ModernARPApp/1.0 (your-email@example.com)";

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

// a. Weather Data Endpoint (/api/weather)
app.get('/api/weather', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lon,
        hourly: 'precipitation,pm25' // Corrected: was 'temperature_2m,precipitation,pm25'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching weather data:", error.response ? error.response.data : error.message);
    res.status(error.response ? error.response.status : 500).json({ error: 'Failed to fetch weather data' });
  }
});

// --- Main Routing Endpoint ---
const { fetchOSRMRoutes, calculateRouteScores, getReroute } = require('./routingService'); // Added getReroute

app.get('/api/route', async (req, res) => {
  const { startLat, startLng, endLat, endLng, preference } = req.query;

  if (!startLat || !startLng || !endLat || !endLng || !preference) {
    return res.status(400).json({
      error: 'Missing required parameters: startLat, startLng, endLat, endLng, preference',
    });
  }

  try {
    const routes = await fetchOSRMRoutes(startLng, startLat, endLng, endLat);

    if (!routes || routes.length === 0) {
      return res.status(404).json({ error: 'No routes found between the specified points.' });
    }

    // Log the raw routes from OSRM for debugging
    // console.log(`Raw OSRM routes: ${JSON.stringify(routes, null, 2)}`);

    const scoredRoutes = await calculateRouteScores(routes, preference);

    if (!scoredRoutes || scoredRoutes.length === 0) {
      // This case should ideally not happen if OSRM returned routes,
      // but as a fallback if scoring somehow fails or filters all out.
      return res.status(500).json({ error: 'Failed to score routes.' });
    }

    // Sort routes by score in descending order (higher score is better)
    scoredRoutes.sort((a, b) => b.score - a.score);
    
    // Log scored and sorted routes
    // console.log(`Scored and sorted routes: ${JSON.stringify(scoredRoutes.map(r => ({id: r.weight_name, score: r.score, preference: r.preference, duration: r.duration, distance: r.distance})), null, 2)}`);

    // Return the best route (or all scored routes if you want to give options to the frontend)
    // For now, returning the single best route's GeoJSON (from its .geometry property) and its score.
    const bestRoute = scoredRoutes[0];
    
    // OSRM geometry is already a GeoJSON LineString object.
    // We add the score and preference to the properties of the GeoJSON Feature for context.
    const responseGeoJson = {
      type: "Feature",
      geometry: bestRoute.geometry, // This is the GeoJSON LineString
      properties: {
        score: bestRoute.score,
        preference: bestRoute.preference,
        duration: bestRoute.duration, // OSRM original duration
        distance: bestRoute.distance, // OSRM original distance
        // You can add other OSRM route properties if needed by the frontend
        // e.g., steps: bestRoute.legs[0].steps.map(step => step.maneuver.instruction)
      }
    };
    
    // If you want to return multiple routes, you can map over scoredRoutes
    // and create a FeatureCollection. For this subtask, one is enough.
    // Example for multiple:
    // const features = scoredRoutes.map(route => ({
    //   type: "Feature",
    //   geometry: route.geometry,
    //   properties: { score: route.score, preference: route.preference, duration: route.duration, distance: route.distance }
    // }));
    // res.json({ type: "FeatureCollection", features: features });

    res.json(responseGeoJson);

  } catch (error) {
    console.error('Error in /api/route endpoint:', error.message);
    if (error.message.includes('Failed to fetch routes from OSRM')) {
        return res.status(503).json({ error: 'Could not fetch routes from routing provider.' });
    }
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});

// b. Crime Data Endpoint (/api/crime)
app.get('/api/crime', async (req, res) => {
  try {
    const { lat, lng, date } = req.query; // lng is used by police API, lon is more common
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude (lng) are required' });
    }
    // Date parameter is YYYY-MM. If not provided, police API might default to latest available.
    // For simplicity, we'll pass it if available, or let the API decide.
    const params = {
      lat: lat,
      lng: lng,
    };
    if (date) {
      params.date = date;
    }

    const response = await axios.get('https://data.police.uk/api/crimes-street/all-crime', { params });
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching crime data:", error.response ? error.response.data : error.message);
    res.status(error.response ? error.response.status : 500).json({ error: 'Failed to fetch crime data' });
  }
});

// c. Geocoding Endpoint (/api/geocode)
app.get('/api/geocode', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: address,
        format: 'json',
        limit: 5,
        // countrycodes: 'gb' // Example: Add if you want to limit to a specific country
      },
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching geocoding data:", error.response ? error.response.data : error.message);
    res.status(error.response ? error.response.status : 500).json({ error: 'Failed to fetch geocoding data' });
  }
});

// d. Reverse Geocoding Endpoint (/api/reverse-geocode)
app.get('/api/reverse-geocode', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat: lat,
        lon: lon,
        format: 'jsonv2'
      },
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching reverse geocoding data:", error.response ? error.response.data : error.message);
    res.status(error.response ? error.response.status : 500).json({ error: 'Failed to fetch reverse geocoding data' });
  }
});

// e. Country Code Endpoint (/api/country-code)
// Note: This API determines location from the request's IP.
// When called from the backend, this will be the backend server's IP.
app.get('/api/country-code', async (req, res) => {
  try {
    // Optional: Allow passing an IP address for testing or specific use cases
    // const clientIp = req.query.ip || req.ip; // req.ip might need trust proxy settings
    // const apiUrl = `https://ip-api.com/json/${clientIp ? clientIp : ''}`;
    const apiUrl = `https://ip-api.com/json/`; // For server's IP

    const response = await axios.get(apiUrl);
    if (response.data.status === 'fail') {
        console.error("Error from ip-api.com:", response.data.message);
        return res.status(500).json({ error: 'Failed to fetch country code', details: response.data.message });
    }
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching country code:", error.response ? error.response.data : error.message);
    res.status(error.response ? error.response.status : 500).json({ error: 'Failed to fetch country code' });
  }
});

// --- Reroute Endpoint ---
app.get('/api/reroute', async (req, res) => {
  const { currentLat, currentLng, endLat, endLng, preference } = req.query;

  if (!currentLat || !currentLng || !endLat || !endLng || !preference) {
    return res.status(400).json({
      error: 'Missing required parameters: currentLat, currentLng, endLat, endLng, preference',
    });
  }

  // Validate coordinates and preference if necessary (e.g., are they numbers, is preference valid)
  // For now, assume basic presence is checked.

  try {
    const newRoute = await getReroute(
      parseFloat(currentLat),
      parseFloat(currentLng),
      parseFloat(endLat),
      parseFloat(endLng),
      preference
    );

    // getReroute already formats the response like /api/route
    // (a GeoJSON Feature with properties)
    if (newRoute) {
      res.json(newRoute);
    } else {
      // This case should ideally be handled by errors thrown in getReroute
      res.status(404).json({ error: 'No suitable reroute found.' });
    }
  } catch (error) {
    console.error('Error in /api/reroute endpoint:', error.message);
    if (error.message.includes('No routes found for rerouting') || error.message.includes('Failed to score reroutes')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('Failed to fetch routes from OSRM')) {
        return res.status(503).json({ error: 'Could not fetch routes from routing provider for rerouting.' });
    }
    res.status(500).json({ error: 'An error occurred while processing your reroute request.' });
  }
});


const serverInstance = app.listen(port, () => {
  console.log(`Backend server is running on http://localhost:${port}`);
});

module.exports = app; // Export app for testing
// module.exports = { app, serverInstance }; // Alternative if serverInstance is needed

// Serve static assets from the React frontend
// Assuming frontend assets will be copied to backend/public/frontend
app.use(express.static(path.join(__dirname, 'public', 'frontend')));

// API routes should be defined before the catch-all route

// The "catchall" handler: for any request that doesn't match one above,
// send back React's index.html file.
app.get('*', (req, res) => {
  // Do not serve index.html for API routes, check if it's an API path
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'frontend', 'index.html'));
});
