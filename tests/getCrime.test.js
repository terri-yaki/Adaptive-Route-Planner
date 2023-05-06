describe("getCrime function", () => {
    beforeEach(() => {
      fetch.resetMocks();
    });
  
    test("should return number of vehicle crimes for given latitude and longitude", async () => {
      const latitude = 51.509865;
      const longitude = -0.118092;
  
      const mockResponse = [
        { category: "vehicle-crime" },
        { category: "theft-from-the-person" },
        { category: "violent-crime" },
        { category: "vehicle-crime" },
      ];
  
      fetch.mockResponseOnce(JSON.stringify(mockResponse));
  
      const result = await getCrime(latitude, longitude);
  
      expect(result).toEqual({ vehicle_crime: 2 });
      expect(fetch.mock.calls.length).toEqual(1);
      expect(fetch.mock.calls[0][0]).toEqual(
        "https://data.police.uk/api/crimes-street/all-crime?lat=51.509865&lng=-0.118092"
      );
    });
  
    test("should return error message if HTTP request fails", async () => {
      const latitude = 51.509865;
      const longitude = -0.118092;
  
      fetch.mockReject(new Error("fake error message"));
  
      const result = await getCrime(latitude, longitude);
  
      expect(result).toEqual(undefined);
      expect(console.log.mock.calls[0][0]).toEqual("Error: fake error message");
    });
    
    // Further test cases can be added as per the requirement
  });