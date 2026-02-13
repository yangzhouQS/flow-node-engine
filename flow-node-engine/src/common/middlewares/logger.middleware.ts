import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * 日志中间件
 * 记录请求和响应信息
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';
    const requestId = req.headers['x-request-id'] as string || '';

    // 记录请求开始时间
    const startTime = Date.now();

    // 监听响应完成事件
    res.on('finish', () => {
      const { statusCode } = res;
      const responseTime = Date.now() - startTime;
      const contentLength = res.get('content-length');

      // 格式化日志
      const logMessage = `${method} ${originalUrl} ${statusCode} ${responseTime}ms - ${ip} - ${userAgent}`;

      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }

      // 记录详细信息
      this.logger.debug(
        `Request ID: ${requestId}, Content-Length: ${contentLength}`,
      );
    });

    next();
  }
}
