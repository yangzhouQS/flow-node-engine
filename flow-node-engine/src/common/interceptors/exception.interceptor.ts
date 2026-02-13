import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { BusinessException } from '../exceptions/business.exception';

/**
 * 异常拦截器
 * 捕获服务层抛出的异常，统一处理
 */
@Injectable()
export class ExceptionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ExceptionInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // 记录异常日志
        this.logger.error(
          `Exception caught: ${error.message}`,
          error.stack,
        );

        // 如果是业务异常，直接抛出
        if (error instanceof BusinessException) {
          return throwError(() => error);
        }

        // 其他异常转换为业务异常
        return throwError(() => {
          if (error.status) {
            // HTTP 异常
            return new BusinessException(
              error.message || '请求失败',
              error.status,
              error.response?.code || error.status,
            );
          }
          // 未知异常
          return new BusinessException(
            '服务器内部错误',
            500,
          );
        });
      }),
    );
  }
}
