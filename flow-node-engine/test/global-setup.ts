/**
 * E2E 测试全局设置文件
 * 在所有测试开始前执行一次（用于数据库初始化等）
 */
import { DataSource } from 'typeorm';

async function globalSetup() {
  console.log('🚀 Starting E2E test global setup...');

  // 创建测试数据库连接
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'test',
    password: process.env.DB_PASSWORD || 'test',
    database: process.env.DB_DATABASE || 'flow_node_engine_test',
    synchronize: true,
    dropSchema: true, // 每次测试前清空数据库
    entities: ['src/**/*.entity.ts'],
  });

  try {
    // 连接数据库
    await dataSource.initialize();
    console.log('✅ Test database connected successfully');

    // 同步数据库结构
    await dataSource.synchronize(true);
    console.log('✅ Test database schema synchronized');

    // 关闭连接
    await dataSource.destroy();
    console.log('✅ Test database connection closed');
  } catch (error) {
    console.error('❌ Failed to setup test database:', error);
    throw error;
  }

  console.log('🎉 E2E test global setup completed');
}

export default globalSetup;
