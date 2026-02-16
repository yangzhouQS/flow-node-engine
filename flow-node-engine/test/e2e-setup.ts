/**
 * E2E 测试设置文件
 * 在每个 E2E 测试文件运行前执行
 */
import { vi } from 'vitest';

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.TEST_DB_HOST || 'localhost';
process.env.DB_PORT = process.env.TEST_DB_PORT || '3306';
process.env.DB_USERNAME = process.env.TEST_DB_USERNAME || 'root';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'root';
process.env.DB_DATABASE = process.env.TEST_DB_DATABASE || 'flow_node_engine_test';
process.env.REDIS_HOST = process.env.TEST_REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.TEST_REDIS_PORT || '6379';
process.env.JWT_SECRET = 'e2e-test-jwt-secret-key';
process.env.JWT_EXPIRATION = '3600';
process.env.PORT = '3001'; // 使用不同的端口避免冲突

// 全局超时设置（E2E 测试需要更长的超时时间）
vi.setConfig({
  testTimeout: 30000,
  hookTimeout: 30000,
});

// 清理所有 mock
afterEach(() => {
  vi.clearAllMocks();
});

// 清理所有 timer
afterEach(() => {
  vi.useRealTimers();
});
