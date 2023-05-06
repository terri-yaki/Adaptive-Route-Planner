// Import the getUserLocation function from getApi.js
import { getUserLocation } from '../static/js/getApi.js';

describe("getUserLocation", () => {
  test("should return latitude and longitude", (done) => {
    const mockPosition = {
      coords: {
        latitude: 23.344,
        longitude: 34.765,
      },
    };
    const success = jest.fn();
    navigator.geolocation = {
      getCurrentPosition: (onSuccess) => {
        onSuccess(mockPosition);
      },
    };
    getUserLocation(success);
    setTimeout(() => {
      expect(success).toHaveBeenCalledWith(23.344, 34.765);
      done();
    }, 0);
  });

  test("should return error message if geolocation is not supported", (done) => {
    const error = jest.spyOn(console, "log");
    navigator.geolocation = null;
    getUserLocation();
    setTimeout(() => {
      expect(error).toHaveBeenCalledWith("Error: Geolocation not supported.");
      done();
    }, 0);
  });

  test("should return error message if unable to get location", (done) => {
    const error = jest.spyOn(console, "log");
    navigator.geolocation = {
      getCurrentPosition: (onSuccess, onError) => {
        onError({
          message: "Unable to get location",
        });
      },
    };
    getUserLocation();
    setTimeout(() => {
      expect(error).toHaveBeenCalledWith("Error: Unable to get location");
      done();
    }, 0);
  });
});
