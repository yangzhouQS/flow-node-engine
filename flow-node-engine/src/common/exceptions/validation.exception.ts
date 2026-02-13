import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 参数验证异常
 * 用于处理参数验证失败的情况
 */
export class ValidationException extends HttpException {
  readonly code: number;
  readonly errors: Record<string, string[]>;

  constructor(
    message: string,
    errors: Record<string, string[]> = {},
    code = 400,
  ) {
    super(message, HttpStatus.BAD_REQUEST);
    this.code = code;
    this.errors = errors;
  }
}
