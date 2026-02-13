// 统一API响应格式
export interface ApiResponse<T = {
  code: number;
  message: string;
  data: T;
  timestamp: number;
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
