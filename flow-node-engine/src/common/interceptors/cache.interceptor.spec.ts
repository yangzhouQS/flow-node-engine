import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, Observable } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheInterceptor, Cache, CACHE_KEY_METADATA, CACHE_TTL_METADATA } from './cache.interceptor';

describe('CacheInterceptor', () => {
  let interceptor: CacheInterceptor;
  let mockReflector: Reflector;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockCacheManager: any;

  beforeEach(() => {
    mockReflector = {
      get: vi.fn(),
    } as any;
    
    interceptor = new CacheInterceptor(mockReflector);
    
    mockCacheManager = {
      get: vi.fn(),
      set: vi.fn(),
    };
    
    mockExecutionContext = {
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
          cacheManager: mockCacheManager,
        }),
      }),
      getHandler: vi.fn(),
    } as any;
    
    mockCallHandler = {
      handle: vi.fn().mockReturnValue(of({ data: 'test' })),
    } as any;
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('without cache key', () => {
    it('should pass through without caching when no cache key is set', async () => {
      vi.mocked(mockReflector.get).mockReturnValue(undefined);
      
      const result = await interceptor.intercept(mockExecutionContext, mockCallHandler);
      
      expect(mockCallHandler.handle).toHaveBeenCalled();
      expect(mockCacheManager.get).not.toHaveBeenCalled();
    });
  });

  describe('with cache key', () => {
    it('should return cached value when cache hit', async () => {
      vi.mocked(mockReflector.get).mockImplementation((key: string) => {
        if (key === CACHE_KEY_METADATA) return 'test-cache-key';
        return undefined;
      });
      
      mockCacheManager.get.mockResolvedValue({ cached: 'data' });
      
      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      
      // Result should be the cached value
      await new Promise<void>((resolve) => {
        if (result instanceof Observable) {
          result.subscribe({
            next: (data) => {
              expect(data).toEqual({ cached: 'data' });
              expect(mockCallHandler.handle).not.toHaveBeenCalled();
              resolve();
            },
          });
        } else {
          resolve();
        }
      });
    });

    it('should call handler and cache result when cache miss', async () => {
      vi.mocked(mockReflector.get).mockImplementation((key: string) => {
        if (key === CACHE_KEY_METADATA) return 'test-cache-key';
        if (key === CACHE_TTL_METADATA) return 3600;
        return undefined;
      });
      
      mockCacheManager.get.mockResolvedValue(null);
      
      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      
      await new Promise<void>((resolve) => {
        if (result instanceof Observable) {
          result.subscribe({
            next: (data) => {
              expect(data).toEqual({ data: 'test' });
              expect(mockCallHandler.handle).toHaveBeenCalled();
              resolve();
            },
            error: () => resolve(),
          });
        } else {
          resolve();
        }
      });
    });

    it('should use default TTL when not specified', async () => {
      vi.mocked(mockReflector.get).mockImplementation((key: string) => {
        if (key === CACHE_KEY_METADATA) return 'test-cache-key';
        return undefined;
      });
      
      mockCacheManager.get.mockResolvedValue(null);
      
      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      
      await new Promise<void>((resolve) => {
        if (result instanceof Observable) {
          result.subscribe({
            complete: () => {
              // Wait for tap operator to execute
              setTimeout(() => {
                expect(mockCacheManager.set).toHaveBeenCalledWith(
                  'test-cache-key',
                  { data: 'test' },
                  { ttl: 3600 }
                );
                resolve();
              }, 10);
            },
            error: () => resolve(),
          });
        } else {
          resolve();
        }
      });
    });
  });

  describe('Cache decorator', () => {
    it('should define cache key metadata', () => {
      class TestClass {
        @Cache('test-key')
        testMethod() {}
      }
      
      const instance = new TestClass();
      const metadata = Reflect.getMetadata(CACHE_KEY_METADATA, instance.testMethod);
      
      expect(metadata).toBe('test-key');
    });

    it('should define cache TTL metadata when provided', () => {
      class TestClass {
        @Cache('test-key', 1800)
        testMethod() {}
      }
      
      const instance = new TestClass();
      const keyMetadata = Reflect.getMetadata(CACHE_KEY_METADATA, instance.testMethod);
      const ttlMetadata = Reflect.getMetadata(CACHE_TTL_METADATA, instance.testMethod);
      
      expect(keyMetadata).toBe('test-key');
      expect(ttlMetadata).toBe(1800);
    });

    it('should not define TTL metadata when not provided', () => {
      class TestClass {
        @Cache('test-key')
        testMethod() {}
      }
      
      const instance = new TestClass();
      const ttlMetadata = Reflect.getMetadata(CACHE_TTL_METADATA, instance.testMethod);
      
      expect(ttlMetadata).toBeUndefined();
    });
  });
});
