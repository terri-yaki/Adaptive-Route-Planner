// This module will encapsulate functions related to fetching routes from OSRM and scoring them.
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const OSRM_SERVER_URL = process.env.OSRM_SERVER_URL || 'http://router.project-osrm.org';
const BACKEND_PORT = process.env.PORT || 5000;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// Function to fetch routes from OSRM
async function fetchOSRMRoutes(startLng, startLat, endLng, endLat) {
  const coordinates = `${startLng},${startLat};${endLng},${endLat}`;
  const url = `${OSRM_SERVER_URL}/route/v1/driving/${coordinates}`;
  try {
    const response = await axios.get(url, {
      params: {
        alternatives: true,
        overview: 'full',
        geometries: 'geojson',
        steps: true,
      },
    });
    if (response.data && response.data.routes) {
      return response.data.routes; // Array of route objects
    } else {
      console.error('No routes found or unexpected OSRM API response:', response.data);
      return [];
    }
  } catch (error) {
    console.error('Error fetching OSRM routes:', error.response ? error.response.data : error.message);
    throw new Error('Failed to fetch routes from OSRM');
  }
}

// --- Helper functions to fetch preference data from backend's own APIs ---

// Helper to get the backend URL
function getBackendBaseUrl() {
  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
}

async function getWeatherDataForPoint(lat, lon) {
  const backendUrl = getBackendBaseUrl();
  try {
    const response = await axios.get(`${backendUrl}/api/weather`, {
      params: { lat, lon },
    });
    return response.data; // { hourly: { precipitation: [...], pm25: [...] } }
  } catch (error) {
    console.error(`Error fetching weather data for ${lat},${lon}:`, error.response ? error.response.data : error.message);
    return null; // Return null or a default error structure
  }
}

async function getCrimeDataForPoint(lat, lon) {
  const backendUrl = getBackendBaseUrl();
  // For simplicity, use the current month in YYYY-MM format
  // The police API can be slow, so limiting data is good.
  // A more robust solution might involve allowing date ranges or specific dates.
  const date = new Date().toISOString().slice(0, 7); // YYYY-MM
  try {
    const response = await axios.get(`${backendUrl}/api/crime`, {
      params: { lat, lng: lon, date }, // police.uk API uses 'lng'
    });
    return response.data; // Array of crime objects
  } catch (error) {
    // The police API often returns 404 if no crimes are found or if the location is outside their jurisdiction.
    // It can also return 503 for various reasons.
    if (error.response && (error.response.status === 404 || error.response.status === 503)) {
      console.warn(`Crime data for ${lat},${lon} (date: ${date}) not available or API error: ${error.response.status}`);
      return []; // Return empty array for no crimes or if API is unavailable
    }
    console.error(`Error fetching crime data for ${lat},${lon}:`, error.response ? error.response.data : error.message);
    return null; // Indicate a more significant error
  }
}

// --- Route Scoring Logic ---

// Helper to sample points along a route's geometry
// OSRM route geometry is an array of [lng, lat] pairs
function samplePointsAlongRoute(routeGeometry, numPoints = 10) {
  if (!routeGeometry || !routeGeometry.coordinates || routeGeometry.coordinates.length === 0) {
    return [];
  }
  const points = [];
  const totalCoordinates = routeGeometry.coordinates.length;
  // Ensure at least start and end points are included if numPoints is low
  if (numPoints <= 1 && totalCoordinates > 0) {
      return [routeGeometry.coordinates[0]]; // Return only the start point as [lng, lat]
  }
  if (numPoints === 2 && totalCoordinates > 1) {
      return [routeGeometry.coordinates[0], routeGeometry.coordinates[totalCoordinates -1]];
  }


  const step = Math.max(1, Math.floor(totalCoordinates / (numPoints -1))); // Ensure step is at least 1

  for (let i = 0; i < totalCoordinates; i += step) {
    points.push(routeGeometry.coordinates[i]); // [lng, lat]
    if (points.length >= numPoints) break;
  }
  // Ensure the last point is always included if it wasn't captured by the step
  if (points.length < numPoints && totalCoordinates > 0 && (points.length === 0 || points[points.length-1] !== routeGeometry.coordinates[totalCoordinates-1])) {
      if (points.length > 0 && points[points.length-1][0] === routeGeometry.coordinates[totalCoordinates-1][0] && points[points.length-1][1] === routeGeometry.coordinates[totalCoordinates-1][1]) {
        // Already have the last point
      } else {
        points.push(routeGeometry.coordinates[totalCoordinates - 1]);
      }
  }
  return points.slice(0, numPoints); // Ensure we don't exceed numPoints
}


async function calculateRouteScores(routes, preference) {
  if (!routes || routes.length === 0) {
    return [];
  }

  const scoredRoutes = [];

  for (const route of routes) {
    let score = 1000; // Base score, higher is better
    const routeId = `${route.weight_name || 'route'}_${Math.random().toString(36).substr(2, 5)}`; // Unique enough for logging
    console.log(`Scoring route ${routeId} (Duration: ${route.duration}s, Distance: ${route.distance}m) for preference: ${preference}`);

    // Extract geometry (OSRM provides it as route.geometry which is GeoJSON LineString)
    const routeGeometry = route.geometry; // This is already a GeoJSON LineString object { type: "LineString", coordinates: [[lng, lat], ...] }

    if (!routeGeometry || !routeGeometry.coordinates || routeGeometry.coordinates.length < 2) {
        console.warn(`Route ${routeId} has insufficient geometry data. Skipping detailed scoring.`);
        scoredRoutes.push({ ...route, score: 0, preference }); // Assign a low score
        continue;
    }
    
    const sampledPoints = samplePointsAlongRoute(routeGeometry, 10); // Sample 10 points [lng, lat]

    switch (preference) {
      case 'fastest':
        // OSRM routes are inherently optimized for speed.
        // Score inversely proportional to duration. Add small factor for distance.
        score = 100000 / (route.duration + route.distance / 10); // Higher score for shorter duration/distance
        break;

      case 'safest':
        let totalCrimeIncidents = 0;
        let crimeDataPoints = 0;
        for (const point of sampledPoints) {
          const crimeData = await getCrimeDataForPoint(point[1], point[0]); // lat, lng
          if (crimeData && Array.isArray(crimeData)) {
            totalCrimeIncidents += crimeData.length;
            crimeDataPoints++;
          }
        }
        // Average crime incidents per sampled point. Fewer incidents = higher score.
        // Penalize heavily for crime. If no data points, assume neutral.
        if (crimeDataPoints > 0) {
            const averageCrime = totalCrimeIncidents / crimeDataPoints;
            score -= averageCrime * 50; // Adjust multiplier as needed
            console.log(`Route ${routeId} - Safest: Avg crime incidents: ${averageCrime.toFixed(2)} over ${crimeDataPoints} points.`);
        } else {
            console.log(`Route ${routeId} - Safest: No crime data points found for scoring.`);
        }
        // Add bonus for shorter routes as well, assuming less exposure
        score -= route.duration / 100; 
        break;

      case 'less_rainy':
        let totalPrecipitation = 0;
        let weatherDataPointsRain = 0;
        for (const point of sampledPoints) {
          const weatherData = await getWeatherDataForPoint(point[1], point[0]); // lat, lng
          // Assuming weatherData.hourly.precipitation is an array of next N hours
          if (weatherData && weatherData.hourly && weatherData.hourly.precipitation) {
            // Let's take an average of the first few hours of precipitation forecast
            const relevantPrecipitation = weatherData.hourly.precipitation.slice(0, Math.min(6, weatherData.hourly.precipitation.length));
            const avgPrecipitation = relevantPrecipitation.reduce((sum, p) => sum + p, 0) / relevantPrecipitation.length || 0;
            totalPrecipitation += avgPrecipitation;
            weatherDataPointsRain++;
          }
        }
        if (weatherDataPointsRain > 0) {
            const averagePrecipitation = totalPrecipitation / weatherDataPointsRain;
            score -= averagePrecipitation * 100; // Higher precipitation = lower score. Adjust multiplier.
            console.log(`Route ${routeId} - Less Rainy: Avg precipitation: ${averagePrecipitation.toFixed(2)}mm over ${weatherDataPointsRain} points.`);
        } else {
            console.log(`Route ${routeId} - Less Rainy: No weather data points found for scoring precipitation.`);
        }
        score -= route.duration / 100;
        break;

      case 'less_polluted':
        let totalPm25 = 0;
        let weatherDataPointsPm25 = 0;
        for (const point of sampledPoints) {
          const weatherData = await getWeatherDataForPoint(point[1], point[0]); // lat, lng
          // Assuming weatherData.hourly.pm25 is an array of next N hours
          if (weatherData && weatherData.hourly && weatherData.hourly.pm25) {
            const relevantPm25 = weatherData.hourly.pm25.slice(0, Math.min(6, weatherData.hourly.pm25.length));
            const avgPm25 = relevantPm25.reduce((sum, p) => sum + p, 0) / relevantPm25.length || 0;
            totalPm25 += avgPm25;
            weatherDataPointsPm25++;
          }
        }
         if (weatherDataPointsPm25 > 0) {
            const averagePm25 = totalPm25 / weatherDataPointsPm25;
            score -= averagePm25 * 10; // Higher PM2.5 = lower score. Adjust multiplier.
            console.log(`Route ${routeId} - Less Polluted: Avg PM2.5: ${averagePm25.toFixed(2)} µg/m³ over ${weatherDataPointsPm25} points.`);
        } else {
            console.log(`Route ${routeId} - Less Polluted: No weather data points found for scoring PM2.5.`);
        }
        score -= route.duration / 100;
        break;
      
      case 'less_traffic':
        // Simple: penalize longer routes as a proxy for traffic exposure or complexity
        // OSRM by default gives "fastest" which already considers typical traffic conditions based on its model.
        // This preference is a bit abstract without real-time traffic data.
        // We can make it strongly prefer shorter routes or less complex routes (fewer turns).
        score -= route.distance / 100; // Penalize distance
        score -= route.duration / 50; // Also penalize duration
        // console.log(`Route ${routeId} - Less Traffic: Score penalized by distance (${route.distance}m) and duration (${route.duration}s).`);
        break;

      default:
        console.warn(`Unknown preference: ${preference}. Scoring as 'fastest'.`);
        score = 100000 / (route.duration + route.distance / 10);
    }
    
    // Ensure score is not negative, can happen if penalties are high
    route.score = Math.max(0, parseFloat(score.toFixed(2)));
    route.preference = preference;
    scoredRoutes.push(route);
    console.log(`Route ${routeId} final score: ${route.score}`);
  }

  return scoredRoutes;
}

module.exports = {
  fetchOSRMRoutes,
  getWeatherDataForPoint,
  getCrimeDataForPoint,
  calculateRouteScores,
  samplePointsAlongRoute, // Exporting for potential testing or direct use if needed
};

// --- Reroute Function ---
async function getReroute(currentLat, currentLng, endLat, endLng, preference) {
  console.log(`Rerouting requested from [${currentLng}, ${currentLat}] to [${endLng}, ${endLat}] with preference: ${preference}`);
  try {
    const routes = await fetchOSRMRoutes(currentLng, currentLat, endLng, endLat);

    if (!routes || routes.length === 0) {
      console.warn(`No routes found for rerouting from [${currentLng}, ${currentLat}] to [${endLng}, ${endLat}].`);
      throw new Error('No routes found for rerouting.');
    }

    const scoredRoutes = await calculateRouteScores(routes, preference);

    if (!scoredRoutes || scoredRoutes.length === 0) {
      console.warn(`Failed to score routes for rerouting from [${currentLng}, ${currentLat}] to [${endLng}, ${endLat}].`);
      throw new Error('Failed to score reroutes.');
    }

    // Sort routes by score in descending order (higher score is better)
    scoredRoutes.sort((a, b) => b.score - a.score);
    
    const bestRoute = scoredRoutes[0];
    console.log(`Best reroute found: Score ${bestRoute.score}, Duration ${bestRoute.duration}s, Distance ${bestRoute.distance}m`);

    // Return in the same format as /api/route
    return {
      type: "Feature",
      geometry: bestRoute.geometry,
      properties: {
        score: bestRoute.score,
        preference: bestRoute.preference,
        duration: bestRoute.duration,
        distance: bestRoute.distance,
      }
    };

  } catch (error) {
    console.error('Error in getReroute:', error.message);
    // Propagate the error to be handled by the endpoint
    throw error; 
  }
}

module.exports = {
  fetchOSRMRoutes,
  getWeatherDataForPoint,
  getCrimeDataForPoint,
  calculateRouteScores,
  samplePointsAlongRoute,
  getReroute, // Export the new function
};
