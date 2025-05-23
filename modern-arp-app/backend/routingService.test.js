const { calculateRouteScores, samplePointsAlongRoute } = require('./routingService');
const axios = require('axios'); // Will be mocked by __mocks__/axios.js

// Mock internal data fetching functions that are part of routingService.js
// We are testing calculateRouteScores, so its dependencies within the same module need to be mocked
// if they make external calls or are complex.
// However, getWeatherDataForPoint and getCrimeDataForPoint make calls to the *backend's own*
// /api/weather and /api/crime endpoints. For unit testing calculateRouteScores,
// we should mock these functions directly to provide controlled data.

jest.mock('./routingService', () => {
  const originalModule = jest.requireActual('./routingService');
  return {
    ...originalModule,
    getWeatherDataForPoint: jest.fn(),
    getCrimeDataForPoint: jest.fn(),
  };
});
// We need to re-require after mocking parts of it.
const routingService = require('./routingService');


describe('routingService', () => {
  describe('samplePointsAlongRoute', () => {
    it('should return an empty array if no coordinates', () => {
      expect(samplePointsAlongRoute({ type: 'LineString', coordinates: [] }, 5)).toEqual([]);
    });

    it('should return the start point if numPoints is 1', () => {
      const routeGeom = { type: 'LineString', coordinates: [[1,1],[2,2],[3,3]] };
      expect(samplePointsAlongRoute(routeGeom, 1)).toEqual([[1,1]]);
    });
    
    it('should return start and end points if numPoints is 2', () => {
      const routeGeom = { type: 'LineString', coordinates: [[1,1],[2,2],[3,3]] };
      expect(samplePointsAlongRoute(routeGeom, 2)).toEqual([[1,1],[3,3]]);
    });

    it('should sample points correctly', () => {
      const routeGeom = {
        type: 'LineString',
        coordinates: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[7,7],[8,8],[9,9],[10,10]],
      };
      // Expect 5 points: 0,0 / 2.5,2.5 (approx) / 5,5 / 7.5,7.5 (approx) / 10,10
      // Based on step = floor(11 / 4) = floor(2.75) = 2
      // Indices: 0, 2, 4, 6, 8, then 10 (last point)
      const expectedPoints = [[0,0],[2,2],[4,4],[6,6],[8,8],[10,10]];
      // The logic of samplePointsAlongRoute aims for numPoints, and includes the last point.
      // For numPoints = 5, step = floor(totalCoordinates / (numPoints-1))
      // totalCoordinates = 11, numPoints = 5. step = floor(11/4) = 2.
      // Indices: 0, 2, 4, 6, 8. Then adds last point if not present.
      // If numPoints = 5, it should take points at indices 0, 2, 4, 6, 8.
      // The actual logic is:
      // step = Math.max(1, Math.floor(totalCoordinates / (numPoints -1)));
      // totalCoordinates = 11, numPoints = 5. step = Math.floor(11 / 4) = 2
      // Loop: i=0, points.push(coords[0]); i=2, points.push(coords[2]); i=4, points.push(coords[4]); i=6, points.push(coords[6]); i=8, points.push(coords[8])
      // points.length is 5.
      // Then it ensures the last point is included if not already. coords[10] is not coords[8].
      // The slice(0, numPoints) ensures it doesn't exceed numPoints.
      // The logic for including the last point might make it return more if not sliced.
      const sampled = samplePointsAlongRoute(routeGeom, 5);
      expect(sampled.length).toBe(5); // It should return exactly numPoints if possible
      expect(sampled).toEqual([[0,0],[2,2],[4,4],[6,6],[8,8]]);
    });
     it('should handle fewer coordinates than numPoints', () => {
      const routeGeom = { type: 'LineString', coordinates: [[0,0],[1,1],[2,2]] };
      const sampled = samplePointsAlongRoute(routeGeom, 5);
      expect(sampled).toEqual([[0,0],[1,1],[2,2]]); // Should return all available points
    });
  });

  describe('calculateRouteScores', () => {
    const mockRoutes = [
      {
        duration: 1000,
        distance: 5000,
        geometry: { type: 'LineString', coordinates: [[0,0], [1,1]] },
        weight_name: 'route1',
      },
      {
        duration: 1200,
        distance: 4500,
        geometry: { type: 'LineString', coordinates: [[0,0], [0.5,0.5], [1,1]] },
        weight_name: 'route2',
      },
    ];

    beforeEach(() => {
      // Reset mocks before each test
      routingService.getWeatherDataForPoint.mockReset();
      routingService.getCrimeDataForPoint.mockReset();
    });

    it('should score "fastest" based on duration and distance', async () => {
      const preference = 'fastest';
      const scoredRoutes = await routingService.calculateRouteScores([...mockRoutes], preference);
      expect(scoredRoutes[0].score).toBeCloseTo(100000 / (1000 + 5000/10));
      expect(scoredRoutes[1].score).toBeCloseTo(100000 / (1200 + 4500/10));
      expect(scoredRoutes[0].preference).toBe(preference);
    });

    it('should score "safest" considering crime data', async () => {
      routingService.getCrimeDataForPoint.mockImplementation(async (lat, lon) => {
        if (lat === 0 && lon === 0) return [{ type: 'crime' }]; // 1 crime at start for route1
        if (lat === 0.5 && lon === 0.5) return [{type: 'crime'}, {type: 'crime'}]; // 2 crimes for route2 midpoint
        return []; // No crime otherwise
      });

      const preference = 'safest';
      const scoredRoutes = await routingService.calculateRouteScores([...mockRoutes], preference);
      // Route 1 samples points, let's assume it samples [0,0] and [1,1] (simplified for test logic)
      // Avg crime for route1 (simplified): (1+0)/2 = 0.5. Score penalty: 0.5 * 50 = 25. Duration penalty: 1000/100 = 10. Total: 1000 - 25 - 10 = 965
      // Route 2 samples points, e.g. [0,0], [0.5,0.5], [1,1]
      // Avg crime for route2 (simplified): (0+2+0)/3 = 0.66. Score penalty: 0.66 * 50 = 33. Duration penalty: 1200/100 = 12. Total: 1000 - 33 - 12 = 955
      // Exact scores depend on samplePointsAlongRoute and number of samples (10 by default).
      // This is a conceptual check.
      expect(scoredRoutes[0].score).toBeLessThan(1000);
      expect(scoredRoutes[1].score).toBeLessThan(scoredRoutes[0].score); // Route 2 should be less safe
      expect(routingService.getCrimeDataForPoint).toHaveBeenCalled();
    });

    it('should score "less_rainy" considering precipitation data', async () => {
      routingService.getWeatherDataForPoint.mockImplementation(async (lat, lon) => {
        return { hourly: { precipitation: [lon === 0 ? 2 : 1, 0, 0, 0, 0, 0] } }; // More rain for route1 start
      });

      const preference = 'less_rainy';
      const scoredRoutes = await routingService.calculateRouteScores([...mockRoutes], preference);
      expect(scoredRoutes[0].score).toBeLessThan(1000);
      expect(scoredRoutes[1].score).toBeGreaterThan(scoredRoutes[0].score); // Route 1 should have lower score (more rain)
      expect(routingService.getWeatherDataForPoint).toHaveBeenCalled();
    });
    
    it('should score "less_polluted" considering pm25 data', async () => {
      routingService.getWeatherDataForPoint.mockImplementation(async (lat, lon) => {
        return { hourly: { pm25: [lon === 0 ? 50 : 10, 0, 0, 0, 0, 0] } }; // More pollution for route1 start
      });
      
      const preference = 'less_polluted';
      const scoredRoutes = await routingService.calculateRouteScores([...mockRoutes], preference);
      expect(scoredRoutes[0].score).toBeLessThan(1000);
      expect(scoredRoutes[1].score).toBeGreaterThan(scoredRoutes[0].score); // Route 1 should have lower score (more pollution)
      expect(routingService.getWeatherDataForPoint).toHaveBeenCalled();
    });

    it('should return empty array if no routes provided', async () => {
      const scoredRoutes = await routingService.calculateRouteScores([], 'fastest');
      expect(scoredRoutes).toEqual([]);
    });
    
    it('should handle missing geometry in routes', async () => {
        const routesWithMissingGeo = [{ duration: 1000, distance: 5000 /* no geometry */ }];
        const scoredRoutes = await routingService.calculateRouteScores(routesWithMissingGeo, 'fastest');
        expect(scoredRoutes[0].score).toBe(0); // Assigns a low score
    });
  });
});
