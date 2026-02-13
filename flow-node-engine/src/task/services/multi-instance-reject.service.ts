import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { HistoricActivityInstanceEntity } from '../../history/entities/historic-activity-instance.entity';
import { MultiInstanceRejectStrategy } from '../dto/task-reject.dto';
import { MultiInstanceConfigEntity } from '../entities/multi-instance-config.entity';
import { Task } from '../entities/task.entity';

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
}

/**
 * 多实例退回策略服务
 * 处理会签/或签场景下的多人退回策略
 */
@Injectable()
export class MultiInstanceRejectService {
  private readonly logger = new Logger(MultiInstanceRejectService.name);

  constructor(
    @InjectRepository(MultiInstanceConfigEntity)
    private readonly configRepository: Repository<MultiInstanceConfigEntity>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(HistoricActivityInstanceEntity)
    private readonly historicActivityRepository: Repository<HistoricActivityInstanceEntity>,
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
      where: { id_: taskId },
    });

    if (!task) {
      throw new NotFoundException(`任务不存在: ${taskId}`);
    }

    // 检查是否是多实例任务
    if (!task.parent_task_id_ && !this.isMultiInstanceTask(task)) {
      return {
        success: false,
        message: '该任务不是多实例任务',
      };
    }

    // 获取多实例配置
    const config = await this.getMultiInstanceConfig(
      task.proc_def_id_,
      task.task_def_key_,
    );

    // 使用传入的策略或配置的策略
    const actualStrategy = strategy || config?.strategy || MultiInstanceRejectStrategy.ANY_REJECT;

    // 获取多实例任务统计
    const stats = await this.getMultiInstanceStats(task);

    // 记录投票
    await this.recordVote({
      taskId,
      executionId: task.execution_id_,
      userId,
      vote: 'REJECT',
      reason,
      createTime: new Date(),
    });

    // 根据策略判断是否应该退回
    const result = await this.evaluateRejectStrategy(actualStrategy, stats, config);

    this.logger.log(
      `多实例退回评估: taskId=${taskId}, strategy=${actualStrategy}, ` +
      `shouldReject=${result.shouldReject}, stats=${JSON.stringify(stats)}`,
    );

    return {
      success: true,
      message: result.message,
      shouldReject: result.shouldReject,
      ...stats,
    };
  }

  /**
   * 根据策略评估是否应该退回
   */
  private async evaluateRejectStrategy(
    strategy: MultiInstanceRejectStrategy,
    stats: {
      completedCount: number;
      totalCount: number;
      rejectCount: number;
      approveCount: number;
      pendingCount: number;
    },
    config: MultiInstanceConfigEntity | null,
  ): Promise<{ shouldReject: boolean; message: string }> {
    const { completedCount, totalCount, rejectCount, approveCount, pendingCount } = stats;

    switch (strategy) {
      case MultiInstanceRejectStrategy.ANY_REJECT:
        // 任一人驳回即退回
        if (rejectCount > 0) {
          return { shouldReject: true, message: '有人驳回，流程退回' };
        }
        return { shouldReject: false, message: '暂无驳回，继续等待' };

      case MultiInstanceRejectStrategy.ALL_REJECT:
        // 所有人驳回才退回
        if (rejectCount === totalCount) {
          return { shouldReject: true, message: '所有人驳回，流程退回' };
        }
        if (pendingCount === 0 && rejectCount < totalCount) {
          return { shouldReject: false, message: '并非所有人驳回，流程继续' };
        }
        return { shouldReject: false, message: '等待所有人完成' };

      case MultiInstanceRejectStrategy.MAJORITY_REJECT:
        // 多数驳回才退回
        const majority = Math.floor(totalCount / 2) + 1;
        if (rejectCount >= majority) {
          return { shouldReject: true, message: '多数人驳回，流程退回' };
        }
        if (pendingCount === 0 && rejectCount < majority) {
          return { shouldReject: false, message: '多数人未驳回，流程继续' };
        }
        return { shouldReject: false, message: '等待多数结果' };

      case MultiInstanceRejectStrategy.PERCENTAGE_REJECT:
        // 按百分比驳回
        const percentage = config?.reject_percentage || 50;
        const rejectPercentage = (rejectCount / totalCount) * 100;
        if (rejectPercentage >= percentage) {
          return { shouldReject: true, message: `驳回比例达到${percentage}%，流程退回` };
        }
        if (pendingCount === 0) {
          return { shouldReject: false, message: `驳回比例未达${percentage}%，流程继续` };
        }
        return { shouldReject: false, message: '等待达到驳回比例' };

      case MultiInstanceRejectStrategy.ANY_REJECT_WAIT_OTHERS:
        // 任一人驳回需等待其他人完成
        if (rejectCount > 0 && pendingCount === 0) {
          return { shouldReject: true, message: '有人驳回且其他人已完成，流程退回' };
        }
        if (rejectCount > 0) {
          return { shouldReject: false, message: '有人驳回，等待其他人完成' };
        }
        return { shouldReject: false, message: '暂无驳回，继续等待' };

      case MultiInstanceRejectStrategy.CALCULATE_AFTER_ALL:
        // 所有人完成后计算
        if (pendingCount > 0) {
          return { shouldReject: false, message: '等待所有人完成' };
        }
        // 所有人完成后，根据驳回比例决定
        if (rejectCount > approveCount) {
          return { shouldReject: true, message: '驳回数多于通过数，流程退回' };
        }
        return { shouldReject: false, message: '通过数多于驳回数，流程继续' };

      case MultiInstanceRejectStrategy.LAST_DECIDES:
        // 最后一人决定
        if (pendingCount === 1) {
          // 当前是最后一人，其决定即为最终结果
          if (rejectCount > 0) {
            return { shouldReject: true, message: '最后一人驳回，流程退回' };
          }
        }
        if (pendingCount === 0) {
          return { shouldReject: rejectCount > 0, message: '所有人已完成' };
        }
        return { shouldReject: false, message: '等待最后一人决定' };

      default:
        return { shouldReject: false, message: '未知策略' };
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
  }> {
    // 查询同一多实例的所有任务
    const queryBuilder = this.taskRepository.createQueryBuilder('task');

    // 获取同一执行树下的所有任务
    const siblingTasks = await queryBuilder
      .where('task.proc_inst_id_ = :processInstanceId', {
        processInstanceId: task.proc_inst_id_,
      })
      .andWhere('task.task_def_key_ = :taskDefKey', {
        taskDefKey: task.task_def_key_,
      })
      .getMany();

    // 获取历史活动实例来统计已完成数量
    const historicActivities = await this.historicActivityRepository.find({
      where: {
        proc_inst_id_: task.proc_inst_id_,
        activity_id_: task.task_def_key_,
      },
    });

    const totalCount = siblingTasks.length + historicActivities.length;
    const pendingCount = siblingTasks.filter((t) => !t.end_time_).length;
    const completedCount = totalCount - pendingCount;

    // 统计驳回和通过数量（从历史变量或任务变量中获取）
    const rejectCount = await this.getVoteCount(task.proc_inst_id_, task.task_def_key_, 'REJECT');
    const approveCount = await this.getVoteCount(task.proc_inst_id_, task.task_def_key_, 'APPROVE');

    return {
      completedCount,
      totalCount,
      rejectCount,
      approveCount,
      pendingCount,
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
        activity_id_: taskDefKey,
      },
    });
  }

  /**
   * 检查是否是多实例任务
   */
  private isMultiInstanceTask(task: TaskEntity): boolean {
    // 检查任务的执行是否是多实例执行
    // 可以通过检查执行树的特性来判断
    return !!task.parent_task_id_ || !!task.execution_id_;
  }

  /**
   * 获取多实例任务的所有子任务
   */
  async getSubTasks(parentTaskId: string): Promise<Task[]> {
    return this.taskRepository.find({
      where: { parent_task_id_: parentTaskId },
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
      where: { id_: taskId },
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
      proc_def_key_: params.processDefinitionKey,
      activity_id_: params.activityId,
      strategy_: params.strategy,
      reject_percentage_: params.rejectPercentage,
      create_time_: new Date(),
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
