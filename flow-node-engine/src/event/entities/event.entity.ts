import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum EventType {
  PROCESS_INSTANCE_START = 'PROCESS_INSTANCE_START',
  PROCESS_INSTANCE_END = 'PROCESS_INSTANCE_END',
  PROCESS_INSTANCE_SUSPEND = 'PROCESS_INSTANCE_SUSPEND',
  PROCESS_INSTANCE_ACTIVATE = 'PROCESS_INSTANCE_ACTIVATE',
  TASK_CREATED = 'TASK_CREATED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_CANCELLED = 'TASK_CANCELLED',
  ACTIVITY_STARTED = 'ACTIVITY_STARTED',
  ACTIVITY_COMPLETED = 'ACTIVITY_COMPLETED',
  VARIABLE_CREATED = 'VARIABLE_CREATED',
  VARIABLE_UPDATED = 'VARIABLE_UPDATED',
  VARIABLE_DELETED = 'VARIABLE_DELETED',
  SIGNAL_THROWN = 'SIGNAL_THROWN',
  SIGNAL_RECEIVED = 'SIGNAL_RECEIVED',
  MESSAGE_SENT = 'MESSAGE_SENT',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  ERROR_THROWN = 'ERROR_THROWN',
  ERROR_RECEIVED = 'ERROR_RECEIVED',
  TIMER_FIRED = 'TIMER_FIRED',
  COMPENSATION_TRIGGERED = 'COMPENSATION_TRIGGERED',
  CUSTOM = 'CUSTOM',
}

export enum EventStatus {
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

@Entity('events')
@Index(['eventType'])
@Index(['eventStatus'])
@Index(['processInstanceId'])
@Index(['taskId'])
@Index(['createTime'])
export class Event {
  @ApiProperty({ description: '事件ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ 
    description: '事件类型', 
    enum: EventType,
    example: 'PROCESS_INSTANCE_START'
  })
  @Column({
    type: 'enum',
    enum: EventType,
    name: 'event_type',
  })
  eventType: EventType;

  @ApiProperty({ 
    description: '事件状态', 
    enum: EventStatus,
    example: 'PENDING'
  })
  @Column({
    type: 'enum',
    enum: EventStatus,
    name: 'event_status',
    default: EventStatus.PENDING,
  })
  eventStatus: EventStatus;

  @ApiProperty({ description: '流程实例ID', required: false })
  @Column({ name: 'process_instance_id', nullable: true })
  processInstanceId: string;

  @ApiProperty({ description: '流程定义ID', required: false })
  @Column({ name: 'process_definition_id', nullable: true })
  processDefinitionId: string;

  @ApiProperty({ description: '流程定义Key', required: false })
  @Column({ name: 'process_definition_key', nullable: true })
  processDefinitionKey: string;

  @ApiProperty({ description: '执行ID', required: false })
  @Column({ name: 'execution_id', nullable: true })
  executionId: string;

  @ApiProperty({ description: '活动ID', required: false })
  @Column({ name: 'activity_id', nullable: true })
  activityId: string;

  @ApiProperty({ description: '活动名称', required: false })
  @Column({ name: 'activity_name', nullable: true })
  activityName: string;

  @ApiProperty({ description: '任务ID', required: false })
  @Column({ name: 'task_id', nullable: true })
  taskId: string;

  @ApiProperty({ description: '任务名称', required: false })
  @Column({ name: 'task_name', nullable: true })
  taskName: string;

  @ApiProperty({ description: '受让人', required: false })
  @Column({ name: 'assignee', nullable: true })
  assignee: string;

  @ApiProperty({ description: '事件名称', required: false })
  @Column({ name: 'event_name', nullable: true })
  eventName: string;

  @ApiProperty({ description: '事件代码', required: false })
  @Column({ name: 'event_code', nullable: true })
  eventCode: string;

  @ApiProperty({ description: '事件数据', required: false })
  @Column({ type: 'json', nullable: true })
  eventData: Record<string, any>;

  @ApiProperty({ description: '载荷', required: false })
  @Column({ type: 'text', nullable: true })
  payload: string;

  @ApiProperty({ description: '租户ID', required: false })
  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @ApiProperty({ description: '重试次数', example: 0 })
  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @ApiProperty({ description: '最大重试次数', example: 3 })
  @Column({ name: 'max_retries', default: 3 })
  maxRetries: number;

  @ApiProperty({ description: '错误信息', required: false })
  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @ApiProperty({ description: '处理时间', required: false })
  @Column({ name: 'processed_time', type: 'timestamp', nullable: true })
  processedTime: Date;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}
