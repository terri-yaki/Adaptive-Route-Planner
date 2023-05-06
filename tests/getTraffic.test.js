describe('getTraffic', () => {
    it('returns an object with the number of traffic incidents within 10km of provided latitude and longitude', async() => {
      const latitude = 52.520008;
      const longitude = 13.404954;
      const expectedIncidents = typeof 5;
      const result = await getTraffic(latitude, longitude);
      expect(typeof result.traffic_incidents).toBe(expectedIncidents);
    });
  
    it('handles an error and returns console log message', async() => {
      const latitude = 'not a number';
      const longitude = 13.404954;
      console.log = jest.fn();
      const result = await getTraffic(latitude, longitude);
      expect(console.log).toHaveBeenCalled();
    });});
  
    const assert = require('assert');
    const sinon = require('sinon');
    const axios = require('axios');
    
    const {getCrime} = require('./filename');