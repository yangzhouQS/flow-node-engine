import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 区分业务异常和系统异常
    if (exception instanceof HttpException) {
      const res = exception.getResponse() as any;
      
      // 记录日志
      this.logger.error({
        url: request.url,
        method: request.method,
        error: res,
        requestId: request['requestId'],
      });

      response.status(200).json({
        code: res.code || exception.getStatus(),
        message: res.message || exception.message,
        data: res.data || null,
        timestamp: Date.now(),
      });
    } else {
      // 系统异常
      this.logger.error({
        url: request.url,
        method: request.method,
        error: exception,
        requestId: request['requestId'],
        stack: (exception as Error).stack,
      });

      response.status(200).json({
        code: 500,
        message: '服务器内部错误',
        data: null,
        timestamp: Date.now(),
      });
    }
  }
}
