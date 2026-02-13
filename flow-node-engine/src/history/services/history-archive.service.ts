/**
 * 历史数据归档服务
 * 处理历史数据的定期归档和清理
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { HistoricTaskInstance } from '../entities/historic-task-instance.entity';
import { HistoricActivityInstance } from '../entities/historic-activity-instance.entity';
import { HistoricProcessInstance } from '../entities/historic-process-instance.entity';
import { HistoricDetail } from '../entities/historic-detail.entity';
import { HistoricVariableInstance } from '../entities/historic-variable-instance.entity';

export interface ArchiveConfig {
  retentionDays: number;      // 保留天数
  archiveBatchSize: number;   // 每批处理数量
  enableAutoArchive: boolean; // 是否启用自动归档
}

export interface ArchiveResult {
  archivedTasks: number;
  archivedActivities: number;
  archivedProcessInstances: number;
  archivedDetails: number;
  archivedVariables: number;
  totalArchived: number;
  archiveDate: Date;
}

export interface ArchiveStatistics {
  totalRecords: number;
  oldestRecord: Date | null;
  newestRecord: Date | null;
  recordsByMonth: { month: string; count: number }[];
}

@Injectable()
export class HistoryArchiveService {
  private readonly logger = new Logger(HistoryArchiveService.name);
  
  // 默认配置
  private config: ArchiveConfig = {
    retentionDays: 365,        // 默认保留1年
    archiveBatchSize: 1000,    // 每批1000条
    enableAutoArchive: true,   // 默认启用自动归档
  };

  constructor(
    @InjectRepository(HistoricTaskInstance)
    private readonly historicTaskRepository: Repository<HistoricTaskInstance>,
    @InjectRepository(HistoricActivityInstance)
    private readonly historicActivityRepository: Repository<HistoricActivityInstance>,
    @InjectRepository(HistoricProcessInstance)
    private readonly historicProcessRepository: Repository<HistoricProcessInstance>,
    @InjectRepository(HistoricDetail)
    private readonly historicDetailRepository: Repository<HistoricDetail>,
    @InjectRepository(HistoricVariableInstance)
    private readonly historicVariableRepository: Repository<HistoricVariableInstance>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 定时归档任务 - 每天凌晨2点执行
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'historyArchive',
    timeZone: 'Asia/Shanghai',
  })
  async handleCronArchive(): Promise<void> {
    if (!this.config.enableAutoArchive) {
      this.logger.debug('自动归档已禁用，跳过定时任务');
      return;
    }

    this.logger.log('开始执行定时历史数据归档...');
    try {
      const result = await this.archiveOldData();
      this.logger.log(`定时归档完成: 共归档 ${result.totalArchived} 条记录`);
    } catch (error) {
      this.logger.error('定时归档失败', error);
    }
  }

  /**
   * 归档旧数据
   * @param beforeDate 归档此日期之前的数据
   */
  async archiveOldData(beforeDate?: Date): Promise<ArchiveResult> {
    const cutoffDate = beforeDate || this.calculateCutoffDate();
    this.logger.log(`开始归档 ${cutoffDate.toISOString()} 之前的历史数据`);

    const result: ArchiveResult = {
      archivedTasks: 0,
      archivedActivities: 0,
      archivedProcessInstances: 0,
      archivedDetails: 0,
      archivedVariables: 0,
      totalArchived: 0,
      archiveDate: new Date(),
    };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 归档历史任务
      result.archivedTasks = await this.archiveTable(
        this.historicTaskRepository,
        'endTime',
        cutoffDate,
        queryRunner,
      );

      // 2. 归档历史活动
      result.archivedActivities = await this.archiveTable(
        this.historicActivityRepository,
        'endTime',
        cutoffDate,
        queryRunner,
      );

      // 3. 归档历史流程实例
      result.archivedProcessInstances = await this.archiveTable(
        this.historicProcessRepository,
        'endTime',
        cutoffDate,
        queryRunner,
      );

      // 4. 归档历史详情
      result.archivedDetails = await this.archiveTable(
        this.historicDetailRepository,
        'time',
        cutoffDate,
        queryRunner,
      );

      // 5. 归档历史变量
      result.archivedVariables = await this.archiveTable(
        this.historicVariableRepository,
        'createTime',
        cutoffDate,
        queryRunner,
      );

      await queryRunner.commitTransaction();

      result.totalArchived = 
        result.archivedTasks + 
        result.archivedActivities + 
        result.archivedProcessInstances + 
        result.archivedDetails + 
        result.archivedVariables;

      this.logger.log(`归档完成: ${JSON.stringify(result)}`);

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('归档失败，已回滚', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 归档单个表的数据
   */
  private async archiveTable<T>(
    repository: Repository<T>,
    dateField: string,
    cutoffDate: Date,
    queryRunner: any,
  ): Promise<number> {
    let totalArchived = 0;
    let hasMore = true;

    while (hasMore) {
      // 分批查询要归档的记录
      const records = await repository.find({
        where: {
          [dateField]: LessThanOrEqual(cutoffDate),
        },
        take: this.config.archiveBatchSize,
      });

      if (records.length === 0) {
        hasMore = false;
        break;
      }

      // 这里可以添加将数据写入归档表的逻辑
      // 例如：await this.writeToArchiveTable(records);

      // 删除已归档的记录
      const ids = records.map((r: any) => r.id);
      await queryRunner.manager.delete(repository.target, ids);

      totalArchived += records.length;
      this.logger.debug(`已归档 ${records.length} 条 ${repository.metadata.tableName} 记录`);

      // 如果取出的记录少于批次大小，说明没有更多数据了
      if (records.length < this.config.archiveBatchSize) {
        hasMore = false;
      }
    }

    return totalArchived;
  }

  /**
   * 手动归档指定流程实例的历史数据
   * @param processInstanceId 流程实例ID
   */
  async archiveProcessInstance(processInstanceId: string): Promise<ArchiveResult> {
    this.logger.log(`手动归档流程实例: ${processInstanceId}`);

    const result: ArchiveResult = {
      archivedTasks: 0,
      archivedActivities: 0,
      archivedProcessInstances: 0,
      archivedDetails: 0,
      archivedVariables: 0,
      totalArchived: 0,
      archiveDate: new Date(),
    };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 删除历史任务
      result.archivedTasks = await queryRunner.manager.delete(
        HistoricTaskInstance,
        { processInstanceId },
      );

      // 删除历史活动
      result.archivedActivities = await queryRunner.manager.delete(
        HistoricActivityInstance,
        { processInstanceId },
      );

      // 删除历史详情
      result.archivedDetails = await queryRunner.manager.delete(
        HistoricDetail,
        { processInstanceId },
      );

      // 删除历史变量
      result.archivedVariables = await queryRunner.manager.delete(
        HistoricVariableInstance,
        { processInstanceId },
      );

      // 最后删除历史流程实例
      result.archivedProcessInstances = await queryRunner.manager.delete(
        HistoricProcessInstance,
        { id: processInstanceId },
      );

      await queryRunner.commitTransaction();

      result.totalArchived = 
        (result.archivedTasks as any).affected + 
        (result.archivedActivities as any).affected + 
        (result.archivedProcessInstances as any).affected + 
        (result.archivedDetails as any).affected + 
        (result.archivedVariables as any).affected;

      this.logger.log(`流程实例归档完成: ${processInstanceId}, 共 ${result.totalArchived} 条记录`);

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`流程实例归档失败: ${processInstanceId}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取归档统计信息
   */
  async getArchiveStatistics(): Promise<ArchiveStatistics> {
    const cutoffDate = this.calculateCutoffDate();

    // 统计可归档的记录总数
    const [
      taskCount,
      activityCount,
      processCount,
      detailCount,
      variableCount,
    ] = await Promise.all([
      this.historicTaskRepository.count({
        where: { endTime: LessThanOrEqual(cutoffDate) },
      }),
      this.historicActivityRepository.count({
        where: { endTime: LessThanOrEqual(cutoffDate) },
      }),
      this.historicProcessRepository.count({
        where: { endTime: LessThanOrEqual(cutoffDate) },
      }),
      this.historicDetailRepository.count({
        where: { time: LessThanOrEqual(cutoffDate) },
      }),
      this.historicVariableRepository.count({
        where: { createTime: LessThanOrEqual(cutoffDate) },
      }),
    ]);

    // 获取最老和最新记录的时间
    const oldestTask = await this.historicTaskRepository.findOne({
      where: {},
      order: { startTime: 'ASC' },
    });

    const newestTask = await this.historicTaskRepository.findOne({
      where: {},
      order: { startTime: 'DESC' },
    });

    // 按月统计记录数
    const recordsByMonth = await this.getRecordsByMonth();

    return {
      totalRecords: taskCount + activityCount + processCount + detailCount + variableCount,
      oldestRecord: oldestTask?.startTime || null,
      newestRecord: newestTask?.startTime || null,
      recordsByMonth,
    };
  }

  /**
   * 按月统计记录数
   */
  private async getRecordsByMonth(): Promise<{ month: string; count: number }[]> {
    const query = `
      SELECT 
        DATE_FORMAT(start_time, '%Y-%m') as month,
        COUNT(*) as count
      FROM act_hi_taskinst
      GROUP BY DATE_FORMAT(start_time, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `;

    try {
      const result = await this.dataSource.query(query);
      return result.map((row: any) => ({
        month: row.month,
        count: row.count,
      }));
    } catch (error) {
      this.logger.warn('按月统计失败，返回空数组', error);
      return [];
    }
  }

  /**
   * 更新归档配置
   */
  updateConfig(newConfig: Partial<ArchiveConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log(`归档配置已更新: ${JSON.stringify(this.config)}`);
  }

  /**
   * 获取当前配置
   */
  getConfig(): ArchiveConfig {
    return { ...this.config };
  }

  /**
   * 计算截止日期
   */
  private calculateCutoffDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() - this.config.retentionDays);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  /**
   * 预览将要归档的数据
   * @param beforeDate 截止日期
   * @param limit 返回记录限制
   */
  async previewArchiveData(beforeDate: Date, limit: number = 100): Promise<{
    tasks: HistoricTaskInstance[];
    processInstances: HistoricProcessInstance[];
    counts: {
      tasks: number;
      activities: number;
      processInstances: number;
      details: number;
      variables: number;
    };
  }> {
    const cutoffDate = beforeDate || this.calculateCutoffDate();

    const [tasks, processInstances, taskCount, activityCount, processCount, detailCount, variableCount] = await Promise.all([
      this.historicTaskRepository.find({
        where: { endTime: LessThanOrEqual(cutoffDate) },
        take: limit,
      }),
      this.historicProcessRepository.find({
        where: { endTime: LessThanOrEqual(cutoffDate) },
        take: limit,
      }),
      this.historicTaskRepository.count({
        where: { endTime: LessThanOrEqual(cutoffDate) },
      }),
      this.historicActivityRepository.count({
        where: { endTime: LessThanOrEqual(cutoffDate) },
      }),
      this.historicProcessRepository.count({
        where: { endTime: LessThanOrEqual(cutoffDate) },
      }),
      this.historicDetailRepository.count({
        where: { time: LessThanOrEqual(cutoffDate) },
      }),
      this.historicVariableRepository.count({
        where: { createTime: LessThanOrEqual(cutoffDate) },
      }),
    ]);

    return {
      tasks,
      processInstances,
      counts: {
        tasks: taskCount,
        activities: activityCount,
        processInstances: processCount,
        details: detailCount,
        variables: variableCount,
      },
    };
  }

  /**
   * 检查是否需要归档
   */
  async needsArchive(): Promise<boolean> {
    const cutoffDate = this.calculateCutoffDate();
    const count = await this.historicTaskRepository.count({
      where: { endTime: LessThanOrEqual(cutoffDate) },
    });
    return count > 0;
  }
}
