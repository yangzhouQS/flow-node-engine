/**
 * 站内通知实体
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type NotificationType =
  | 'TASK_ASSIGNED'        // 任务分配
  | 'TASK_COMPLETED'       // 任务完成
  | 'TASK_REJECTED'        // 任务驳回
  | 'TASK_CC'              // 抄送
  | 'PROCESS_STARTED'      // 流程启动
  | 'PROCESS_COMPLETED'    // 流程完成
  | 'PROCESS_TERMINATED'   // 流程终止
  | 'DEADLINE_WARNING'     // 截止日期警告
  | 'DEADLINE_OVERDUE'     // 超期提醒
  | 'SYSTEM';              // 系统通知

export type NotificationStatus = 'UNREAD' | 'READ' | 'ARCHIVED';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

@Entity('act_ru_notification')
@Index('idx_notification_user_status', ['userId', 'status'])
@Index('idx_notification_user_created', ['userId', 'createdAt'])
export class InAppNotification {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ type: 'varchar', length: 64 })
  @Index('idx_notification_user')
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'varchar', length: 20, default: 'NORMAL' })
  priority: NotificationPriority;

  @Column({ type: 'varchar', length: 20, default: 'UNREAD' })
  status: NotificationStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  @Index('idx_notification_task')
  taskId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  @Index('idx_notification_process')
  processInstanceId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  processDefinitionId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  link: string;

  @Column({ type: 'json', nullable: true })
  extraData: Record<string, any>;

  @Column({ type: 'varchar', length: 64, nullable: true })
  senderId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  senderName: string;

  @CreateDateColumn()
  @Index('idx_notification_created')
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  readAt: Date;

  @Column({ type: 'datetime', nullable: true })
  archivedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;
}
