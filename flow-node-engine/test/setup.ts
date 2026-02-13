/**
 * 单元测试全局设置文件
 * 在每个测试文件运行前执行
 */
import { vi } from 'vitest';

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3306';
process.env.DB_USERNAME = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_DATABASE = 'flow_node_engine_test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_EXPIRATION = '3600';

// Mock console 方法（可选，减少测试输出噪音）
// global.console = {
//   ...console,
//   log: vi.fn(),
//   debug: vi.fn(),
//   info: vi.fn(),
// };

// 全局超时设置
vi.setConfig({
  testTimeout: 10000,
  hookTimeout: 10000,
});

// 清理所有 mock
afterEach(() => {
  vi.clearAllMocks();
});

// 清理所有 timer
afterEach(() => {
  vi.useRealTimers();
});
