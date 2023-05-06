// Import the necessary libraries for testing
import { getWeather } from './weather';

// Test suite for the getWeather function
describe('getWeather function', () => {
  // Test case 1 - check if the function returns the correct weather data
  it('should return the correct weather data', async () => {
    const latitude = 37.7749;
    const longitude = -122.4194;
    const result = await getWeather(latitude, longitude);
    expect(result).toEqual({
      temperature: expect.any(Number),
      precipitation: expect.any(Number),
      snowDepth: expect.any(Number),
      windSpeed: expect.any(Number),
      humidity: expect.any(Number)
    });
  });

  // Test case 2 - check if the function throws an error when an invalid latitude and longitude are given
  it('should throw an error on invalid longitude and latitude', async () => {
    const latitude = 'invalid';
    const longitude = 'invalid';
    await expect(getWeather(latitude, longitude)).rejects.toThrow();
  });
});