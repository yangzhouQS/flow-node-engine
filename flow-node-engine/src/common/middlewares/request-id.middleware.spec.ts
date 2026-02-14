import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequestIdMiddleware } from './request-id.middleware';
import { Request, Response } from 'express';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    mockRequest = {} as Request;
    mockResponse = {
      setHeader: vi.fn(),
    } as unknown as Response;
    mockNext = vi.fn();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should call next() function', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should generate a request ID', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(mockRequest['requestId']).toBeDefined();
    expect(typeof mockRequest['requestId']).toBe('string');
  });

  it('should set X-Request-ID header in response', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      expect.any(String)
    );
  });

  it('should generate valid UUID v4 format', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    
    const requestId = mockRequest['requestId'];
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    expect(requestId).toMatch(uuidV4Regex);
  });

  it('should set same request ID in both request and response', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    
    const requestId = mockRequest['requestId'];
    const setHeaderCalls = (mockResponse.setHeader as vi.Mock).mock.calls;
    
    expect(setHeaderCalls[0][1]).toBe(requestId);
  });

  it('should generate unique request IDs for each request', () => {
    const requestIds: string[] = [];
    
    for (let i = 0; i < 10; i++) {
      const req = {} as Request;
      const res = { setHeader: vi.fn() } as unknown as Response;
      const next = vi.fn();
      
      middleware.use(req, res, next);
      requestIds.push(req['requestId']);
    }
    
    const uniqueIds = new Set(requestIds);
    expect(uniqueIds.size).toBe(10);
  });
});
