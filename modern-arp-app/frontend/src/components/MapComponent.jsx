import React, { useEffect, useRef } from 'react';
import Map, { NavigationControl, Source, Layer, useMap } from 'react-map-gl';
import mapboxgl from 'mapbox-gl'; // Import mapboxgl for LngLatBounds
import 'mapbox-gl/dist/mapbox-gl.css';
import { motion, useAnimation } from 'framer-motion'; // Import motion and useAnimation

const MAPBOX_TOKEN = "YOUR_MAPBOX_ACCESS_TOKEN"; // Replace with your actual token

const MapComponent = ({ routeGeoJSON }) => {
  const { current: map } = useMap(); // Get map instance using useMap hook
  const routeControls = useAnimation();

  const initialViewState = {
    latitude: 37.7577, // Default: San Francisco
    longitude: -122.4376,
    zoom: 8,
  };

  useEffect(() => {
    if (map && routeGeoJSON && routeGeoJSON.geometry && routeGeoJSON.geometry.coordinates) {
      const coordinates = routeGeoJSON.geometry.coordinates;
      if (coordinates.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach(coord => {
          bounds.extend(coord);
        });
        map.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          maxZoom: 15,
          duration: 1000
        });
        // Animate route line opacity
        routeControls.start({ opacity: 0.75, transition: { duration: 0.5 } });
      }
    } else {
      // Hide route if routeGeoJSON is null
      routeControls.start({ opacity: 0, transition: { duration: 0 } });
    }
  }, [routeGeoJSON, map, routeControls]);

  // Define the layer paint properties using motion for opacity
  const routeLayerPaint = {
    'line-color': '#3887be',
    'line-width': 5,
    // 'line-opacity' will be controlled by the motion.div wrapper as direct animation of paint props is tricky
  };

  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={initialViewState}
      style={{ width: "100vw", height: "100vh" }}
      mapStyle="mapbox://styles/mapbox/streets-v11"
    >
      <NavigationControl position="top-left" />
      {routeGeoJSON && routeGeoJSON.geometry && routeGeoJSON.geometry.coordinates && (
        <motion.div initial={{ opacity: 0 }} animate={routeControls} > 
          {/* Using Approach 2: Wrap Source and Layer in motion.div for opacity animation */}
          <Source id="route" type="geojson" data={routeGeoJSON}>
            <Layer
              id="route-layer"
              type="line"
              source="route"
              layout={{
                'line-join': 'round',
                'line-cap': 'round',
              }}
              paint={routeLayerPaint} // Opacity is now controlled by the parent motion.div
            />
          </Source>
        </motion.div>
      )}
    </Map>
  );
};

// Wrap MapComponent with MapProvider if useMap is used within it directly
// For this structure, App.jsx likely has the MapProvider or Map is used directly.
// If useMap is called in a component that isn't a child of <Map>, you need a MapProvider.
// Here, we assume MapComponent is rendered as a child of <Map> or <MapProvider> in App.jsx
// react-map-gl v7+ provides the map instance via context, so direct <Map> wrapping is fine.
// Let's ensure App.jsx correctly wraps it if it's not already.
// The Map component itself provides the context for useMap.

export default MapComponent;
