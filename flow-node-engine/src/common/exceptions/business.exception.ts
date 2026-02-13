import { HttpException, HttpStatus } from '@nestjs/common';

import { ERROR_CODE } from '../constants';

export interface ErrorDetail {
  field?: string;
  message: string;
}

export class BusinessException extends HttpException {
  constructor(
    message: string,
    code: number = ERROR_CODE.BUSINESS_ERROR,
    details?: ErrorDetail[],
  ) {
    super(
      {
        code,
        message,
        details: details || [],
        timestamp: Date.now(),
      },
      HttpStatus.OK, // 统一返回200，通过code区分错误
    );
  }
}
