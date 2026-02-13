import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * 事件订阅类型
 */
export enum EventSubscriptionType {
  /** 消息事件 */
  MESSAGE = 'message',
  /** 信号事件 */
  SIGNAL = 'signal',
  /** 条件事件 */
  CONDITIONAL = 'conditional',
  /** 补偿事件 */
  COMPENSATION = 'compensation',
  /** 错误事件 */
  ERROR = 'error',
  /** 定时器事件 */
  TIMER = 'timer',
  /** 升级事件 */
  ESCALATION = 'escalation',
}

/**
 * 事件订阅配置类型
 */
export enum EventSubscriptionConfigType {
  /** 边界事件 */
  BOUNDARY = 'boundary',
  /** 事件子流程 */
  EVENT_SUBPROCESS = 'eventSubprocess',
  /** 开始事件 */
  START_EVENT = 'startEvent',
  /** 中间捕获事件 */
  INTERMEDIATE_CATCH = 'intermediateCatch',
  /** 事件网关 */
  EVENT_GATEWAY = 'eventGateway',
}

/**
 * 事件订阅实体
 * 用于管理流程实例中的各种事件订阅
 */
@Entity('act_ru_event_subscription')
@Index('idx_event_subscription_proc_inst', ['process_inst_id_'])
@Index('idx_event_subscription_execution', ['execution_id_'])
@Index('idx_event_subscription_event_name', ['event_name_', 'event_type_'])
@Index('idx_event_subscription_tenant', ['tenant_id_'])
export class EventSubscription {
  /** 主键ID */
  @PrimaryColumn({ type: 'varchar', length: 64, name: 'id_' })
  id_: string;

  /** 事件类型 */
  @Column({ 
    type: 'enum', 
    enum: EventSubscriptionType, 
    name: 'event_type_' 
  })
  event_type_: EventSubscriptionType;

  /** 事件名称（消息名、信号名等） */
  @Column({ type: 'varchar', length: 255, name: 'event_name_' })
  event_name_: string;

  /** 流程定义ID */
  @Column({ type: 'varchar', length: 64, name: 'process_def_id_', nullable: true })
  process_def_id_: string | null;

  /** 流程定义Key */
  @Column({ type: 'varchar', length: 255, name: 'process_def_key_', nullable: true })
  process_def_key_: string | null;

  /** 流程实例ID */
  @Column({ type: 'varchar', length: 64, name: 'process_inst_id_', nullable: true })
  process_inst_id_: string | null;

  /** 执行ID */
  @Column({ type: 'varchar', length: 64, name: 'execution_id_', nullable: true })
  execution_id_: string | null;

  /** 活动ID */
  @Column({ type: 'varchar', length: 255, name: 'activity_id_', nullable: true })
  activity_id_: string | null;

  /** 活动名称 */
  @Column({ type: 'varchar', length: 255, name: 'activity_name_', nullable: true })
  activity_name_: string | null;

  /** 配置类型 */
  @Column({ 
    type: 'enum', 
    enum: EventSubscriptionConfigType, 
    name: 'configuration_type_',
    nullable: true 
  })
  configuration_type_: EventSubscriptionConfigType | null;

  /** 配置数据（JSON格式） */
  @Column({ type: 'text', name: 'configuration_', nullable: true })
  configuration_: string | null;

  /** 创建时间 */
  @CreateDateColumn({ type: 'datetime', name: 'create_time_' })
  create_time_: Date;

  /** 租户ID */
  @Column({ type: 'varchar', length: 255, name: 'tenant_id_', nullable: true })
  tenant_id_: string | null;

  /** 回调ID（用于关联异步回调） */
  @Column({ type: 'varchar', length: 64, name: 'callback_id_', nullable: true })
  callback_id_: string | null;

  /** 优先级 */
  @Column({ type: 'int', name: 'priority_', nullable: true, default: 0 })
  priority_: number | null;

  /** 是否已处理 */
  @Column({ type: 'boolean', name: 'is_processed_', default: false })
  is_processed_: boolean;

  /** 处理时间 */
  @Column({ type: 'datetime', name: 'processed_time_', nullable: true })
  processed_time_: Date | null;

  /** 扩展数据（JSON格式） */
  @Column({ type: 'text', name: 'extra_data_', nullable: true })
  extra_data_: string | null;
}
