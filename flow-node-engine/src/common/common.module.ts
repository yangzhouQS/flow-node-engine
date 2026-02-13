import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

// 导入拦截器
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { ValidationExceptionFilter } from './filters/validation-exception.filter';
import { CacheInterceptor } from './interceptors/cache.interceptor';
import { ExceptionInterceptor } from './interceptors/exception.interceptor';
import { LoggerInterceptor } from './interceptors/logger.interceptor';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { TransactionInterceptor } from './interceptors/transaction.interceptor';

// 导入过滤器

// 导入中间件
// import { LoggerMiddleware } from './middlewares/logger.middleware';
// import { RequestIdMiddleware } from './middlewares/request-id.middleware';

// 导入服务
import { LoggerService } from './services/logger.service';

@Global()
@Module({
  providers: [
    // 拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggerInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ExceptionInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransactionInterceptor,
    },

    // 过滤器
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: ValidationExceptionFilter,
    },

    // 服务
    LoggerService,
  ],
  exports: [
    LoggerService,
  ],
})
export class CommonModule {}
