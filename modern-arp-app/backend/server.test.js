// jest.mock('axios'); // No longer needed here, as __mocks__/axios.js will be used.
jest.mock('./routingService'); // Mock routingService as it makes its own axios calls etc.

const request = require('supertest');
const app = require('./server'); // Assuming server.js exports the app for testing
const axios = require('axios'); // Will be the mocked version from __mocks__
const routingService = require('./routingService'); // The mocked version

// Close server after tests are done to prevent Jest open handle error
let server;
beforeAll((done) => {
    server = app.listen(0, done); // Start server on a random available port
});

afterAll((done) => {
    server.close(done);
});

describe('GET /api/geocode', () => {
  it('should return geocoded data for a valid address', async () => {
    axios.get.mockResolvedValue({ data: [{ lat: '51.5074', lon: '0.1278', display_name: 'London' }] });
    const response = await request(server).get('/api/geocode?address=London');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([{ lat: '51.5074', lon: '0.1278', display_name: 'London' }]);
    expect(axios.get).toHaveBeenCalledWith(
      'https://nominatim.openstreetmap.org/search',
      expect.objectContaining({
        params: { q: 'London', format: 'json', limit: 5 },
      })
    );
  });

  it('should return 400 if address is not provided', async () => {
    const response = await request(server).get('/api/geocode');
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('Address is required');
  });

  it('should return 500 if Nominatim API fails', async () => {
    axios.get.mockRejectedValue(new Error('Nominatim API error'));
    const response = await request(server).get('/api/geocode?address=London');
    expect(response.statusCode).toBe(500);
    expect(response.body.error).toBe('Failed to fetch geocoding data');
  });
});

describe('GET /api/route', () => {
  const mockRouteRequest = {
    startLat: '51.5074',
    startLng: '0.1278',
    endLat: '51.5099',
    endLng: '0.1178',
    preference: 'fastest',
  };

  const mockOSRMRoute = { // Simplified OSRM route object
    geometry: { type: 'LineString', coordinates: [[0.1278, 51.5074], [0.1178, 51.5099]] },
    duration: 1000,
    distance: 5000,
  };

  const mockScoredRoute = {
    ...mockOSRMRoute,
    score: 950,
    preference: 'fastest',
  };
  
  const mockApiResponse = {
    type: "Feature",
    geometry: mockScoredRoute.geometry,
    properties: {
      score: mockScoredRoute.score,
      preference: mockScoredRoute.preference,
      duration: mockScoredRoute.duration,
      distance: mockScoredRoute.distance,
    }
  };

  it('should return a route for valid parameters', async () => {
    routingService.fetchOSRMRoutes.mockResolvedValue([mockOSRMRoute]);
    routingService.calculateRouteScores.mockResolvedValue([mockScoredRoute]);
    
    const response = await request(server).get('/api/route').query(mockRouteRequest);
    
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(mockApiResponse);
    expect(routingService.fetchOSRMRoutes).toHaveBeenCalledWith(
      mockRouteRequest.startLng,
      mockRouteRequest.startLat,
      mockRouteRequest.endLng,
      mockRouteRequest.endLat
    );
    expect(routingService.calculateRouteScores).toHaveBeenCalledWith([mockOSRMRoute], mockRouteRequest.preference);
  });

  it('should return 400 if parameters are missing', async () => {
    const response = await request(server).get('/api/route?startLat=51.5074'); // Missing other params
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('Missing required parameters: startLat, startLng, endLat, endLng, preference');
  });

  it('should return 404 if no routes are found by OSRM', async () => {
    routingService.fetchOSRMRoutes.mockResolvedValue([]); // No routes found
    const response = await request(server).get('/api/route').query(mockRouteRequest);
    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe('No routes found between the specified points.');
  });

  it('should return 500 if route scoring fails', async () => {
    routingService.fetchOSRMRoutes.mockResolvedValue([mockOSRMRoute]);
    routingService.calculateRouteScores.mockResolvedValue([]); // Scoring returns empty
    const response = await request(server).get('/api/route').query(mockRouteRequest);
    expect(response.statusCode).toBe(500);
    expect(response.body.error).toBe('Failed to score routes.');
  });
  
  it('should return 503 if OSRM fetching fails', async () => {
    routingService.fetchOSRMRoutes.mockRejectedValue(new Error('Failed to fetch routes from OSRM'));
    const response = await request(server).get('/api/route').query(mockRouteRequest);
    expect(response.statusCode).toBe(503);
    expect(response.body.error).toBe('Could not fetch routes from routing provider.');
  });
});
