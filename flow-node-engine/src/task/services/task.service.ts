import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository,  } from 'typeorm';

import { BusinessException } from '../../common/exceptions/business.exception';
import { EventBusService } from '../../core/services/event-bus.service';
import { ProcessEngineService } from '../../core/services/process-engine.service';
import { ClaimTaskDto } from '../dto/claim-task.dto';
import { CompleteTaskDto } from '../dto/complete-task.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { QueryTaskDto } from '../dto/query-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { Task, TaskStatus } from '../entities/task.entity';

/**
 * 任务服务
 */
@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    private eventBusService: EventBusService,
    private processEngineService: ProcessEngineService,
  ) {}

  /**
   * 创建任务
   */
  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    const task = this.taskRepository.create({
      ...createTaskDto,
      status: TaskStatus.CREATED,
      createTime: new Date(),
    });

    const savedTask = await this.taskRepository.save(task);

    // 发送任务创建事件
    await this.eventBusService.emit('task.created', {
      taskId: savedTask.id,
      processInstanceId: savedTask.processInstanceId,
      taskDefinitionKey: savedTask.taskDefinitionKey,
    });

    return savedTask;
  }

  /**
   * 查询所有任务（分页）
   */
  async findAll(query: QueryTaskDto): Promise<{ tasks: Task[]; total: number }> {
    const {
      taskId,
      processInstanceId,
      assignee,
      owner,
      taskDefinitionKey,
      status,
      category,
      tenantId,
      statusList,
      assigneeList,
      taskDefinitionKeyList,
      createTimeStart,
      createTimeEnd,
      dueDateStart,
      dueDateEnd,
      page = 1,
      pageSize = 10,
      sortBy = 'createTime',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.taskRepository.createQueryBuilder('task');

    // 添加查询条件
    if (taskId) {
      queryBuilder.andWhere('task.id = :taskId', { taskId });
    }
    if (processInstanceId) {
      queryBuilder.andWhere('task.processInstanceId = :processInstanceId', { processInstanceId });
    }
    if (assignee) {
      queryBuilder.andWhere('task.assignee = :assignee', { assignee });
    }
    if (owner) {
      queryBuilder.andWhere('task.owner = :owner', { owner });
    }
    if (taskDefinitionKey) {
      queryBuilder.andWhere('task.taskDefinitionKey = :taskDefinitionKey', { taskDefinitionKey });
    }
    if (status) {
      queryBuilder.andWhere('task.status = :status', { status });
    }
    if (category) {
      queryBuilder.andWhere('task.category = :category', { category });
    }
    if (tenantId) {
      queryBuilder.andWhere('task.tenantId = :tenantId', { tenantId });
    }
    if (statusList && statusList.length > 0) {
      queryBuilder.andWhere('task.status IN (:...statusList)', { statusList });
    }
    if (assigneeList && assigneeList.length > 0) {
      queryBuilder.andWhere('task.assignee IN (:...assigneeList)', { assigneeList });
    }
    if (taskDefinitionKeyList && taskDefinitionKeyList.length > 0) {
      queryBuilder.andWhere('task.taskDefinitionKey IN (:...taskDefinitionKeyList)', { taskDefinitionKeyList });
    }
    if (createTimeStart && createTimeEnd) {
      queryBuilder.andWhere('task.createTime BETWEEN :createTimeStart AND :createTimeEnd', {
        createTimeStart: new Date(createTimeStart),
        createTimeEnd: new Date(createTimeEnd),
      });
    }
    if (dueDateStart && dueDateEnd) {
      queryBuilder.andWhere('task.dueDate BETWEEN :dueDateStart AND :dueDateEnd', {
        dueDateStart: new Date(dueDateStart),
        dueDateEnd: new Date(dueDateEnd),
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
   * 根据ID查询任务
   */
  async findById(id: string): Promise<Task> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return task;
  }

  /**
   * 根据流程实例ID查询任务
   */
  async findByProcessInstanceId(processInstanceId: string): Promise<Task[]> {
    return this.taskRepository.find({ where: { processInstanceId } });
  }

  /**
   * 根据任务负责人查询任务
   */
  async findByAssignee(assignee: string): Promise<Task[]> {
    return this.taskRepository.find({ where: { assignee } });
  }

  /**
   * 更新任务
   */
  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const task = await this.findById(id);

    // 检查任务状态
    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) {
      throw new BusinessException('Cannot update a completed or cancelled task');
    }

    // 更新任务
    Object.assign(task, updateTaskDto, { updateTime: new Date() });

    const updatedTask = await this.taskRepository.save(task);

    // 发送任务更新事件
    await this.eventBusService.emit('task.updated', {
      taskId: updatedTask.id,
      processInstanceId: updatedTask.processInstanceId,
      taskDefinitionKey: updatedTask.taskDefinitionKey,
    });

    return updatedTask;
  }

  /**
   * 认领任务
   */
  async claim(claimTaskDto: ClaimTaskDto): Promise<Task> {
    const { taskId, assignee, assigneeFullName } = claimTaskDto;

    const task = await this.findById(taskId);

    // 检查任务状态
    if (task.status !== TaskStatus.CREATED && task.status !== TaskStatus.UNASSIGNED) {
      throw new BusinessException('Task is not available for claiming');
    }

    // 更新任务
    task.assignee = assignee || task.assignee;
    task.assigneeFullName = assigneeFullName || task.assigneeFullName;
    task.status = TaskStatus.ASSIGNED;
    task.claimTime = new Date();
    task.updateTime = new Date();

    const updatedTask = await this.taskRepository.save(task);

    // 发送任务认领事件
    await this.eventBusService.emit('task.claimed', {
      taskId: updatedTask.id,
      processInstanceId: updatedTask.processInstanceId,
      taskDefinitionKey: updatedTask.taskDefinitionKey,
      assignee: updatedTask.assignee,
    });

    return updatedTask;
  }

  /**
   * 取消认领任务
   */
  async unclaim(taskId: string): Promise<Task> {
    const task = await this.findById(taskId);

    // 检查任务状态
    if (task.status !== TaskStatus.ASSIGNED) {
      throw new BusinessException('Task is not assigned');
    }

    // 更新任务
    task.assignee = null;
    task.assigneeFullName = null;
    task.status = TaskStatus.UNASSIGNED;
    task.claimTime = null;
    task.updateTime = new Date();

    const updatedTask = await this.taskRepository.save(task);

    // 发送任务取消认领事件
    await this.eventBusService.emit('task.unclaimed', {
      taskId: updatedTask.id,
      processInstanceId: updatedTask.processInstanceId,
      taskDefinitionKey: updatedTask.taskDefinitionKey,
    });

    return updatedTask;
  }

  /**
   * 完成任务
   */
  async complete(completeTaskDto: CompleteTaskDto): Promise<Task> {
    const { taskId, userId, formData, variables } = completeTaskDto;

    const task = await this.findById(taskId);

    // 检查任务状态
    if (task.status !== TaskStatus.ASSIGNED) {
      throw new BusinessException('Task is not assigned');
    }

    // 更新任务
    task.status = TaskStatus.COMPLETED;
    task.completionTime = new Date();
    task.updateTime = new Date();

    // 保存表单数据和变量
    if (formData) {
      task.formData = { ...task.formData, ...formData };
    }
    if (variables) {
      task.variables = { ...task.variables, ...variables };
    }

    const updatedTask = await this.taskRepository.save(task);

    // 发送任务完成事件
    await this.eventBusService.emit('task.completed', {
      taskId: updatedTask.id,
      processInstanceId: updatedTask.processInstanceId,
      taskDefinitionKey: updatedTask.taskDefinitionKey,
      assignee: updatedTask.assignee,
      formData: updatedTask.formData,
      variables: updatedTask.variables,
    });

    // 继续流程执行
    try {
      await this.processEngineService.continueProcess(
        updatedTask.processInstanceId,
        updatedTask.taskDefinitionKey,
        updatedTask.variables,
      );
    } catch (error) {
      console.error('Failed to continue process after task completion:', error);
    }

    return updatedTask;
  }

  /**
   * 取消任务
   */
  async cancel(taskId: string, reason?: string): Promise<Task> {
    const task = await this.findById(taskId);

    // 检查任务状态
    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) {
      throw new BusinessException('Cannot cancel a completed or cancelled task');
    }

    // 更新任务
    task.status = TaskStatus.CANCELLED;
    task.updateTime = new Date();

    const updatedTask = await this.taskRepository.save(task);

    // 发送任务取消事件
    await this.eventBusService.emit('task.cancelled', {
      taskId: updatedTask.id,
      processInstanceId: updatedTask.processInstanceId,
      taskDefinitionKey: updatedTask.taskDefinitionKey,
      reason,
    });

    return updatedTask;
  }

  /**
   * 删除任务
   */
  async delete(id: string): Promise<void> {
    const task = await this.findById(id);

    // 检查任务状态
    if (task.status === TaskStatus.COMPLETED) {
      throw new BusinessException('Cannot delete a completed task');
    }

    await this.taskRepository.remove(task);

    // 发送任务删除事件
    await this.eventBusService.emit('task.deleted', {
      taskId: task.id,
      processInstanceId: task.processInstanceId,
      taskDefinitionKey: task.taskDefinitionKey,
    });
  }

  /**
   * 获取任务统计信息
   */
  async getStatistics(assignee?: string): Promise<any> {
    const queryBuilder = this.taskRepository.createQueryBuilder('task');

    if (assignee) {
      queryBuilder.andWhere('task.assignee = :assignee', { assignee });
    }

    const total = await queryBuilder.getCount();
    const created = await queryBuilder.andWhere('task.status = :status', { status: TaskStatus.CREATED }).getCount();
    const assigned = await queryBuilder.andWhere('task.status = :status', { status: TaskStatus.ASSIGNED }).getCount();
    const unassigned = await queryBuilder.andWhere('task.status = :status', { status: TaskStatus.UNASSIGNED }).getCount();
    const completed = await queryBuilder.andWhere('task.status = :status', { status: TaskStatus.COMPLETED }).getCount();
    const cancelled = await queryBuilder.andWhere('task.status = :status', { status: TaskStatus.CANCELLED }).getCount();

    return {
      total,
      created,
      assigned,
      unassigned,
      completed,
      cancelled,
    };
  }
}
