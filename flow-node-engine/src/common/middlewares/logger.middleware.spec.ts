import { Request, Response } from 'express';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { LoggerMiddleware } from './logger.middleware';

describe('LoggerMiddleware', () => {
  let middleware: LoggerMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: Mock;

  beforeEach(() => {
    middleware = new LoggerMiddleware();
    mockRequest = {
      method: 'GET',
      originalUrl: '/api/test',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
        'x-request-id': 'test-request-id',
      },
      get: vi.fn().mockReturnValue('test-agent'),
    } as any;
    
    mockResponse = {
      statusCode: 200,
      on: vi.fn(),
      get: vi.fn().mockReturnValue('100'),
    } as any;
    
    mockNext = vi.fn();
    
    // Mock Logger
    vi.spyOn(middleware['logger'], 'log').mockImplementation(() => {});
    vi.spyOn(middleware['logger'], 'error').mockImplementation(() => {});
    vi.spyOn(middleware['logger'], 'warn').mockImplementation(() => {});
    vi.spyOn(middleware['logger'], 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should call next() function', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should register finish event listener on response', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockResponse.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  describe('response logging', () => {
    it('should log successful response (2xx)', () => {
      const loggerSpy = vi.spyOn(middleware['logger'], 'log');
      
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Simulate finish event
      const finishCallback = (mockResponse.on as Mock).mock.calls.find(
        (call: any[]) => call[0] === 'finish'
      )?.[1];
      
      if (finishCallback) {
        finishCallback();
      }
      
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should log warning for client error (4xx)', () => {
      mockResponse.statusCode = 400;
      const warnSpy = vi.spyOn(middleware['logger'], 'warn');
      
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      
      const finishCallback = (mockResponse.on as Mock).mock.calls.find(
        (call: any[]) => call[0] === 'finish'
      )?.[1];
      
      if (finishCallback) {
        finishCallback();
      }
      
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should log error for server error (5xx)', () => {
      mockResponse.statusCode = 500;
      const errorSpy = vi.spyOn(middleware['logger'], 'error');
      
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      
      const finishCallback = (mockResponse.on as Mock).mock.calls.find(
        (call: any[]) => call[0] === 'finish'
      )?.[1];
      
      if (finishCallback) {
        finishCallback();
      }
      
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  it('should handle missing user-agent header', () => {
    mockRequest.headers = {};
    mockRequest.get = vi.fn().mockReturnValue(undefined);
    
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle missing x-request-id header', () => {
    mockRequest.headers = { 'user-agent': 'test-agent' };
    
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
  });
});
