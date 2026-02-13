import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

import { ValidationException } from '../exceptions/validation.exception';

/**
 * 参数验证异常过滤器
 * 捕获并处理参数验证异常
 */
@Catch(ValidationException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: ValidationException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    // 记录异常日志
    this.logger.warn(
      `Validation exception: ${exception.message}`,
      {
        url: request.url,
        method: request.method,
        errors: exception.errors,
      },
    );

    // 返回统一的错误响应
    response.status(exception.getStatus()).json({
      code: exception.code,
      message: exception.message,
      data: null,
      errors: exception.errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
