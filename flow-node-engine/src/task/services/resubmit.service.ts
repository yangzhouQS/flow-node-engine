/**
 * 重新提交服务
 * 处理被驳回任务的重新提交功能
 */
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';

import { Task } from '../entities/task.entity';
import { TaskReject, RejectType } from '../entities/task-reject.entity';
import { ProcessInstance, ProcessInstanceStatus } from '../../process-instance/entities/process-instance.entity';
import { Execution } from '../../process-instance/entities/execution.entity';
import { EventBusService } from '../../core/services/event-bus.service';
import { HistoryService } from '../../history/services/history.service';

export interface ResubmitTaskDto {
  taskId: string;
  userId: string;
  variables?: Record<string, any>;
  comment?: string;
}

export interface ResubmitResult {
  success: boolean;
  task?: Task;
  message?: string;
}

@Injectable()
export class ResubmitService {
  private readonly logger = new Logger(ResubmitService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(TaskReject)
    private readonly taskRejectRepository: Repository<TaskReject>,
    @InjectRepository(ProcessInstance)
    private readonly processInstanceRepository: Repository<ProcessInstance>,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    private readonly historyService: HistoryService,
    private readonly eventBus: EventBusService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 重新提交被驳回的任务
   * @param dto 重新提交参数
   * @returns 重新提交结果
   */
  async resubmitTask(dto: ResubmitTaskDto): Promise<ResubmitResult> {
    this.logger.log(`重新提交任务: ${dto.taskId}, 用户: ${dto.userId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 获取当前任务
      const currentTask = await this.taskRepository.findOne({
        where: { id: dto.taskId },
        relations: ['processInstance'],
      });

      if (!currentTask) {
        throw new NotFoundException('任务不存在');
      }

      // 2. 验证任务是否可以被重新提交
      await this.validateResubmit(currentTask, dto.userId);

      // 3. 获取最近的驳回记录
      const lastReject = await this.getLastRejectRecord(
        currentTask.processInstanceId,
        currentTask.taskDefinitionKey,
      );

      if (!lastReject) {
        throw new BadRequestException('未找到驳回记录，无法重新提交');
      }

      // 4. 更新任务变量
      const updatedVariables = {
        ...currentTask.variables,
        resubmitTime: new Date().toISOString(),
        resubmitBy: dto.userId,
        resubmitComment: dto.comment || null,
      };

      if (dto.variables) {
        Object.assign(updatedVariables, dto.variables);
      }

      await queryRunner.manager.update(Task, currentTask.id, {
        variables: updatedVariables,
      });

      // 5. 完成当前任务，触发流程继续
      await this.completeResubmitTask(
        currentTask,
        dto,
        lastReject,
        queryRunner,
      );

      // 6. 记录重新提交历史
      await this.recordResubmitHistory(currentTask, dto, lastReject, queryRunner);

      await queryRunner.commitTransaction();

      // 7. 发布事件
      this.eventBus.emit('task.resubmitted', {
        taskId: dto.taskId,
        processInstanceId: currentTask.processInstanceId,
        userId: dto.userId,
        originalRejectType: lastReject.rejectType,
        variables: dto.variables,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`任务重新提交成功: ${dto.taskId}`);

      return {
        success: true,
        task: currentTask,
        message: '任务重新提交成功',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`任务重新提交失败: ${dto.taskId}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 验证是否可以重新提交
   */
  private async validateResubmit(task: Task, userId: string): Promise<void> {
    // 检查任务状态
    if (task.status !== 'CREATED' && task.status !== 'CLAIMED') {
      throw new BadRequestException(`任务状态不允许重新提交，当前状态: ${task.status}`);
    }

    // 检查流程实例状态
    const processInstance = await this.processInstanceRepository.findOne({
      where: { id: task.processInstanceId },
    });

    if (!processInstance) {
      throw new NotFoundException('流程实例不存在');
    }

    if (processInstance.status !== ProcessInstanceStatus.RUNNING) {
      throw new BadRequestException(`流程实例不在运行状态，当前状态: ${processInstance.status}`);
    }

    // 检查是否是被驳回的任务
    const rejectCount = await this.taskRejectRepository.count({
      where: {
        processInstanceId: task.processInstanceId,
        rejectToActivityId: task.taskDefinitionKey,
      },
    });

    if (rejectCount === 0) {
      throw new BadRequestException('该任务不是被驳回的任务，无法重新提交');
    }

    // 检查操作人权限（必须是任务受派人或发起人）
    if (task.assignee && task.assignee !== userId) {
      if (processInstance.startUserId !== userId) {
        throw new BadRequestException('只有任务受派人或流程发起人可以重新提交');
      }
    }
  }

  /**
   * 获取最近的驳回记录
   */
  private async getLastRejectRecord(
    processInstanceId: string,
    activityId: string,
  ): Promise<TaskReject | null> {
    return this.taskRejectRepository.findOne({
      where: {
        processInstanceId,
        rejectToActivityId: activityId,
      },
      order: {
        createTime: 'DESC',
      },
    });
  }

  /**
   * 完成重新提交任务
   */
  private async completeResubmitTask(
    task: Task,
    dto: ResubmitTaskDto,
    lastReject: TaskReject,
    queryRunner: QueryRunner,
  ): Promise<void> {
    // 更新任务状态为已完成
    await queryRunner.manager.update(Task, task.id, {
      status: 'COMPLETED',
      endTime: new Date(),
    });

    // 创建历史任务记录
    if (this.historyService) {
      await this.historyService.createHistoricTask(
        {
          ...task,
          status: 'COMPLETED',
          endTime: new Date(),
          deleteReason: 'RESUBMITTED',
        },
        queryRunner,
      );
    }
  }

  /**
   * 记录重新提交历史
   */
  private async recordResubmitHistory(
    task: Task,
    dto: ResubmitTaskDto,
    lastReject: TaskReject,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const resubmitRecord = queryRunner.manager.create(TaskReject, {
      id: this.generateUuid(),
      taskId: task.id,
      processInstanceId: task.processInstanceId,
      rejectFromActivityId: task.taskDefinitionKey,
      rejectFromActivityName: task.name,
      rejectToActivityId: lastReject.rejectFromActivityId,
      rejectToActivityName: lastReject.rejectFromActivityName,
      rejectType: 'RESUBMIT' as any,
      reason: dto.comment || '重新提交',
      operatorId: dto.userId,
      createTime: new Date(),
    });
    await queryRunner.manager.save(resubmitRecord);
  }

  /**
   * 检查任务是否可以重新提交
   */
  async canResubmit(taskId: string, userId: string): Promise<{
    canResubmit: boolean;
    reason?: string;
  }> {
    try {
      const task = await this.taskRepository.findOne({
        where: { id: taskId },
        relations: ['processInstance'],
      });

      if (!task) {
        return { canResubmit: false, reason: '任务不存在' };
      }

      // 检查任务状态
      if (task.status !== 'CREATED' && task.status !== 'CLAIMED') {
        return { canResubmit: false, reason: `任务状态不允许重新提交` };
      }

      // 检查是否是被驳回的任务
      const rejectCount = await this.taskRejectRepository.count({
        where: {
          processInstanceId: task.processInstanceId,
          rejectToActivityId: task.taskDefinitionKey,
        },
      });

      if (rejectCount === 0) {
        return { canResubmit: false, reason: '该任务不是被驳回的任务' };
      }

      // 检查操作人权限
      if (task.assignee && task.assignee !== userId) {
        const processInstance = await this.processInstanceRepository.findOne({
          where: { id: task.processInstanceId },
        });
        if (processInstance?.startUserId !== userId) {
          return { canResubmit: false, reason: '只有任务受派人或流程发起人可以重新提交' };
        }
      }

      return { canResubmit: true };
    } catch (error) {
      return { canResubmit: false, reason: error.message };
    }
  }

  /**
   * 获取任务的重新提交历史
   */
  async getResubmitHistory(processInstanceId: string): Promise<TaskReject[]> {
    return this.taskRejectRepository.find({
      where: {
        processInstanceId,
        rejectType: 'RESUBMIT' as any,
      },
      order: {
        createTime: 'DESC',
      },
    });
  }

  /**
   * 生成UUID
   */
  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
