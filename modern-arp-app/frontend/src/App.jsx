import React, { useState } from 'react';
import './App.css';
import MapComponent from './components/MapComponent';
import RoutePlanner from './components/RoutePlanner';

function App() {
  const [routeGeoJSON, setRouteGeoJSON] = useState(null);

  const handleRouteFetched = (geojsonData) => {
    console.log("Route fetched in App.jsx:", geojsonData);
    setRouteGeoJSON(geojsonData);
  };

  return (
    <div className="App">
      <MapComponent routeGeoJSON={routeGeoJSON} />
      <RoutePlanner onRouteFetched={handleRouteFetched} />
    </div>
  );
}

export default App;
