import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export const CACHE_KEY_METADATA = 'cacheKey';
export const CACHE_TTL_METADATA = 'cacheTtl';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    // 获取缓存元数据
    const cacheKey = this.reflector.get<string>(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );
    const cacheTtl = this.reflector.get<number>(
      CACHE_TTL_METADATA,
      context.getHandler(),
    );

    if (!cacheKey) {
      // 没有缓存键，直接执行
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const cacheManager = request.cacheManager;

    // 先从缓存获取
    return cacheManager.get(cacheKey).then(cachedValue => {
      if (cachedValue) {
        // 缓存命中
        return cachedValue;
      }

      // 缓存未命中，执行方法
      return next.handle().pipe(
        tap(response => {
          // 写入缓存
          cacheManager.set(cacheKey, response, { ttl: cacheTtl || 3600 });
        }),
      );
    });
  }
}

// 缓存装饰器
export const Cache = (key: string, ttl?: number) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(CACHE_KEY_METADATA, key, descriptor.value);
    if (ttl !== undefined) {
      Reflect.defineMetadata(CACHE_TTL_METADATA, ttl, descriptor.value);
    }
    return descriptor;
  };
};
