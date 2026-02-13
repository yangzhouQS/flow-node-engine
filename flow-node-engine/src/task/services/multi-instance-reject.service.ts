import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { HistoricActivityInstance } from '../../history/entities/historic-activity-instance.entity';
import { MultiInstanceRejectStrategy, MultiInstanceVoteStrategy } from '../dto/task-reject.dto';
import { MultiInstanceConfigEntity } from '../entities/multi-instance-config.entity';
import { Task, TaskStatus } from '../entities/task.entity';

/**
 * 多实例任务投票记录
 */
interface MultiInstanceVote {
  taskId: string;
  executionId: string;
  userId: string;
  vote: 'APPROVE' | 'REJECT' | 'ABSTAIN';
  reason?: string;
  createTime: Date;
}

/**
 * 多实例退回处理参数
 */
export interface HandleMultiInstanceRejectParams {
  taskId: string;
  strategy?: MultiInstanceRejectStrategy;
  reason?: string;
  variables?: Record<string, any>;
  userId: string;
}

/**
 * 多实例退回处理结果
 */
export interface MultiInstanceRejectResult {
  success: boolean;
  message: string;
  shouldReject?: boolean;
  completedCount?: number;
  totalCount?: number;
  rejectCount?: number;
  approveCount?: number;
  pendingCount?: number;
  cancelledTasks?: string[];
}

/**
 * 多实例退回策略服务
 * 处理会签/或签场景下的多人退回策略
 * 
 * 策略说明:
 * - ALL_BACK: 所有人任务都退回
 * - ONLY_CURRENT: 仅退回当前操作人的任务
 * - MAJORITY_BACK: 多数人退回则全部退回
 * - KEEP_COMPLETED: 保留已完成状态，仅重置未完成任务
 * - RESET_ALL: 重置所有任务，需要重新审批
 * - WAIT_COMPLETION: 等待其他人完成后再退回
 * - IMMEDIATE: 立即退回，取消其他人的任务
 */
@Injectable()
export class MultiInstanceRejectService {
  private readonly logger = new Logger(MultiInstanceRejectService.name);

  constructor(
    @InjectRepository(MultiInstanceConfigEntity)
    private readonly configRepository: Repository<MultiInstanceConfigEntity>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(HistoricActivityInstance)
    private readonly historicActivityRepository: Repository<HistoricActivityInstance>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 处理多实例任务退回
   */
  async handleMultiInstanceReject(
    params: HandleMultiInstanceRejectParams,
  ): Promise<MultiInstanceRejectResult> {
    const { taskId, strategy, reason, variables, userId } = params;

    // 获取任务信息
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`任务不存在: ${taskId}`);
    }

    // 检查是否是多实例任务
    if (!task.parentTaskId && !this.isMultiInstanceTask(task)) {
      return {
        success: false,
        message: '该任务不是多实例任务',
      };
    }

    // 获取多实例配置
    const config = await this.getMultiInstanceConfig(
      task.taskDefinitionId,
      task.taskDefinitionKey,
    );

    // 使用传入的策略或配置的策略，默认为 ALL_BACK
    const actualStrategy = strategy || 
      (config?.reject_strategy_ as MultiInstanceRejectStrategy) || 
      MultiInstanceRejectStrategy.ALL_BACK;

    // 获取多实例任务统计
    const stats = await this.getMultiInstanceStats(task);

    // 记录投票
    await this.recordVote({
      taskId,
      executionId: task.processInstanceId,
      userId,
      vote: 'REJECT',
      reason,
      createTime: new Date(),
    });

    // 根据策略执行退回
    const result = await this.executeRejectStrategy(actualStrategy, task, stats, config, reason);

    this.logger.log(
      `多实例退回执行: taskId=${taskId}, strategy=${actualStrategy}, ` +
      `result=${JSON.stringify(result)}`,
    );

    return result;
  }

  /**
   * 根据策略执行退回操作
   */
  private async executeRejectStrategy(
    strategy: MultiInstanceRejectStrategy,
    currentTask: Task,
    stats: {
      completedCount: number;
      totalCount: number;
      rejectCount: number;
      approveCount: number;
      pendingCount: number;
      siblingTasks: Task[];
    },
    config: MultiInstanceConfigEntity | null,
    reason?: string,
  ): Promise<MultiInstanceRejectResult> {
    switch (strategy) {
      case MultiInstanceRejectStrategy.ALL_BACK:
        return this.executeAllBack(currentTask, stats, reason);

      case MultiInstanceRejectStrategy.ONLY_CURRENT:
        return this.executeOnlyCurrent(currentTask, stats, reason);

      case MultiInstanceRejectStrategy.MAJORITY_BACK:
        return this.executeMajorityBack(currentTask, stats, reason);

      case MultiInstanceRejectStrategy.KEEP_COMPLETED:
        return this.executeKeepCompleted(currentTask, stats, reason);

      case MultiInstanceRejectStrategy.RESET_ALL:
        return this.executeResetAll(currentTask, stats, reason);

      case MultiInstanceRejectStrategy.WAIT_COMPLETION:
        return this.executeWaitCompletion(currentTask, stats, reason);

      case MultiInstanceRejectStrategy.IMMEDIATE:
        return this.executeImmediate(currentTask, stats, reason);

      default:
        return {
          success: false,
          message: `未知的退回策略: ${strategy}`,
        };
    }
  }

  /**
   * ALL_BACK: 所有人任务都退回
   * 取消所有兄弟任务，流程退回到上一节点
   */
  private async executeAllBack(
    currentTask: Task,
    stats: { siblingTasks: Task[]; totalCount: number; completedCount: number },
    reason?: string,
  ): Promise<MultiInstanceRejectResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cancelledTasks: string[] = [];

      // 取消所有待处理的兄弟任务
      for (const task of stats.siblingTasks) {
        if (!task.completionTime) {
          await queryRunner.manager.update(Task, task.id, {
            completionTime: new Date(),
            status: TaskStatus.CANCELLED,
          });
          cancelledTasks.push(task.id);
          this.logger.log(`任务 ${task.id} 已取消: 多实例退回-ALL_BACK - ${reason || '无原因'}`);
        }
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `已取消所有任务(${cancelledTasks.length}个)，流程退回`,
        shouldReject: true,
        cancelledTasks,
        totalCount: stats.totalCount,
        completedCount: stats.completedCount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * ONLY_CURRENT: 仅退回当前操作人的任务
   * 只取消当前任务，其他人的任务继续
   */
  private async executeOnlyCurrent(
    currentTask: Task,
    stats: { siblingTasks: Task[]; pendingCount: number },
    reason?: string,
  ): Promise<MultiInstanceRejectResult> {
    // 只取消当前任务
    await this.taskRepository.update(currentTask.id, {
      completionTime: new Date(),
      status: TaskStatus.CANCELLED,
    });
    this.logger.log(`任务 ${currentTask.id} 已取消: 多实例退回-ONLY_CURRENT - ${reason || '无原因'}`);

    const remainingPending = stats.pendingCount - 1;

    return {
      success: true,
      message: `仅当前任务退回，剩余${remainingPending}个待处理任务`,
      shouldReject: remainingPending === 0, // 如果没有剩余任务，则触发退回
      completedCount: 1,
      pendingCount: remainingPending,
      cancelledTasks: [currentTask.id],
    };
  }

  /**
   * MAJORITY_BACK: 多数人退回则全部退回
   * 统计退回数量，超过半数则取消所有任务
   */
  private async executeMajorityBack(
    currentTask: Task,
    stats: { siblingTasks: Task[]; totalCount: number; rejectCount: number; pendingCount: number; completedCount: number },
    reason?: string,
  ): Promise<MultiInstanceRejectResult> {
    const majority = Math.floor(stats.totalCount / 2) + 1;
    const newRejectCount = stats.rejectCount + 1;

    if (newRejectCount >= majority) {
      // 达到多数，执行全部退回
      return this.executeAllBack(currentTask, { siblingTasks: stats.siblingTasks, totalCount: stats.totalCount, completedCount: stats.completedCount }, reason);
    }

    // 未达多数，仅取消当前任务
    await this.taskRepository.update(currentTask.id, {
      completionTime: new Date(),
      status: TaskStatus.CANCELLED,
    });
    this.logger.log(`任务 ${currentTask.id} 已取消: 多实例退回-MAJORITY_BACK(等待多数) - ${reason || '无原因'}`);

    return {
      success: true,
      message: `当前退回数${newRejectCount}，未达多数(${majority})，继续等待`,
      shouldReject: false,
      rejectCount: newRejectCount,
      pendingCount: stats.pendingCount - 1,
    };
  }

  /**
   * KEEP_COMPLETED: 保留已完成状态，仅重置未完成任务
   * 已完成的任务保持不变，未完成的任务被取消
   */
  private async executeKeepCompleted(
    currentTask: Task,
    stats: { siblingTasks: Task[]; completedCount: number; pendingCount: number },
    reason?: string,
  ): Promise<MultiInstanceRejectResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cancelledTasks: string[] = [];

      // 只取消未完成的兄弟任务
      for (const task of stats.siblingTasks) {
        if (!task.completionTime) {
          await queryRunner.manager.update(Task, task.id, {
            completionTime: new Date(),
            status: TaskStatus.CANCELLED,
          });
          this.logger.log(`任务 ${task.id} 已取消: 多实例退回-KEEP_COMPLETED - ${reason || '无原因'}`);
          cancelledTasks.push(task.id);
        }
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `保留${stats.completedCount}个已完成任务，取消${cancelledTasks.length}个未完成任务`,
        shouldReject: true,
        cancelledTasks,
        completedCount: stats.completedCount,
        pendingCount: 0,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * RESET_ALL: 重置所有任务，需要重新审批
   * 取消所有任务（包括已完成的），流程重新开始此节点
   */
  private async executeResetAll(
    currentTask: Task,
    stats: { siblingTasks: Task[]; totalCount: number },
    reason?: string,
  ): Promise<MultiInstanceRejectResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cancelledTasks: string[] = [];

      // 取消所有兄弟任务（包括已完成的）
      for (const task of stats.siblingTasks) {
        await queryRunner.manager.update(Task, task.id, {
          completionTime: task.completionTime || new Date(),
          status: TaskStatus.CANCELLED,
        });
        this.logger.log(`任务 ${task.id} 已取消: 多实例退回-RESET_ALL - ${reason || '无原因'}`);
        cancelledTasks.push(task.id);
      }

      // TODO: 触发重新创建多实例任务的逻辑

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `已重置所有任务(${cancelledTasks.length}个)，需要重新审批`,
        shouldReject: true,
        cancelledTasks,
        totalCount: stats.totalCount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * WAIT_COMPLETION: 等待其他人完成后再退回
   * 记录退回意愿，等待所有任务完成后统一处理
   */
  private async executeWaitCompletion(
    currentTask: Task,
    stats: { pendingCount: number; rejectCount: number },
    reason?: string,
  ): Promise<MultiInstanceRejectResult> {
    // 取消当前任务
    await this.taskRepository.update(currentTask.id, {
      completionTime: new Date(),
      status: TaskStatus.CANCELLED,
    });
    this.logger.log(`任务 ${currentTask.id} 已取消: 多实例退回-WAIT_COMPLETION - ${reason || '无原因'}`);

    const newPendingCount = stats.pendingCount - 1;
    const newRejectCount = stats.rejectCount + 1;

    if (newPendingCount === 0) {
      // 所有人已完成，执行退回
      return {
        success: true,
        message: '所有人已完成，执行退回',
        shouldReject: true,
        rejectCount: newRejectCount,
        pendingCount: 0,
        cancelledTasks: [currentTask.id],
      };
    }

    return {
      success: true,
      message: `已记录退回，等待其他${newPendingCount}人完成`,
      shouldReject: false,
      rejectCount: newRejectCount,
      pendingCount: newPendingCount,
    };
  }

  /**
   * IMMEDIATE: 立即退回，取消其他人的任务
   * 不等待其他人，立即取消所有待处理任务并退回
   */
  private async executeImmediate(
    currentTask: Task,
    stats: { siblingTasks: Task[]; pendingCount: number },
    reason?: string,
  ): Promise<MultiInstanceRejectResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cancelledTasks: string[] = [];

      // 立即取消所有待处理的兄弟任务
      for (const task of stats.siblingTasks) {
        if (!task.completionTime) {
          await queryRunner.manager.update(Task, task.id, {
            completionTime: new Date(),
            status: TaskStatus.CANCELLED,
          });
          this.logger.log(`任务 ${task.id} 已取消: 多实例退回-IMMEDIATE - ${reason || '无原因'}`);
          cancelledTasks.push(task.id);
        }
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `立即退回，已取消${cancelledTasks.length}个待处理任务`,
        shouldReject: true,
        cancelledTasks,
        pendingCount: 0,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取多实例任务统计
   */
  private async getMultiInstanceStats(task: Task): Promise<{
    completedCount: number;
    totalCount: number;
    rejectCount: number;
    approveCount: number;
    pendingCount: number;
    siblingTasks: Task[];
  }> {
    // 查询同一多实例的所有任务
    const queryBuilder = this.taskRepository.createQueryBuilder('task');

    // 获取同一执行树下的所有任务
    const siblingTasks = await queryBuilder
      .where('task.processInstanceId = :processInstanceId', {
        processInstanceId: task.processInstanceId,
      })
      .andWhere('task.taskDefinitionKey = :taskDefKey', {
        taskDefKey: task.taskDefinitionKey,
      })
      .getMany();

    // 获取历史活动实例来统计已完成数量
    const historicActivities = await this.historicActivityRepository.find({
      where: {
        processInstanceId: task.processInstanceId,
        activityId: task.taskDefinitionKey,
      },
    });

    const totalCount = siblingTasks.length + historicActivities.length;
    const pendingCount = siblingTasks.filter((t) => !t.completionTime).length;
    const completedCount = totalCount - pendingCount;

    // 统计驳回和通过数量（从历史变量或任务变量中获取）
    const rejectCount = await this.getVoteCount(task.processInstanceId, task.taskDefinitionKey, 'REJECT');
    const approveCount = await this.getVoteCount(task.processInstanceId, task.taskDefinitionKey, 'APPROVE');

    return {
      completedCount,
      totalCount,
      rejectCount,
      approveCount,
      pendingCount,
      siblingTasks,
    };
  }

  /**
   * 获取投票数量
   */
  private async getVoteCount(
    processInstanceId: string,
    taskDefKey: string,
    voteType: 'APPROVE' | 'REJECT' | 'ABSTAIN',
  ): Promise<number> {
    // 这里应该从投票记录表中查询
    // 暂时返回0，实际实现需要创建投票记录表
    return 0;
  }

  /**
   * 记录投票
   */
  private async recordVote(vote: MultiInstanceVote): Promise<void> {
    // 这里应该将投票记录保存到数据库
    // 暂时只记录日志
    this.logger.log(
      `记录投票: taskId=${vote.taskId}, userId=${vote.userId}, vote=${vote.vote}`,
    );
  }

  /**
   * 获取多实例配置
   */
  private async getMultiInstanceConfig(
    processDefinitionId: string,
    taskDefKey: string,
  ): Promise<MultiInstanceConfigEntity | null> {
    return this.configRepository.findOne({
      where: {
        proc_def_id_: processDefinitionId,
        task_def_key_: taskDefKey,
      },
    });
  }

  /**
   * 检查是否是多实例任务
   */
  private isMultiInstanceTask(task: Task): boolean {
    // 检查任务的执行是否是多实例执行
    // 可以通过检查执行树的特性来判断
    return !!task.parentTaskId || !!task.processInstanceId;
  }

  /**
   * 获取多实例任务的所有子任务
   */
  async getSubTasks(parentTaskId: string): Promise<Task[]> {
    return this.taskRepository.find({
      where: { parentTaskId: parentTaskId },
    });
  }

  /**
   * 获取多实例任务的完成进度
   */
  async getProgress(taskId: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    percentage: number;
  }> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`任务不存在: ${taskId}`);
    }

    const stats = await this.getMultiInstanceStats(task);
    const percentage = stats.totalCount > 0 
      ? Math.round((stats.completedCount / stats.totalCount) * 100) 
      : 0;

    return {
      total: stats.totalCount,
      completed: stats.completedCount,
      pending: stats.pendingCount,
      percentage,
    };
  }

  /**
   * 设置多实例退回配置
   */
  async setConfig(params: {
    processDefinitionId: string;
    processDefinitionKey: string;
    activityId: string;
    strategy: MultiInstanceRejectStrategy;
    rejectPercentage?: number;
  }): Promise<MultiInstanceConfigEntity> {
    const config = this.configRepository.create({
      id_: this.generateId(),
      proc_def_id_: params.processDefinitionId,
      task_def_key_: params.activityId,
      task_name_: params.activityId,
      is_multi_instance_: true,
      sequential_: false,
      reject_strategy_: params.strategy,
      reject_percentage_: params.rejectPercentage,
    });

    return this.configRepository.save(config);
  }

  /**
   * 生成ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
