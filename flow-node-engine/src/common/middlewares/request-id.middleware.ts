import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // 生成请求 ID
    const requestId = uuidv4();
    
    // 添加到请求对象
    req['requestId'] = requestId;
    
    // 添加到响应头
    res.setHeader('X-Request-ID', requestId);
    
    next();
  }
}
