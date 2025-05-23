// modern-arp-app/backend/__mocks__/axios.js
const axios = {
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  // Add other methods if your application uses them
};

module.exports = axios;
