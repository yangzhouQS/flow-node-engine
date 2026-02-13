// 应用常量
export const APP_NAME = 'flow-node-engine';
export const APP_VERSION = '1.0.0';

// 缓存相关常量
export const CACHE_TTL = 3600; // 默认缓存过期时间（秒）
export const CACHE_KEY_PREFIX = 'flow:';

// 分页相关常量
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// HTTP 状态码
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// 业务错误码
export const ERROR_CODE = {
  SUCCESS: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  VALIDATION_ERROR: 1001,
  BUSINESS_ERROR: 1002,
  PROCESS_DEFINITION_NOT_FOUND: 2001,
  PROCESS_INSTANCE_NOT_FOUND: 2002,
  TASK_NOT_FOUND: 2003,
  USER_NOT_FOUND: 3001,
  INVALID_PASSWORD: 3002,
  TOKEN_EXPIRED: 3003,
  TOKEN_INVALID: 3004,
} as const;

// 暂停状态
export const SUSPENSION_STATE = {
  ACTIVE: 1,
  SUSPENDED: 2,
} as const;

// 任务优先级
export const TASK_PRIORITY = {
  LOW: 0,
  NORMAL: 50,
  HIGH: 100,
} as const;

// 历史清理配置
export const HISTORY_CLEANUP_CONFIG = {
  DEFAULT_DAYS_TO_KEEP: 90,
  DEFAULT_BATCH_SIZE: 1000,
} as const;
