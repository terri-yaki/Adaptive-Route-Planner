

  // Create a function to call the Nominatim API
function getPlaces(input) {
  // Get the user's input
  const search = input.value;
  
  // Send a GET request to the Nominatim API
  fetch(`https://nominatim.openstreetmap.org/search?q=${search}&format=json&limit=5`)
    .then(response => response.json())
    .then(data => {
      // Clear the previous results
      input.nextElementSibling.innerHTML = "";
      
      // Loop through the data
      data.forEach(place => {
        // Create a new option element
        const option = document.createElement("option");
        // Set the value and text of the option
        option.value = place.display_name;
        option.text = place.display_name;
        // Append the option to the select element
        input.nextElementSibling.appendChild(option);
      });
    });
}

// Add event listeners to the input elements to call the function when the user types
    startPoint.addEventListener("input", function() {
      getPlaces(startPoint);
  });
    endPoint.addEventListener("input", function() {
  getPlaces(endPoint);
  });

function getRoute() {

    // Get the start point and end point values
  var startPoint = document.getElementById("start_point").value;
  var endPoint = document.getElementById("end_point").value;

  


  // Make the API call
  var url = "https://api.openrouteservice.org/v2/directions/driving-car";
  var params = {
      "start": startPoint,
      "end": endPoint
  };
  var headers = {
      "Authorization": "Bearer uNWRj8Yx7lmNsbBcgchfy5a8LEmH9fr0h8BFzHNNOV8",
      "Accept": "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8"
  };

  // Use the fetch API to make the request
  fetch(url, {
    method: "GET",
    headers: headers,
    params: params
  })
  .then(function(response) {
    return response.json();
  })
  .then(function(data) {
    // TODO Do something with the response
    console.log(data);
  });
}