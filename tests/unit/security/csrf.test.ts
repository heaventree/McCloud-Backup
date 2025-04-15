/**
 * Unit Tests for CSRF Protection
 * 
 * Tests the CSRF token generation, validation, and middleware functionality.
 */
import { generateCsrfToken, getCsrfToken, validateCsrfToken, csrfTokenMiddleware, csrfProtection } from '../../../server/security/csrf';

// Mock request and response objects
const createMockRequest = () => ({
  session: {},
  headers: {},
  body: {},
  method: 'POST',
  url: '/api/test',
  ip: '127.0.0.1'
});

const createMockResponse = () => {
  const res: any = {
    locals: {},
    headers: {}
  };
  
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn((name, value) => {
    res.headers[name] = value;
    return res;
  });
  
  return res;
};

describe('CSRF Protection', () => {
  describe('generateCsrfToken', () => {
    it('should generate a non-empty token string', () => {
      const token = generateCsrfToken();
      
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
    
    it('should generate different tokens on each call', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      
      expect(token1).not.toEqual(token2);
    });
  });
  
  describe('getCsrfToken', () => {
    it('should generate and store a token if none exists', () => {
      const req = createMockRequest();
      
      const token = getCsrfToken(req);
      
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(req.session.csrfToken).toEqual(token);
      expect(typeof req.session.csrfTokenTimestamp).toBe('number');
    });
    
    it('should return existing token if one exists', () => {
      const req = createMockRequest();
      req.session.csrfToken = 'existing-token';
      req.session.csrfTokenTimestamp = Date.now();
      
      const token = getCsrfToken(req);
      
      expect(token).toEqual('existing-token');
    });
    
    it('should refresh token if it is expired', () => {
      const req = createMockRequest();
      req.session.csrfToken = 'expired-token';
      req.session.csrfTokenTimestamp = Date.now() - (31 * 60 * 1000); // 31 minutes old
      
      const token = getCsrfToken(req);
      
      expect(token).not.toEqual('expired-token');
      expect(req.session.csrfToken).toEqual(token);
    });
  });
  
  describe('validateCsrfToken', () => {
    it('should return true for valid token', () => {
      const req = createMockRequest();
      req.session.csrfToken = 'valid-token';
      
      const isValid = validateCsrfToken(req, 'valid-token');
      
      expect(isValid).toBe(true);
    });
    
    it('should return false for invalid token', () => {
      const req = createMockRequest();
      req.session.csrfToken = 'valid-token';
      
      const isValid = validateCsrfToken(req, 'invalid-token');
      
      expect(isValid).toBe(false);
    });
    
    it('should return false if token is missing from session', () => {
      const req = createMockRequest();
      
      const isValid = validateCsrfToken(req, 'any-token');
      
      expect(isValid).toBe(false);
    });
  });
  
  describe('csrfTokenMiddleware', () => {
    it('should add token to response locals and headers', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();
      
      csrfTokenMiddleware(req, res, next);
      
      expect(typeof res.locals.csrfToken).toBe('string');
      expect(res.headers['x-csrf-token']).toEqual(res.locals.csrfToken);
      expect(next).toHaveBeenCalled();
    });
  });
  
  describe('csrfProtection', () => {
    it('should allow GET requests without token', () => {
      const req = createMockRequest();
      req.method = 'GET';
      const res = createMockResponse();
      const next = jest.fn();
      
      csrfProtection(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    it('should block POST requests without token', () => {
      const req = createMockRequest();
      req.method = 'POST';
      const res = createMockResponse();
      const next = jest.fn();
      
      csrfProtection(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'CSRF token missing' });
      expect(next).not.toHaveBeenCalled();
    });
    
    it('should block POST requests with invalid token', () => {
      const req = createMockRequest();
      req.method = 'POST';
      req.headers['x-csrf-token'] = 'invalid-token';
      req.session.csrfToken = 'valid-token';
      const res = createMockResponse();
      const next = jest.fn();
      
      csrfProtection(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'CSRF token invalid' });
      expect(next).not.toHaveBeenCalled();
    });
    
    it('should allow POST requests with valid token in header', () => {
      const req = createMockRequest();
      req.method = 'POST';
      req.session.csrfToken = 'valid-token';
      req.headers['x-csrf-token'] = 'valid-token';
      const res = createMockResponse();
      const next = jest.fn();
      
      csrfProtection(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    it('should allow POST requests with valid token in body', () => {
      const req = createMockRequest();
      req.method = 'POST';
      req.session.csrfToken = 'valid-token';
      req.body._csrf = 'valid-token';
      const res = createMockResponse();
      const next = jest.fn();
      
      csrfProtection(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});