import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { HistoricActivityInstance,  } from '../entities/historic-activity-instance.entity';
import { HistoricProcessInstance,  } from '../entities/historic-process-instance.entity';
import { HistoricTaskInstance, HistoricTaskStatus } from '../entities/historic-task-instance.entity';

/**
 * 历史服务
 */
@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(HistoricActivityInstance)
    private historicActivityInstanceRepository: Repository<HistoricActivityInstance>,
    @InjectRepository(HistoricTaskInstance)
    private historicTaskInstanceRepository: Repository<HistoricTaskInstance>,
    @InjectRepository(HistoricProcessInstance)
    private historicProcessInstanceRepository: Repository<HistoricProcessInstance>,
  ) {}

  /**
   * 查询历史活动实例
   */
  async findHistoricActivityInstances(query: any): Promise<{ activities: HistoricActivityInstance[]; total: number }> {
    const {
      processInstanceId,
      processDefinitionId,
      activityType,
      assignee,
      startTimeStart,
      startTimeEnd,
      page = 1,
      pageSize = 10,
      sortBy = 'startTime',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.historicActivityInstanceRepository.createQueryBuilder('activity');

    // 添加查询条件
    if (processInstanceId) {
      queryBuilder.andWhere('activity.processInstanceId = :processInstanceId', { processInstanceId });
    }
    if (processDefinitionId) {
      queryBuilder.andWhere('activity.processDefinitionId = :processDefinitionId', { processDefinitionId });
    }
    if (activityType) {
      queryBuilder.andWhere('activity.activityType = :activityType', { activityType });
    }
    if (assignee) {
      queryBuilder.andWhere('activity.assignee = :assignee', { assignee });
    }
    if (startTimeStart && startTimeEnd) {
      queryBuilder.andWhere('activity.startTime BETWEEN :startTimeStart AND :startTimeEnd', {
        startTimeStart: new Date(startTimeStart),
        startTimeEnd: new Date(startTimeEnd),
      });
    }

    // 排序
    queryBuilder.orderBy(`activity.${sortBy}`, sortOrder);

    // 分页
    const [activities, total] = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { activities, total };
  }

  /**
   * 根据ID查询历史活动实例
   */
  async findHistoricActivityInstanceById(id: string): Promise<HistoricActivityInstance> {
    const activity = await this.historicActivityInstanceRepository.findOne({ where: { id } });
    if (!activity) {
      throw new NotFoundException(`Historic activity instance with ID ${id} not found`);
    }
    return activity;
  }

  /**
   * 根据流程实例ID查询历史活动实例
   */
  async findHistoricActivityInstancesByProcessInstanceId(processInstanceId: string): Promise<HistoricActivityInstance[]> {
    return this.historicActivityInstanceRepository.find({ 
      where: { processInstanceId },
      order: { startTime: 'ASC' }
    });
  }

  /**
   * 查询历史任务实例
   */
  async findHistoricTaskInstances(query: any): Promise<{ tasks: HistoricTaskInstance[]; total: number }> {
    const {
      processInstanceId,
      processDefinitionId,
      assignee,
      status,
      startTimeStart,
      startTimeEnd,
      completionTimeStart,
      completionTimeEnd,
      page = 1,
      pageSize = 10,
      sortBy = 'createTime',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.historicTaskInstanceRepository.createQueryBuilder('task');

    // 添加查询条件
    if (processInstanceId) {
      queryBuilder.andWhere('task.processInstanceId = :processInstanceId', { processInstanceId });
    }
    if (processDefinitionId) {
      queryBuilder.andWhere('task.processDefinitionId = :processDefinitionId', { processDefinitionId });
    }
    if (assignee) {
      queryBuilder.andWhere('task.assignee = :assignee', { assignee });
    }
    if (status) {
      queryBuilder.andWhere('task.status = :status', { status });
    }
    if (startTimeStart && startTimeEnd) {
      queryBuilder.andWhere('task.createTime BETWEEN :startTimeStart AND :startTimeEnd', {
        startTimeStart: new Date(startTimeStart),
        startTimeEnd: new Date(startTimeEnd),
      });
    }
    if (completionTimeStart && completionTimeEnd) {
      queryBuilder.andWhere('task.completionTime BETWEEN :completionTimeStart AND :completionTimeEnd', {
        completionTimeStart: new Date(completionTimeStart),
        completionTimeEnd: new Date(completionTimeEnd),
      });
    }

    // 排序
    queryBuilder.orderBy(`task.${sortBy}`, sortOrder);

    // 分页
    const [tasks, total] = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { tasks, total };
  }

  /**
   * 根据ID查询历史任务实例
   */
  async findHistoricTaskInstanceById(id: string): Promise<HistoricTaskInstance> {
    const task = await this.historicTaskInstanceRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Historic task instance with ID ${id} not found`);
    }
    return task;
  }

  /**
   * 根据流程实例ID查询历史任务实例
   */
  async findHistoricTaskInstancesByProcessInstanceId(processInstanceId: string): Promise<HistoricTaskInstance[]> {
    return this.historicTaskInstanceRepository.find({ 
      where: { processInstanceId },
      order: { createTime: 'ASC' }
    });
  }

  /**
   * 根据任务负责人查询历史任务实例
   */
  async findHistoricTaskInstancesByAssignee(assignee: string): Promise<HistoricTaskInstance[]> {
    return this.historicTaskInstanceRepository.find({ 
      where: { assignee },
      order: { createTime: 'DESC' }
    });
  }

  /**
   * 查询历史流程实例
   */
  async findHistoricProcessInstances(query: any): Promise<{ processes: HistoricProcessInstance[]; total: number }> {
    const {
      processDefinitionId,
      processDefinitionKey,
      businessKey,
      startUserId,
      status,
      startTimeStart,
      startTimeEnd,
      endTimeStart,
      endTimeEnd,
      page = 1,
      pageSize = 10,
      sortBy = 'startTime',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.historicProcessInstanceRepository.createQueryBuilder('process');

    // 添加查询条件
    if (processDefinitionId) {
      queryBuilder.andWhere('process.processDefinitionId = :processDefinitionId', { processDefinitionId });
    }
    if (processDefinitionKey) {
      queryBuilder.andWhere('process.processDefinitionKey = :processDefinitionKey', { processDefinitionKey });
    }
    if (businessKey) {
      queryBuilder.andWhere('process.businessKey = :businessKey', { businessKey });
    }
    if (startUserId) {
      queryBuilder.andWhere('process.startUserId = :startUserId', { startUserId });
    }
    if (status) {
      queryBuilder.andWhere('process.status = :status', { status });
    }
    if (startTimeStart && startTimeEnd) {
      queryBuilder.andWhere('process.startTime BETWEEN :startTimeStart AND :startTimeEnd', {
        startTimeStart: new Date(startTimeStart),
        startTimeEnd: new Date(startTimeEnd),
      });
    }
    if (endTimeStart && endTimeEnd) {
      queryBuilder.andWhere('process.endTime BETWEEN :endTimeStart AND :endTimeEnd', {
        endTimeStart: new Date(endTimeStart),
        endTimeEnd: new Date(endTimeEnd),
      });
    }

    // 排序
    queryBuilder.orderBy(`process.${sortBy}`, sortOrder);

    // 分页
    const [processes, total] = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { processes, total };
  }

  /**
   * 根据ID查询历史流程实例
   */
  async findHistoricProcessInstanceById(id: string): Promise<HistoricProcessInstance> {
    const process = await this.historicProcessInstanceRepository.findOne({ where: { id } });
    if (!process) {
      throw new NotFoundException(`Historic process instance with ID ${id} not found`);
    }
    return process;
  }

  /**
   * 根据流程实例ID查询历史流程实例
   */
  async findHistoricProcessInstanceByProcessInstanceId(processInstanceId: string): Promise<HistoricProcessInstance> {
    return this.historicProcessInstanceRepository.findOne({ where: { processInstanceId } });
  }

  /**
   * 根据业务Key查询历史流程实例
   */
  async findHistoricProcessInstancesByBusinessKey(businessKey: string): Promise<HistoricProcessInstance[]> {
    return this.historicProcessInstanceRepository.find({ 
      where: { businessKey },
      order: { startTime: 'DESC' }
    });
  }

  /**
   * 获取流程实例的完整历史
   */
  async getProcessInstanceHistory(processInstanceId: string): Promise<any> {
    const processInstance = await this.findHistoricProcessInstanceByProcessInstanceId(processInstanceId);
    const activities = await this.findHistoricActivityInstancesByProcessInstanceId(processInstanceId);
    const tasks = await this.findHistoricTaskInstancesByProcessInstanceId(processInstanceId);

    return {
      processInstance,
      activities,
      tasks,
    };
  }

  /**
   * 删除历史流程实例
   */
  async deleteHistoricProcessInstance(id: string): Promise<void> {
    const processInstance = await this.findHistoricProcessInstanceById(id);
    await this.historicProcessInstanceRepository.remove(processInstance);
  }

  /**
   * 删除历史任务实例
   */
  async deleteHistoricTaskInstance(id: string): Promise<void> {
    const taskInstance = await this.findHistoricTaskInstanceById(id);
    await this.historicTaskInstanceRepository.remove(taskInstance);
  }

  /**
   * 删除历史活动实例
   */
  async deleteHistoricActivityInstance(id: string): Promise<void> {
    const activityInstance = await this.findHistoricActivityInstanceById(id);
    await this.historicActivityInstanceRepository.remove(activityInstance);
  }

  /**
   * 创建历史任务实例
   */
  async createHistoricTask(params: {
    taskId: string;
    taskDefinitionKey: string;
    taskDefinitionId: string;
    taskDefinitionVersion: number;
    processInstanceId: string;
    processDefinitionId: string;
    processDefinitionKey: string;
    processDefinitionVersion: number;
    executionId?: string;
    name: string;
    description?: string;
    assignee?: string;
    assigneeFullName?: string;
    owner?: string;
    priority?: number;
    dueDate?: Date;
    category?: string;
    tenantId?: string;
    status?: HistoricTaskStatus;
    formKey?: string;
    formData?: Record<string, any>;
    variables?: Record<string, any>;
  }): Promise<HistoricTaskInstance> {
    const historicTask = this.historicTaskInstanceRepository.create({
      ...params,
      status: params.status || HistoricTaskStatus.CREATED,
      createTime: new Date(),
    });
    return this.historicTaskInstanceRepository.save(historicTask);
  }

  /**
   * 更新历史任务实例状态
   */
  async updateHistoricTaskStatus(
    taskId: string,
    status: HistoricTaskStatus,
    options?: {
      assignee?: string;
      assigneeFullName?: string;
      completionTime?: Date;
      deleteReason?: string;
    },
  ): Promise<HistoricTaskInstance> {
    const historicTask = await this.historicTaskInstanceRepository.findOne({
      where: { taskId },
    });
    if (!historicTask) {
      throw new NotFoundException(`Historic task with taskId ${taskId} not found`);
    }
    
    historicTask.status = status;
    if (options?.assignee !== undefined) {
      historicTask.assignee = options.assignee;
    }
    if (options?.assigneeFullName !== undefined) {
      historicTask.assigneeFullName = options.assigneeFullName;
    }
    if (options?.completionTime !== undefined) {
      historicTask.completionTime = options.completionTime;
      if (historicTask.createTime) {
        historicTask.duration = options.completionTime.getTime() - historicTask.createTime.getTime();
      }
    }
    if (options?.deleteReason !== undefined) {
      historicTask.deleteReason = options.deleteReason;
    }
    
    return this.historicTaskInstanceRepository.save(historicTask);
  }

  /**
   * 根据任务ID查询历史任务实例
   */
  async findHistoricTaskByTaskId(taskId: string): Promise<HistoricTaskInstance | null> {
    return this.historicTaskInstanceRepository.findOne({ where: { taskId } });
  }
}
