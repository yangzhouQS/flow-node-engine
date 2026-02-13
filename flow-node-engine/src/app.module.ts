import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as redisStore from 'cache-manager-redis-store';

// 导入业务模块
import { CommonModule } from './common/common.module';
import { ProcessEngineCoreModule } from './core/core.module';
import { EventModule } from './event/event.module';
import { FormModule } from './form/form.module';
import { HistoryModule } from './history/history.module';
import { IdentityModule } from './identity/identity.module';
import { ProcessDefinitionModule } from './process-definition/process-definition.module';
import { ProcessInstanceModule } from './process-instance/process-instance.module';
import { TaskModule } from './task/task.module';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),

    // TypeORM 数据库模块
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST'),
        port: parseInt(configService.get('DB_PORT')),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
        timezone: '+08:00',
        charset: 'utf8mb4',
        extra: {
          connectionLimit: 10,
        },
      }),
      inject: [ConfigService],
    }),

    // Redis 缓存模块
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST'),
        port: parseInt(configService.get('REDIS_PORT')),
        password: configService.get('REDIS_PASSWORD'),
        ttl: parseInt(configService.get('CACHE_TTL', '3600')),
      }),
      inject: [ConfigService],
    }),

    // 定时任务模块
    ScheduleModule.forRoot(),

    // 消息队列模块
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('BULL_REDIS_HOST'),
          port: parseInt(configService.get('BULL_REDIS_PORT')),
          password: configService.get('BULL_REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),

    // 业务模块
    CommonModule,
    ProcessEngineCoreModule,
    ProcessDefinitionModule,
    ProcessInstanceModule,
    TaskModule,
    HistoryModule,
    IdentityModule,
    FormModule,
    EventModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {
  constructor(private readonly configService: ConfigService) {
    console.log('Application is starting...');
    console.log('Environment:', this.configService.get('NODE_ENV'));
  }
}
