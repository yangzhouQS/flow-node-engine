import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';

/**
 * 慢查询日志记录接口
 */
export interface SlowQueryLog {
  id: string;
  timestamp: Date;
  query: string;
  parameters?: any[];
  duration: number;
  threshold: number;
  database?: string;
  connection?: string;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

/**
 * 慢查询统计信息
 */
export interface SlowQueryStats {
  totalSlowQueries: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
  queriesByTable: Record<string, number>;
  queriesByOperation: Record<string, number>;
  recentSlowQueries: SlowQueryLog[];
}

/**
 * 慢查询分析配置
 */
export interface SlowQueryConfig {
  enabled: boolean;
  threshold: number; // 慢查询阈值（毫秒）
  logToConsole: boolean;
  logToFile: boolean;
  maxLogSize: number; // 最大日志保留数量
  sampleRate: number; // 采样率 0-1
  excludePatterns: RegExp[]; // 排除的查询模式
  includeStackTraces: boolean;
}

/**
 * 慢查询分析服务
 * 用于监控、记录和分析数据库慢查询
 */
@Injectable()
export class SlowQueryLogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlowQueryLogService.name);
  private slowQueryLogs: SlowQueryLog[] = [];
  private config: SlowQueryConfig;
  private queryListenerAttached = false;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.config = {
      enabled: this.configService.get('SLOW_QUERY_ENABLED', 'true') === 'true',
      threshold: parseInt(this.configService.get('SLOW_QUERY_THRESHOLD', '500'), 10),
      logToConsole: this.configService.get('SLOW_QUERY_LOG_CONSOLE', 'true') === 'true',
      logToFile: this.configService.get('SLOW_QUERY_LOG_FILE', 'false') === 'true',
      maxLogSize: parseInt(this.configService.get('SLOW_QUERY_MAX_LOG_SIZE', '1000'), 10),
      sampleRate: parseFloat(this.configService.get('SLOW_QUERY_SAMPLE_RATE', '1')),
      excludePatterns: this.parseExcludePatterns(),
      includeStackTraces: this.configService.get('SLOW_QUERY_INCLUDE_STACK', 'false') === 'true',
    };
  }

  async onModuleInit(): Promise<void> {
    if (this.config.enabled) {
      this.attachQueryListener();
      this.logger.log(`慢查询监控已启动，阈值: ${this.config.threshold}ms`);
    }
  }

  onModuleDestroy(): void {
    this.detachQueryListener();
    this.logger.log('慢查询监控已停止');
  }

  /**
   * 解析排除模式配置
   */
  private parseExcludePatterns(): RegExp[] {
    const patterns = this.configService.get('SLOW_QUERY_EXCLUDE_PATTERNS', '');
    if (!patterns) {
      return [
        /^SELECT 1$/,  // 健康检查
        /^SHOW/,       // SHOW 命令
        /^SET/,        // SET 命令
      ];
    }
    try {
      return patterns.split(',').map(p => new RegExp(p.trim()));
    } catch {
      return [];
    }
  }

  /**
   * 附加查询监听器
   */
  private attachQueryListener(): void {
    if (this.queryListenerAttached || !this.dataSource.isInitialized) {
      return;
    }

    try {
      // 监听 TypeORM 查询事件
      this.dataSource.logger = new SlowQueryLogger(this);
      this.queryListenerAttached = true;
    } catch (error) {
      this.logger.error(`附加查询监听器失败: ${(error as Error).message}`);
    }
  }

  /**
   * 分离查询监听器
   */
  private detachQueryListener(): void {
    this.queryListenerAttached = false;
  }

  /**
   * 记录慢查询
   */
  logSlowQuery(
    query: string,
    parameters?: any[],
    duration?: number,
    queryRunner?: QueryRunner,
  ): void {
    // 检查采样率
    if (Math.random() > this.config.sampleRate) {
      return;
    }

    // 检查排除模式
    if (this.shouldExclude(query)) {
      return;
    }

    const actualDuration = duration ?? 0;
    
    // 检查是否超过阈值
    if (actualDuration < this.config.threshold) {
      return;
    }

    const logEntry: SlowQueryLog = {
      id: this.generateId(),
      timestamp: new Date(),
      query: this.sanitizeQuery(query),
      parameters: this.sanitizeParameters(parameters),
      duration: actualDuration,
      threshold: this.config.threshold,
      database: queryRunner?.connection?.options?.database as string,
      connection: queryRunner?.connection?.name,
      stackTrace: this.config.includeStackTraces ? this.captureStackTrace() : undefined,
    };

    // 添加到日志列表
    this.addToLogs(logEntry);

    // 输出到控制台
    if (this.config.logToConsole) {
      this.logToConsole(logEntry);
    }

    // 发送事件
    this.eventEmitter.emit('slow_query.detected', logEntry);
  }

  /**
   * 检查查询是否应该被排除
   */
  private shouldExclude(query: string): boolean {
    const normalizedQuery = query.trim().toUpperCase();
    return this.config.excludePatterns.some(pattern => pattern.test(normalizedQuery));
  }

  /**
   * 清理查询字符串
   */
  private sanitizeQuery(query: string): string {
    // 移除多余空白
    return query.replace(/\s+/g, ' ').trim();
  }

  /**
   * 清理参数（移除敏感信息）
   */
  private sanitizeParameters(parameters?: any[]): any[] | undefined {
    if (!parameters || parameters.length === 0) {
      return undefined;
    }

    return parameters.map(param => {
      if (typeof param === 'string' && param.length > 200) {
        return param.substring(0, 200) + '...[truncated]';
      }
      return param;
    });
  }

  /**
   * 捕获调用堆栈
   */
  private captureStackTrace(): string {
    const stack = new Error().stack ?? '';
    const lines = stack.split('\n').slice(3, 8); // 跳过前几行
    return lines.join('\n');
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `sq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 添加日志到列表
   */
  private addToLogs(logEntry: SlowQueryLog): void {
    this.slowQueryLogs.push(logEntry);
    
    // 保持日志大小限制
    if (this.slowQueryLogs.length > this.config.maxLogSize) {
      this.slowQueryLogs = this.slowQueryLogs.slice(-this.config.maxLogSize);
    }
  }

  /**
   * 输出到控制台
   */
  private logToConsole(logEntry: SlowQueryLog): void {
    this.logger.warn(
      `慢查询检测 [${logEntry.duration}ms > ${logEntry.threshold}ms]: ${logEntry.query.substring(0, 200)}${logEntry.query.length > 200 ? '...' : ''}`
    );
  }

  /**
   * 获取慢查询统计信息
   */
  getStats(): SlowQueryStats {
    const logs = this.slowQueryLogs;
    
    if (logs.length === 0) {
      return {
        totalSlowQueries: 0,
        averageDuration: 0,
        maxDuration: 0,
        minDuration: 0,
        queriesByTable: {},
        queriesByOperation: {},
        recentSlowQueries: [],
      };
    }

    const durations = logs.map(l => l.duration);
    const tables = this.extractTables(logs);
    const operations = this.extractOperations(logs);

    return {
      totalSlowQueries: logs.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      queriesByTable: tables,
      queriesByOperation: operations,
      recentSlowQueries: logs.slice(-20).reverse(),
    };
  }

  /**
   * 提取查询涉及的表
   */
  private extractTables(logs: SlowQueryLog[]): Record<string, number> {
    const tables: Record<string, number> = {};
    const tablePatterns = [
      /FROM\s+`?(\w+)`?/gi,
      /JOIN\s+`?(\w+)`?/gi,
      /INTO\s+`?(\w+)`?/gi,
      /UPDATE\s+`?(\w+)`?/gi,
    ];

    for (const log of logs) {
      for (const pattern of tablePatterns) {
        const matches = log.query.matchAll(pattern);
        for (const match of matches) {
          const table = match[1].toLowerCase();
          tables[table] = (tables[table] ?? 0) + 1;
        }
      }
    }

    return tables;
  }

  /**
   * 提取查询操作类型
   */
  private extractOperations(logs: SlowQueryLog[]): Record<string, number> {
    const operations: Record<string, number> = {};
    const operationPatterns = [
      { pattern: /^SELECT/i, name: 'SELECT' },
      { pattern: /^INSERT/i, name: 'INSERT' },
      { pattern: /^UPDATE/i, name: 'UPDATE' },
      { pattern: /^DELETE/i, name: 'DELETE' },
    ];

    for (const log of logs) {
      for (const { pattern, name } of operationPatterns) {
        if (pattern.test(log.query)) {
          operations[name] = (operations[name] ?? 0) + 1;
          break;
        }
      }
    }

    return operations;
  }

  /**
   * 获取最近的慢查询
   */
  getRecentSlowQueries(limit = 50): SlowQueryLog[] {
    return this.slowQueryLogs.slice(-limit).reverse();
  }

  /**
   * 获取指定表的慢查询
   */
  getSlowQueriesByTable(tableName: string): SlowQueryLog[] {
    const tablePattern = new RegExp(`(FROM|JOIN|INTO|UPDATE)\\s+\`?${tableName}\`?`, 'i');
    return this.slowQueryLogs.filter(log => tablePattern.test(log.query));
  }

  /**
   * 获取超过指定时间的慢查询
   */
  getSlowQueriesAboveDuration(duration: number): SlowQueryLog[] {
    return this.slowQueryLogs.filter(log => log.duration >= duration);
  }

  /**
   * 清除所有日志
   */
  clearLogs(): void {
    this.slowQueryLogs = [];
    this.logger.log('慢查询日志已清除');
  }

  /**
   * 获取当前配置
   */
  getConfig(): SlowQueryConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<SlowQueryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('慢查询配置已更新');
  }

  /**
   * 分析查询性能建议
   */
  analyzeAndSuggest(): string[] {
    const suggestions: string[] = [];
    const stats = this.getStats();

    if (stats.totalSlowQueries === 0) {
      return ['暂无慢查询记录'];
    }

    // 检查高频慢查询表
    const sortedTables = Object.entries(stats.queriesByTable)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [table, count] of sortedTables) {
      if (count > 10) {
        suggestions.push(`表 "${table}" 存在 ${count} 次慢查询，建议检查索引配置`);
      }
    }

    // 检查平均执行时间
    if (stats.averageDuration > 2000) {
      suggestions.push(`平均慢查询时间 ${stats.averageDuration.toFixed(0)}ms 过高，建议进行数据库优化`);
    }

    // 检查最大执行时间
    if (stats.maxDuration > 10000) {
      suggestions.push(`存在执行时间超过10秒的查询，建议立即优化`);
    }

    // 检查操作类型分布
    const selectRatio = (stats.queriesByOperation['SELECT'] ?? 0) / stats.totalSlowQueries;
    if (selectRatio > 0.8) {
      suggestions.push('慢查询主要为 SELECT 操作，建议优化查询语句和索引');
    }

    return suggestions;
  }
}

/**
 * 自定义 TypeORM 日志记录器
 */
class SlowQueryLogger {
  private readonly logger = new Logger('SlowQueryLogger');
  
  constructor(private readonly slowQueryService: SlowQueryLogService) {}

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner): void {
    // 普通查询不记录
  }

  logQueryError(error: string, query: string, parameters?: any[], queryRunner?: QueryRunner): void {
    this.logger.error(`查询错误: ${query.substring(0, 200)}...`);
  }

  logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner): void {
    this.slowQueryService.logSlowQuery(query, parameters, time, queryRunner);
  }

  logSchemaBuild(message: string, queryRunner?: QueryRunner): void {
    this.logger.log(`Schema构建: ${message}`);
  }

  logMigration(message: string, queryRunner?: QueryRunner): void {
    this.logger.log(`迁移: ${message}`);
  }

  log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner): void {
    switch (level) {
      case 'warn':
        this.logger.warn(message);
        break;
      case 'info':
        this.logger.debug(message);
        break;
      default:
        this.logger.verbose(message);
    }
  }
}
