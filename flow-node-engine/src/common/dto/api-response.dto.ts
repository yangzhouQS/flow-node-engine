// 统一API响应格式
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
  total?: number;
}

// API响应DTO类
export class ApiResponseDto<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
  total?: number;

  constructor(code: number, message: string, data?: T, total?: number) {
    this.code = code;
    this.message = message;
    this.data = data as T;
    this.timestamp = Date.now();
    if (total !== undefined) {
      this.total = total;
    }
  }

  /**
   * 创建成功响应
   */
  static success<T>(data: T, message = 'Success'): ApiResponseDto<T> {
    return new ApiResponseDto<T>(0, message, data);
  }

  /**
   * 创建错误响应
   */
  static error<T>(message: string, code = -1, data?: T): ApiResponseDto<T> {
    return new ApiResponseDto<T>(code, message, data);
  }

  /**
   * 创建分页响应
   */
  static page<T>(items: T[], total: number, message = 'Success'): ApiResponseDto<T[]> {
    const response = new ApiResponseDto<T[]>(0, message, items);
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
