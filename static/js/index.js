let map;
let control;
let userLocationMarker;
let autoUpdateInterval;

function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loadingScreen");
  loadingScreen.style.display = "none";
}

function initMap() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        map = L.map("map").setView([latitude, longitude], 18);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        userLocationMarker = L.marker([latitude, longitude])
          .addTo(map)
          .bindPopup("You are here!")
          .openPopup();
      },
      (error) => {
        console.error("Error getting user location: ", error);
      }
    );
  } else {
    console.error("Geolocation is not supported by this browser.");
  }

  hideLoadingScreen();

  document.getElementById("getRouteBtn").addEventListener("click", (event) => {
    event.preventDefault();
    getRoute();
  });

  document
    .getElementById("setLocationBtn")
    .addEventListener("click", (event) => {
      event.preventDefault();
      setStartPointToCurrentLocation();
    });
}

async function setStartPointToCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      try {
        const locationName = await getAddressFromLatLng(latitude, longitude);
        document.getElementById("start_point").value = locationName;
      } catch (error) {
        console.error("Error getting address from coordinates: ", error);
      }
    });
  } else {
    console.error("Geolocation is not supported by this browser.");
  }
}

async function getAddressFromLatLng(latitude, longitude) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
  );
  const data = await response.json();
  return data.display_name;
}

async function getRoute() {
  const startPoint = document.getElementById("start_point").value;
  const endPoint = document.getElementById("end_point").value;

  if (control) {
    control.remove();
  }

  const startPointLatLng = await getLatLngFromAddress(startPoint);
  const endPointLatLng = await getLatLngFromAddress(endPoint);

  control = L.Routing.control({
    waypoints: [L.latLng(startPointLatLng), L.latLng(endPointLatLng)],
    createMarker: function (_i, wp) {
      return L.marker(wp.latLng, {
        draggable: false,
        icon: L.AwesomeMarkers.icon({
          icon: "circle",
          markerColor: "red",
          prefix: "fa",
        }),
      });
    },
    lineOptions: {
      styles: [
        {
          color: "#1f3a93",
          opacity: 0.8,
          weight: 6,
          lineCap: "round",
          lineJoin: "butt",
        },
      ],
    },
    autoRoute: true,
    routeWhileDragging: false,
    showAlternatives: false,
    addWaypoints: false,
  }).addTo(map);

  control.on("routesfound", async (e) => {
    const routes = e.routes;

    if (routes.length === 1) {
      // If there's only one route, just show it
      const route = routes[0];
      control.setWaypoints([
        L.latLng(route.waypoints[0].latLng),
        L.latLng(route.waypoints[route.waypoints.length - 1].latLng),
      ]);
    } else {
      const preference = document.querySelector(
        'input[name="route_preference"]:checked'
      ).value;

      const scores = await calculateRouteScores(routes, preference);

      // Find the highest-scoring route
      const bestRouteIndex = scores.indexOf(Math.max(...scores));
      const bestRoute = routes[bestRouteIndex];

      // Add midway points to the best route based on the selected preference
      if (preference !== "fastest") {
        const updatedWaypoints = await addMidwayPoints(bestRoute, preference, getWeatherData);
        control.setWaypoints(updatedWaypoints);
      } else {
        // Use the original best route waypoints if the preference is set to "fastest"
        control.setWaypoints([
          L.latLng(bestRoute.waypoints[0].latLng),
          L.latLng(bestRoute.waypoints[bestRoute.waypoints.length - 1].latLng),
        ]);
      }

      // Set the alternatives in the control's options
      control.options.alternatives = routes.filter(
        (_, index) => index !== bestRouteIndex
      );
    }

    // After setting the waypoints and alternatives, call route() to update the display
    control.route();
  });
}


async function getLatLngFromAddress(address) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      address
    )}`
  );
  const data = await response.json();
  if (data && data.length > 0) {
    return {
      lat: data[0].lat,
      lng: data[0].lon,
    };
  } else {
    throw new Error("No coordinates found for the given address.");
  }
}

async function getWeatherData(lat, lng) {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=precipitation,pm25`
  );
  const data = await response.json();
  return data;
}

async function getCrimeData(lat, lng, date) {
  const response = await fetch(
    `https://data.police.uk/api/crimes-street/all-crime?lat=${lat}&lng=${lng}&date=${date}`
  );
  const data = await response.json();
  console.log(data);
  return data;
}


async function calculateRouteScores(routes, preference) {
  const scores = [];

  // Sort routes by distance in ascending order
  routes.sort((a, b) => a.summary.totalDistance - b.summary.totalDistance);

  for (const [index, route] of routes.entries()) {
    let score = 0;
    const distance = route.summary.totalDistance;
    const waypoints = route.coordinates;

    switch (preference) {
      // Calculate scores based on distance
      case "fastest":
        // Add scores based on distance
        const baseScore = 5 - index; // index is the current route index in the sorted array
        score += baseScore;
        break;

      case "safest":
        let totalCrimes = 0;

        for await (const waypoint of waypoints) {
          const currentDate = new Date();
          const monthBefore = new Date(currentDate.setMonth(currentDate.getMonth() - 1));
          const crimeData = await getCrimeData(waypoint.lat, waypoint.lng, `${monthBefore.getFullYear()}-${monthBefore.getMonth() + 1}`);
          totalCrimes += crimeData.length;
        }

        // Add scores based on totalCrimes
        score -= totalCrimes;
        break;

      // Calculate scores based on weather
      case "less_rainy":
        let totalRain = 0;

        for await (const waypoint of waypoints) {
          const weatherData = await getWeatherData(waypoint.lat, waypoint.lng);
          totalRain += weatherData.hourly.precipitation;
        }

        // Add scores based on totalRain
        score -= totalRain;
        break;

      // Calculate scores based on air pollution
      case "less_polluted":
        let totalPm25 = 0;

        for await (const waypoint of waypoints) {
          const weatherData = await getWeatherData(waypoint.lat, waypoint.lng);
          totalPm25 += weatherData.hourly.pm25;
        }

        // Add scores based on totalPm25
        score -= totalPm25;
        break;

      // Calculate scores based on traffic
      case "less_traffic":
        let trafficPoints = 0;

        // Adding a simple scoring system where the longer the route, the more traffic points
        trafficPoints = distance / 1000;

        // Subtract the traffic points from the score
        score -= trafficPoints;
        break;
    }
    scores.push(score);
  }

  return scores;
}


async function addMidwayPoints(route, preference, apiFunction) {
  const waypoints = [route.waypoints[0].latLng];
  let currentPoint = route.waypoints[0].latLng;

  while (true) {
    const distanceToDestination = currentPoint.distanceTo(route.waypoints[route.waypoints.length - 1].latLng);

    if (distanceToDestination <= 5 * 1609.34) { // 5 miles
      break;
    }

    const stepPoint = currentPoint.destinationPoint(5 * 1609.34, currentPoint.bearingTo(route.waypoints[route.waypoints.length - 1].latLng));

    const nearbyPoints = getNearbyPoints(stepPoint, 1.25 * 1609.34); // 1.25 miles

    let bestPoint = stepPoint;
    let bestValue;

    for (const point of nearbyPoints) {
      const data = await apiFunction(point.lat, point.lng);
      const value = getPreferenceValue(data, preference);

      if (!bestValue || value < bestValue) {
        bestValue = value;
        bestPoint = point;
      }
    }

    waypoints.push(bestPoint);
    currentPoint = bestPoint;
  }

  waypoints.push(route.waypoints[route.waypoints.length - 1].latLng);

  return waypoints;
}

function getNearbyPoints(center, radius) {
  const latRadian = (Math.PI / 180) * center.lat;
  const latOffset = radius / 111.32;
  const lngOffset = radius / (40075 * Math.cos(latRadian) / 360);
  
  const topLeft = [center.lat + latOffset, center.lng - lngOffset];
  const bottomRight = [center.lat - latOffset, center.lng + lngOffset];
  
  return [
    L.latLng(topLeft),
    L.latLng(bottomRight),
  ];
}

async function getPreferenceValue(preference, lat, lng) {
  const data = await getWeatherData(lat, lng);

  switch (preference) {
    case "less_rainy":
      return data.hourly.precipitation_sum;
    case "less_polluted":
      return data.hourly.pm25;
    case "safest"://TODO
      // Add your logic here for the safest route
      break;
    case "less_traffic"://TODO
      // Add your logic here for the less traffic route
      break;
    default:
      return null;
  }
}



document.querySelectorAll(".clear-input-btn").forEach((btn) => {
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    const inputId = event.target.dataset.inputId;
    document.getElementById(inputId).value = "";
  });
});

let routeLine = null;

function routeExists() {
  return routeLine !== null;
}

let userLocationUpdateInterval = null;

async function updateUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        if (userLocationMarker) {
          // Update the marker's position without moving the view
          userLocationMarker.setLatLng([latitude, longitude]);
        } else {
          // Create the marker if it doesn't exist
          userLocationMarker = L.marker([latitude, longitude]).addTo(map);
        }
      },
      (error) => {
        console.error("Error updating user location: ", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000, // You can adjust the timeout if needed
      }
    );
  } else {
    console.error("Geolocation is not supported by this browser.");
  }
}

// Call updateUserLocation every second
setInterval(updateUserLocation, 1000);

$(document).ready(function () {
  const collapseBtn = $(".leaflet-routing-collapse-btn");
  const routingContainer = $(".leaflet-routing-container");

  collapseBtn.click(function () {
    routingContainer.toggleClass("collapsed");
    if (routingContainer.hasClass("collapsed")) {
      collapseBtn.html("&#x25BC;");
    } else {
      collapseBtn.html("&#x25B2;");
    }
  });
});

if (window.innerWidth <= 767) {
  document
    .getElementById("sidePanelToggle")
    .addEventListener("click", function () {
      let sidePanel = document.querySelector(".side-panel");
      if (sidePanel.style.display === "none") {
        sidePanel.style.display = "block";
      } else {
        sidePanel.style.display = "none";
      }
    });
}

initMap();
