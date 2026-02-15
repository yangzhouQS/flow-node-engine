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

// 获取枚举值数组用于Swagger
const eventTypeValues = Object.values(EventType);
const eventStatusValues = Object.values(EventStatus);

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
    enum: eventTypeValues,
    example: EventType.PROCESS_INSTANCE_START 
  })
  @Column({
    type: 'enum',
    enum: EventType,
    name: 'event_type',
  })
  eventType: EventType;

  @ApiProperty({ 
    description: '事件状态', 
    enum: eventStatusValues,
    example: EventStatus.PENDING 
  })
  @Column({
    type: 'enum',
    enum: EventStatus,
    name: 'event_status',
    default: EventStatus.PENDING,
  })
  eventStatus: EventStatus;

  @Column({ name: 'process_instance_id', nullable: true })
  processInstanceId: string;

  @Column({ name: 'process_definition_id', nullable: true })
  processDefinitionId: string;

  @Column({ name: 'process_definition_key', nullable: true })
  processDefinitionKey: string;

  @Column({ name: 'execution_id', nullable: true })
  executionId: string;

  @Column({ name: 'activity_id', nullable: true })
  activityId: string;

  @Column({ name: 'activity_name', nullable: true })
  activityName: string;

  @Column({ name: 'task_id', nullable: true })
  taskId: string;

  @Column({ name: 'task_name', nullable: true })
  taskName: string;

  @Column({ name: 'assignee', nullable: true })
  assignee: string;

  @Column({ name: 'event_name', nullable: true })
  eventName: string;

  @Column({ name: 'event_code', nullable: true })
  eventCode: string;

  @Column({ type: 'json', nullable: true })
  eventData: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  payload: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', default: 3 })
  maxRetries: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'processed_time', type: 'timestamp', nullable: true })
  processedTime: Date;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}
