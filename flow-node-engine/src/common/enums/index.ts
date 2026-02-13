// 流程实例状态
export enum ProcessInstanceStatus {
  RUNNING = 'RUNNING',
  SUSPENDED = 'SUSPENDED',
  COMPLETED = 'COMPLETED',
  TERMINATED = 'TERMINATED',
}

// 任务类型
export enum TaskType {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  DELEGATE = 'DELEGATE',
}

// 任务状态
export enum TaskStatus {
  CREATED = 'CREATED',
  CLAIMED = 'CLAIMED',
  ASSIGNED = 'ASSIGNED',
  COMPLETED = 'COMPLETED',
  DELEGATED = 'DELEGATED',
  DELETED = 'DELETED',
}

// 暂停状态
export enum SuspensionState {
  ACTIVE = 1,
  SUSPENDED = 2,
}

// 定时器类型
export enum TimerType {
  START_EVENT = 'START_EVENT',
  BOUNDARY_EVENT = 'BOUNDARY_EVENT',
  INTERMEDIATE_EVENT = 'INTERMEDIATE_EVENT',
}

// 定时器状态
export enum TimerStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// 事件订阅类型
export enum EventSubscriptionType {
  MESSAGE = 'MESSAGE',
  SIGNAL = 'SIGNAL',
  TIMER = 'TIMER',
  COMPENSATE = 'COMPENSATE',
}

// 用户状态
export enum UserStatus {
  ACTIVE = 1,
  INACTIVE = 0,
}

// 审计操作类型
export enum AuditOperation {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
}

// 资源类型
export enum ResourceType {
  PROCESS_DEFINITION = 'PROCESS_DEFINITION',
  PROCESS_INSTANCE = 'PROCESS_INSTANCE',
  TASK = 'TASK',
  USER = 'USER',
  ROLE = 'ROLE',
  GROUP = 'GROUP',
}
