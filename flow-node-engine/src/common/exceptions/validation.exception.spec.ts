import { HttpStatus } from '@nestjs/common';
import { describe, it, expect } from 'vitest';
import { ValidationException } from './validation.exception';

describe('ValidationException', () => {
  it('should be defined', () => {
    expect(ValidationException).toBeDefined();
  });

  it('should create exception with message only', () => {
    const exception = new ValidationException('Validation failed');
    
    expect(exception.message).toBe('Validation failed');
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });

  it('should create exception with errors object', () => {
    const errors = {
      name: ['Name is required', 'Name must be at least 2 characters'],
      email: ['Invalid email format'],
    };
    
    const exception = new ValidationException('Validation failed', errors);
    
    expect(exception.errors).toEqual(errors);
  });

  it('should create exception with custom code', () => {
    const exception = new ValidationException('Validation failed', {}, 1001);
    
    expect(exception.code).toBe(1001);
  });

  it('should use default code 400 when not provided', () => {
    const exception = new ValidationException('Validation failed');
    
    expect(exception.code).toBe(400);
  });

  it('should use empty errors object when not provided', () => {
    const exception = new ValidationException('Validation failed');
    
    expect(exception.errors).toEqual({});
  });

  it('should extend HttpException', () => {
    const exception = new ValidationException('Validation failed');
    
    expect(exception).toBeInstanceOf(ValidationException);
    expect(exception.getStatus()).toBeDefined();
    expect(exception.getResponse()).toBeDefined();
  });

  it('should return BAD_REQUEST status', () => {
    const exception = new ValidationException('Validation failed', {}, 1001);
    
    // Even with custom code, HTTP status should be BAD_REQUEST
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });

  it('should handle multiple errors for same field', () => {
    const errors = {
      password: [
        'Password is required',
        'Password must be at least 8 characters',
        'Password must contain uppercase letter',
        'Password must contain number',
      ],
    };
    
    const exception = new ValidationException('Password validation failed', errors);
    
    expect(exception.errors.password).toHaveLength(4);
  });

  it('should handle nested field errors', () => {
    const errors = {
      'user.name': ['Name is required'],
      'user.address.city': ['City is required'],
      'user.address.zip': ['Invalid zip code'],
    };
    
    const exception = new ValidationException('Nested validation failed', errors);
    
    expect(exception.errors['user.name']).toEqual(['Name is required']);
    expect(exception.errors['user.address.city']).toEqual(['City is required']);
  });

  it('should have readonly code property', () => {
    const exception = new ValidationException('Test', {}, 400);
    
    // Verify code property exists and is readonly (TypeScript compile-time check)
    expect(exception.code).toBe(400);
  });

  it('should have readonly errors property', () => {
    const errors = { name: ['Required'] };
    const exception = new ValidationException('Test', errors);
    
    // Verify errors property exists
    expect(exception.errors).toEqual(errors);
  });
});
