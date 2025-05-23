import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';

// Assume backend is running on port 5000
const BACKEND_URL = 'http://localhost:5000';

const RoutePlanner = ({ onRouteFetched }) => {
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [preference, setPreference] = useState('fastest'); // Default preference
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const preferences = [
    { value: 'fastest', label: 'Fastest' },
    { value: 'safest', label: 'Safest' },
    { value: 'less_rainy', label: 'Less Rainy' },
    { value: 'less_polluted', label: 'Less Polluted' },
    { value: 'less_traffic', label: 'Less Traffic' },
  ];

  const handleGetRoute = async () => {
    if (!startLocation || !endLocation) {
      setError('Please enter both start and end locations.');
      return;
    }
    setLoading(true);
    setError('');
    onRouteFetched(null); // Clear previous route

    try {
      // 1. Geocode Start Location
      const startGeoResponse = await axios.get(`${BACKEND_URL}/api/geocode`, {
        params: { address: startLocation },
      });
      if (!startGeoResponse.data || startGeoResponse.data.length === 0) {
        throw new Error(`Could not geocode start location: ${startLocation}`);
      }
      const startCoords = {
        lat: startGeoResponse.data[0].lat,
        lon: startGeoResponse.data[0].lon, // Nominatim uses 'lon'
      };

      // 2. Geocode End Location
      const endGeoResponse = await axios.get(`${BACKEND_URL}/api/geocode`, {
        params: { address: endLocation },
      });
      if (!endGeoResponse.data || endGeoResponse.data.length === 0) {
        throw new Error(`Could not geocode end location: ${endLocation}`);
      }
      const endCoords = {
        lat: endGeoResponse.data[0].lat,
        lon: endGeoResponse.data[0].lon, // Nominatim uses 'lon'
      };
      
      // 3. Fetch Route
      const routeResponse = await axios.get(`${BACKEND_URL}/api/route`, {
        params: {
          startLat: startCoords.lat,
          startLng: startCoords.lon, // OSRM and our backend expect startLng/endLng
          endLat: endCoords.lat,
          endLng: endCoords.lon,
          preference: preference,
        },
      });

      if (routeResponse.data) {
        onRouteFetched(routeResponse.data); // Pass GeoJSON to parent
      } else {
        throw new Error('No route data received from backend.');
      }

    } catch (err) {
      console.error('Error getting route:', err.response ? err.response.data : err.message);
      setError(err.response ? `Error: ${err.response.data.error || err.message}` : `Error: ${err.message}`);
      onRouteFetched(null); // Clear route on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="route-planner"
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2>Route Planner</h2>
      {error && <p className="error-message">{error}</p>}
      <div>
        <label htmlFor="start">Start Location:</label>
        <input
          type="text"
          id="start"
          value={startLocation}
          onChange={(e) => setStartLocation(e.target.value)}
          disabled={loading}
        />
      </div>
      <div>
        <label htmlFor="end">End Location:</label>
        <input
          type="text"
          id="end"
          value={endLocation}
          onChange={(e) => setEndLocation(e.target.value)}
          disabled={loading}
        />
      </div>
      <div>
        <label htmlFor="preference">Preference:</label>
        <select
          id="preference"
          value={preference}
          onChange={(e) => setPreference(e.target.value)}
          disabled={loading}
        >
          {preferences.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <button onClick={handleGetRoute} disabled={loading}>
        {loading ? 'Loading...' : 'Get Route'}
      </button>
    </motion.div>
  );
};

export default RoutePlanner;
