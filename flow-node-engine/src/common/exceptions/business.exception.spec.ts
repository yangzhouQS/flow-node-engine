import { describe, it, expect } from 'vitest';
import { BusinessException, ErrorDetail } from './business.exception';
import { HttpStatus } from '@nestjs/common';

describe('BusinessException', () => {
  it('should be defined', () => {
    expect(BusinessException).toBeDefined();
  });

  it('should create exception with message only', () => {
    const exception = new BusinessException('Test business error');
    
    expect(exception.message).toBe('Test business error');
    expect(exception.getStatus()).toBe(HttpStatus.OK);
  });

  it('should create exception with custom code', () => {
    const exception = new BusinessException('Test error', 1001);
    
    const response = exception.getResponse() as any;
    expect(response.code).toBe(1001);
    expect(response.message).toBe('Test error');
  });

  it('should create exception with error details', () => {
    const details: ErrorDetail[] = [
      { field: 'name', message: 'Name is required' },
      { field: 'email', message: 'Invalid email format' },
    ];
    
    const exception = new BusinessException('Validation failed', 1001, details);
    
    const response = exception.getResponse() as any;
    expect(response.details).toEqual(details);
  });

  it('should use default code when not provided', () => {
    const exception = new BusinessException('Test error');
    
    const response = exception.getResponse() as any;
    // Default code should be ERROR_CODE.BUSINESS_ERROR
    expect(response.code).toBeDefined();
  });

  it('should include timestamp in response', () => {
    const beforeTime = Date.now();
    const exception = new BusinessException('Test error');
    const afterTime = Date.now();
    
    const response = exception.getResponse() as any;
    expect(response.timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(response.timestamp).toBeLessThanOrEqual(afterTime);
  });

  it('should return empty details array when not provided', () => {
    const exception = new BusinessException('Test error', 1001);
    
    const response = exception.getResponse() as any;
    expect(response.details).toEqual([]);
  });

  it('should handle error details without field', () => {
    const details: ErrorDetail[] = [
      { message: 'General error without specific field' },
    ];
    
    const exception = new BusinessException('Error', 1001, details);
    
    const response = exception.getResponse() as any;
    expect(response.details[0].message).toBe('General error without specific field');
    expect(response.details[0].field).toBeUndefined();
  });

  it('should extend HttpException', () => {
    const exception = new BusinessException('Test error');
    
    expect(exception).toBeInstanceOf(BusinessException);
    expect(exception.getStatus()).toBeDefined();
    expect(exception.getResponse()).toBeDefined();
  });

  it('should return HTTP 200 status for unified response format', () => {
    const exception = new BusinessException('Business error', 5000);
    
    // Even with error code 5000, HTTP status should be 200
    expect(exception.getStatus()).toBe(HttpStatus.OK);
  });
});
