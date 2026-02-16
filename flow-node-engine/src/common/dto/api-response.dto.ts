import { ApiProperty } from '@nestjs/swagger';

// 统一API响应格式
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
  total?: number;
}

// API响应DTO类- 使用 any 类型避免 Swagger 循环依赖问题
export class ApiResponseDto {
  @ApiProperty({ description: '响应码', example: 0 })
  code: number;

  @ApiProperty({ description: '响应消息', example: 'Success' })
  message: string;

  @ApiProperty({ description: '响应数据' })
  data: any;

  @ApiProperty({ description: '时间戳' })
  timestamp: number;

  @ApiProperty({ description: '总数（分页时使用）', required: false })
  total?: number;

  constructor(code: number, message: string, data?: any, total?: number) {
    this.code = code;
    this.message = message;
    this.data = data;
    this.timestamp = Date.now();
    if (total !== undefined) {
      this.total = total;
    }
  }

  /**
   * 创建成功响应
   */
  static success<T>(data: T, message = 'Success'): ApiResponseDto {
    return new ApiResponseDto(0, message, data);
  }

  /**
   * 创建错误响应
   */
  static error(message: string, code = -1, data?: any): ApiResponseDto {
    return new ApiResponseDto(code, message, data);
  }

  /**
   * 创建分页响应
   */
  static page<T>(items: T[], total: number, message = 'Success'): ApiResponseDto {
    const response = new ApiResponseDto(0, message, items);
    response.total = total;
    return response;
  }
}

// 分页请求格式
export interface PageQuery {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// 分页响应格式
export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 错误详情
export interface ErrorDetail {
  field?: string;
  message: string;
}
