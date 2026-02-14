import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResponseInterceptor } from './response.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<any>;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
    
    mockExecutionContext = {
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({}),
        getResponse: vi.fn().mockReturnValue({}),
      }),
    } as any;
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should transform response with default values', async () => {
    mockCallHandler = {
      handle: () => of({ name: 'test' }),
    } as any;

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);
    const result = await firstValueFrom(result$);
    
    expect(result).toEqual({
      code: 200,
      message: '操作成功',
      data: { name: 'test' },
      timestamp: expect.any(Number),
    });
  });

  it('should handle null data', async () => {
    mockCallHandler = {
      handle: () => of(null),
    } as any;

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);
    const result = await firstValueFrom(result$);
    
    expect(result).toEqual({
      code: 200,
      message: '操作成功',
      data: null,
      timestamp: expect.any(Number),
    });
  });

  it('should handle undefined data', async () => {
    mockCallHandler = {
      handle: () => of(undefined),
    } as any;

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);
    const result = await firstValueFrom(result$);
    
    expect(result.data).toBeNull();
  });

  it('should handle array data', async () => {
    const arrayData = [1, 2, 3];
    mockCallHandler = {
      handle: () => of(arrayData),
    } as any;

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);
    const result = await firstValueFrom(result$);
    
    expect(result.data).toEqual(arrayData);
  });

  it('should handle complex object data', async () => {
    const complexData = {
      user: {
        id: 1,
        name: 'test',
        roles: ['admin', 'user'],
      },
      metadata: {
        total: 100,
        page: 1,
      },
    };
    mockCallHandler = {
      handle: () => of(complexData),
    } as any;

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);
    const result = await firstValueFrom(result$);
    
    expect(result.data).toEqual(complexData);
  });

  it('should include timestamp in response', async () => {
    const beforeTime = Date.now();
    mockCallHandler = {
      handle: () => of({}),
    } as any;

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);
    const result = await firstValueFrom(result$);
    const afterTime = Date.now();
    
    expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(result.timestamp).toBeLessThanOrEqual(afterTime);
  });
});
