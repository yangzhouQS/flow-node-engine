import { HttpException, HttpStatus , ArgumentsHost } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlobalExceptionFilter } from './global-exception.filter';


describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockHost: ArgumentsHost;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    
    mockRequest = {
      url: '/api/test',
      method: 'POST',
      requestId: 'test-request-id',
    };
    
    mockHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;
    
    // Mock logger
    vi.spyOn(filter['logger'], 'error').mockImplementation(() => {});
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('HttpException handling', () => {
    it('should handle HttpException with default response', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      
      filter.catch(exception, mockHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: HttpStatus.BAD_REQUEST,
          message: 'Test error',
          data: null,
        })
      );
    });

    it('should handle HttpException with custom response object', () => {
      const exception = new HttpException(
        {
          code: 1001,
          message: 'Custom error message',
          data: { field: 'test' },
        },
        HttpStatus.BAD_REQUEST
      );
      
      filter.catch(exception, mockHost);
      
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 1001,
          message: 'Custom error message',
          data: { field: 'test' },
        })
      );
    });

    it('should log error for HttpException', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      const loggerSpy = vi.spyOn(filter['logger'], 'error');
      
      filter.catch(exception, mockHost);
      
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('non-HttpException handling', () => {
    it('should handle generic Error', () => {
      const exception = new Error('Generic error');
      
      filter.catch(exception, mockHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 500,
          message: '服务器内部错误',
          data: null,
        })
      );
    });

    it('should handle unknown exception type', () => {
      const exception = 'Unknown error string';
      
      filter.catch(exception, mockHost);
      
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 500,
          message: '服务器内部错误',
        })
      );
    });

    it('should log error with stack trace for non-HttpException', () => {
      const exception = new Error('Generic error');
      const loggerSpy = vi.spyOn(filter['logger'], 'error');
      
      filter.catch(exception, mockHost);
      
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/test',
          method: 'POST',
          error: exception,
        })
      );
    });
  });

  it('should include timestamp in response', () => {
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
    
    filter.catch(exception, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(Number),
      })
    );
  });
});
