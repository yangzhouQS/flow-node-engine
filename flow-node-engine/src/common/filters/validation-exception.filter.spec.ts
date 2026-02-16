import { ArgumentsHost } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { ValidationException } from '../exceptions/validation.exception';
import { ValidationExceptionFilter } from './validation-exception.filter';

describe('ValidationExceptionFilter', () => {
  let filter: ValidationExceptionFilter;
  let mockHost: ArgumentsHost;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(() => {
    filter = new ValidationExceptionFilter();
    
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    
    mockRequest = {
      url: '/api/test',
      method: 'POST',
    };
    
    mockHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;
    
    // Mock logger
    vi.spyOn(filter['logger'], 'warn').mockImplementation(() => {});
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should handle ValidationException with errors', () => {
    const errors = {
      name: ['name is required', 'name must be a string'],
      email: ['email must be a valid email'],
    };
    const exception = new ValidationException('Validation failed', errors, 400);
    
    filter.catch(exception, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 400,
        message: 'Validation failed',
        data: null,
        errors: errors,
      })
    );
  });

  it('should handle ValidationException without errors', () => {
    const exception = new ValidationException('Validation failed', {}, 400);
    
    filter.catch(exception, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 400,
        message: 'Validation failed',
        errors: {},
      })
    );
  });

  it('should use custom error code', () => {
    const exception = new ValidationException('Custom validation error', {}, 1001);
    
    filter.catch(exception, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 1001,
      })
    );
  });

  it('should log warning with validation errors', () => {
    const errors = { name: ['name is required'] };
    const exception = new ValidationException('Validation failed', errors);
    const loggerSpy = vi.spyOn(filter['logger'], 'warn');
    
    filter.catch(exception, mockHost);
    
    expect(loggerSpy).toHaveBeenCalledWith(
      'Validation exception: Validation failed',
      expect.objectContaining({
        url: '/api/test',
        method: 'POST',
        errors: errors,
      })
    );
  });

  it('should include path in response', () => {
    const exception = new ValidationException('Validation failed');
    
    filter.catch(exception, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/test',
      })
    );
  });

  it('should include timestamp in ISO format', () => {
    const exception = new ValidationException('Validation failed');
    
    filter.catch(exception, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(String),
      })
    );
    
    const call = (mockResponse.json as Mock).mock.calls[0][0];
    expect(new Date(call.timestamp).toISOString()).toBe(call.timestamp);
  });

  it('should use exception status code for response', () => {
    const exception = new ValidationException('Validation failed', {}, 400);
    
    filter.catch(exception, mockHost);
    
    expect(mockResponse.status).toHaveBeenCalledWith(400);
  });
});
