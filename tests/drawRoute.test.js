describe('drawRoute', () => {
    let mockRouteData;
    let mockMap;
    let mockLatLngs;
    let mockPolyline;
  
    beforeEach(() => {
      mockRouteData = {
        response: {
          route: [
            {
              shape: ['12.34,56.78', '23.45,67.89']
            }
          ]
        }
      };
  
      mockMap = {
        fitBounds: jest.fn()
      };
  
      mockLatLngs = [
        [12.34, 56.78],
        [23.45, 67.89]
      ];
  
      mockPolyline = {
        addTo: jest.fn()
      };
  
      L.polyline = jest.fn(() => mockPolyline);
    });
  
    it('should draw a polyline on the map', () => {
      drawRoute(mockRouteData, mockMap);
  
      expect(L.polyline).toHaveBeenCalledWith(mockLatLngs, {color: 'blue'});
      expect(mockPolyline.addTo).toHaveBeenCalledWith(mockMap);
    });
  
    it('should fit the map to the bounds of the polyline', () => {
      drawRoute(mockRouteData, mockMap);
  
      expect(mockMap.fitBounds).toHaveBeenCalledWith(mockPolyline.getBounds());
    });
  });

  describe("getRoute", () => {
    it("should return journey information given start and end point", async () => {
      const start = "San Francisco";
      const end = "Los Angeles";
      const map = document.getElementById("map");
  
      // Mock the response of the HERE Geocoding API
      const geocodingApiResponse = {
        items: [
          {
            title: "San Francisco, CA, United States",
            position: { lat: 37.77493, lng: -122.41942 },
          },
        ],
      };
      jest.spyOn(window, "fetch").mockImplementation((url) => {
        if (url.includes("geocode")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(geocodingApiResponse),
          })
        }
      });
  
      // Mock the response of the HERE Routing API
      const routingApiResponse = {
        response: {
          route: [
            {
              summary: {
                distance: 616766,
                travelTime: 22509,
              },
            },
          ],
        },
      };
      jest.spyOn(window, "fetch").mockImplementation((url) => {
        if (url.includes("calculateroute")) {

          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(routingApiResponse),
          })
        }
      });
  
      // Create a mock drawRoute function
      const drawRoute = jest.fn();
  
      const journey = await getRoute(start, end, map, drawRoute);
  
      expect(journey).toEqual({ distance: 616766, travel_time: 22509 });
      expect(window.fetch).toHaveBeenCalledTimes(2);
      expect(drawRoute).toHaveBeenCalledWith(routingApiResponse, map);
  
      // Clean up the mocked functions
      window.fetch.mockClear();
      delete window.fetch;
      drawRoute.mockClear();
    });
  
    it("should reject with an error if an exception is thrown", async () => {
      const start = "Invalid start point";
      const end = "Invalid end point";
      const map = document.getElementById("map");
      const drawRoute = jest.fn();
  
      await expect(getRoute(start, end, map, drawRoute)).rejects.toThrow();
      expect(window.fetch).toHaveBeenCalledTimes(2);
  
      // Clean up the mocked functions
      window.fetch.mockClear();
      delete window.fetch;
      drawRoute.mockClear();
    });
  });