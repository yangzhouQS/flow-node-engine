/**
 * 测试工具函数
 * 提供常用的测试辅助函数
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { vi } from 'vitest';

/**
 * 创建测试用的 NestJS 应用
 * @param moduleFixture 测试模块
 * @param options 配置选项
 */
export async function createTestApp(
  moduleFixture: TestingModule,
  options: {
    useValidationPipe?: boolean;
    useGlobalPrefix?: string;
  } = {},
): Promise<INestApplication> {
  const app = moduleFixture.createNestApplication();

  if (options.useValidationPipe !== false) {
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
  }

  if (options.useGlobalPrefix) {
    app.setGlobalPrefix(options.useGlobalPrefix);
  }

  await app.init();
  return app;
}

/**
 * 创建内存数据库配置（用于单元测试）
 */
export function createInMemoryDbConfig() {
  return {
    type: 'better-sqlite3' as const,
    database: ':memory:',
    synchronize: true,
    dropSchema: true,
    entities: ['src/**/*.entity.ts'],
  };
}

/**
 * 创建测试用的 TypeORM 配置
 */
export function createTestTypeOrmModule(entities: any[] = []) {
  return TypeOrmModule.forRootAsync({
    imports: [ConfigModule],
    useFactory: (configService: ConfigService) => ({
      type: 'mysql',
      host: configService.get('DB_HOST', 'localhost'),
      port: configService.get('DB_PORT', 3306),
      username: configService.get('DB_USERNAME', 'test'),
      password: configService.get('DB_PASSWORD', 'test'),
      database: configService.get('DB_DATABASE', 'flow_node_engine_test'),
      synchronize: true,
      dropSchema: true,
      entities: entities.length > 0 ? entities : ['src/**/*.entity.ts'],
    }),
    inject: [ConfigService],
  });
}

/**
 * 清空数据库表
 * @param dataSource 数据源
 * @param tableNames 表名列表
 */
export async function truncateTables(
  dataSource: DataSource,
  tableNames: string[],
): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    await queryRunner.startTransaction();
    for (const tableName of tableNames) {
      await queryRunner.query(`TRUNCATE TABLE ${tableName}`);
    }
    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

/**
 * 生成随机字符串
 * @param length 长度
 */
export function randomString(length: number = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成随机 UUID
 */
export function randomUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 等待指定毫秒数
 * @param ms 毫秒数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 创建 Mock 服务
 * @param methods 要 mock 的方法列表
 */
export function createMockService<T extends object>(methods: (keyof T)[]): T {
  const mock: any = {};
  for (const method of methods) {
    mock[method] = vi.fn();
  }
  return mock as T;
}

/**
 * 测试数据构建器基类
 */
export abstract class TestDataBuilder<T> {
  protected data: Partial<T> = {};

  abstract build(): T;

  with<K extends keyof T>(key: K, value: T[K]): this {
    this.data[key] = value;
    return this;
  }
}
