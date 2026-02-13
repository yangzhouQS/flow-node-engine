import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Observable } from 'rxjs';
import { DataSource, QueryRunner } from 'typeorm';

/**
 * 事务拦截器
 * 自动管理数据库事务，确保数据一致性
 */
@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TransactionInterceptor.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // 将 QueryRunner 存储到请求上下文中
    const request = context.switchToHttp().getRequest();
    request.queryRunner = queryRunner;

    this.logger.debug('Transaction started');

    try {
      const result = await next.handle();

      // 提交事务
      await queryRunner.commitTransaction();
      this.logger.debug('Transaction committed');

      return result;
    } catch (error) {
      // 回滚事务
      await queryRunner.rollbackTransaction();
      this.logger.error('Transaction rolled back', error.stack);

      throw error;
    } finally {
      // 释放 QueryRunner
      await queryRunner.release();
      this.logger.debug('QueryRunner released');
    }
  }
}
