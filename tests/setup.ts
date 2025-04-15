/**
 * Jest Test Setup
 * 
 * This file is executed before each test file. It sets up global test configuration,
 * environment variables, mocks, and any other necessary test prerequisites.
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Set default timeout for tests to 10 seconds
jest.setTimeout(10000);

// Mock environment variables used by the application
process.env.BASE_URL = 'http://localhost:5000';
process.env.PORT = '5000';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'; // 32-byte test key

// Run before all tests
beforeAll(() => {
  // Initialize any global resources or mock objects needed for all tests
  console.log('Setting up test environment...');
});

// Run after all tests
afterAll(() => {
  // Clean up any global resources
  console.log('Tearing down test environment...');
});

// Global test utilities
global.testUtils = {
  // Generate a random string of specified length
  randomString: (length: number = 10): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
  
  // Create a mock request object
  createMockRequest: (overrides: any = {}): any => {
    return {
      session: {},
      headers: {},
      body: {},
      query: {},
      params: {},
      ip: '127.0.0.1',
      method: 'GET',
      url: '/',
      ...overrides
    };
  },
  
  // Create a mock response object
  createMockResponse: (): any => {
    const res: any = {
      statusCode: 200,
      headers: {},
      body: null
    };
    
    res.status = jest.fn().mockImplementation((code) => {
      res.statusCode = code;
      return res;
    });
    
    res.json = jest.fn().mockImplementation((data) => {
      res.body = data;
      return res;
    });
    
    res.send = jest.fn().mockImplementation((data) => {
      res.body = data;
      return res;
    });
    
    res.setHeader = jest.fn().mockImplementation((name, value) => {
      res.headers[name] = value;
      return res;
    });
    
    res.redirect = jest.fn().mockImplementation((url) => {
      res.redirectUrl = url;
      return res;
    });
    
    return res;
  },
  
  // Create a mock next function
  createMockNext: (): jest.Mock => {
    return jest.fn();
  }
};