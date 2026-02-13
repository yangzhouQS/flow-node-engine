/**
 * 任务锁服务
 * 处理多人同时操作同一任务的并发控制
 */
import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Task } from '../entities/task.entity';

export interface TaskLock {
  taskId: string;
  userId: string;
  lockedAt: Date;
  expiresAt: Date;
}

export interface LockResult {
  success: boolean;
  message: string;
  lockInfo?: TaskLock;
}

@Injectable()
export class TaskLockService {
  private readonly logger = new Logger(TaskLockService.name);
  private readonly locks: Map<string, TaskLock> = new Map();
  private readonly LOCK_TTL = 30000; // 30秒锁过期时间

  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly dataSource: DataSource,
  ) {
    // 定期清理过期锁
    setInterval(() => this.cleanupExpiredLocks(), 10000);
  }

  /**
   * 尝试获取任务锁
   * @param taskId 任务ID
   * @param userId 用户ID
   * @returns 是否成功获取锁
   */
  async acquireLock(taskId: string, userId: string): Promise<boolean> {
    this.logger.debug(`尝试获取锁: 任务=${taskId}, 用户=${userId}`);

    const existingLock = this.locks.get(taskId);

    // 如果锁已存在且未过期
    if (existingLock) {
      if (existingLock.expiresAt > new Date()) {
        // 如果是同一个用户，允许续期
        if (existingLock.userId === userId) {
          this.renewLockInternal(taskId, userId);
          return true;
        }
        // 其他用户的锁仍然有效
        return false;
      }
      // 锁已过期，清除旧锁
      this.locks.delete(taskId);
    }

    // 创建新锁
    const now = new Date();
    const lock: TaskLock = {
      taskId,
      userId,
      lockedAt: now,
      expiresAt: new Date(now.getTime() + this.LOCK_TTL),
    };

    this.locks.set(taskId, lock);
    this.logger.debug(`锁获取成功: 任务=${taskId}, 用户=${userId}`);

    return true;
  }

  /**
   * 释放任务锁
   * @param taskId 任务ID
   * @param userId 用户ID
   * @returns 是否成功释放
   */
  async releaseLock(taskId: string, userId: string): Promise<boolean> {
    this.logger.debug(`尝试释放锁: 任务=${taskId}, 用户=${userId}`);

    const existingLock = this.locks.get(taskId);

    if (!existingLock) {
      return true; // 锁不存在，视为已释放
    }

    // 只有锁的持有者才能释放锁
    if (existingLock.userId !== userId) {
      this.logger.warn(`无权释放锁: 任务=${taskId}, 持有者=${existingLock.userId}, 请求者=${userId}`);
      return false;
    }

    this.locks.delete(taskId);
    this.logger.debug(`锁释放成功: 任务=${taskId}, 用户=${userId}`);

    return true;
  }

  /**
   * 获取任务锁信息
   * @param taskId 任务ID
   * @returns 锁信息
   */
  async getLockInfo(taskId: string): Promise<TaskLock | null> {
    const lock = this.locks.get(taskId);

    if (!lock) {
      return null;
    }

    // 检查锁是否过期
    if (lock.expiresAt <= new Date()) {
      this.locks.delete(taskId);
      return null;
    }

    return lock;
  }

  /**
   * 续期任务锁
   * @param taskId 任务ID
   * @param userId 用户ID
   * @returns 是否成功续期
   */
  async renewLock(taskId: string, userId: string): Promise<boolean> {
    const lock = this.locks.get(taskId);

    if (!lock) {
      return false;
    }

    if (lock.userId !== userId) {
      return false;
    }

    return this.renewLockInternal(taskId, userId);
  }

  /**
   * 内部续期方法
   */
  private renewLockInternal(taskId: string, userId: string): boolean {
    const lock = this.locks.get(taskId);

    if (lock?.userId !== userId) {
      return false;
    }

    const now = new Date();
    lock.expiresAt = new Date(now.getTime() + this.LOCK_TTL);

    this.logger.debug(`锁续期成功: 任务=${taskId}, 用户=${userId}, 新过期时间=${lock.expiresAt}`);

    return true;
  }

  /**
   * 强制释放锁（管理员操作）
   * @param taskId 任务ID
   */
  async forceReleaseLock(taskId: string): Promise<void> {
    this.locks.delete(taskId);
    this.logger.warn(`强制释放锁: 任务=${taskId}`);
  }

  /**
   * 使用锁执行任务操作
   * @param taskId 任务ID
   * @param userId 用户ID
   * @param operation 要执行的操作
   * @returns 操作结果
   */
  async withLock<T>(
    taskId: string,
    userId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    // 1. 尝试获取锁
    const acquired = await this.acquireLock(taskId, userId);

    if (!acquired) {
      const lockInfo = await this.getLockInfo(taskId);
      throw new ConflictException(
        `任务正在被用户 ${lockInfo?.userId} 操作中，请稍后重试`,
      );
    }

    try {
      // 2. 执行操作
      return await operation();
    } finally {
      // 3. 释放锁
      await this.releaseLock(taskId, userId);
    }
  }

  /**
   * 清理过期锁
   */
  private cleanupExpiredLocks(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [taskId, lock] of this.locks.entries()) {
      if (lock.expiresAt <= now) {
        this.locks.delete(taskId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`清理过期锁: ${cleanedCount} 个`);
    }
  }

  /**
   * 获取所有活动锁
   */
  async getAllActiveLocks(): Promise<TaskLock[]> {
    const now = new Date();
    const activeLocks: TaskLock[] = [];

    for (const [taskId, lock] of this.locks.entries()) {
      if (lock.expiresAt > now) {
        activeLocks.push(lock);
      } else {
        this.locks.delete(taskId);
      }
    }

    return activeLocks;
  }

  /**
   * 获取用户持有的所有锁
   * @param userId 用户ID
   */
  async getLocksByUser(userId: string): Promise<TaskLock[]> {
    const now = new Date();
    const userLocks: TaskLock[] = [];

    for (const [taskId, lock] of this.locks.entries()) {
      if (lock.userId === userId && lock.expiresAt > now) {
        userLocks.push(lock);
      } else if (lock.expiresAt <= now) {
        this.locks.delete(taskId);
      }
    }

    return userLocks;
  }

  /**
   * 释放用户持有的所有锁
   * @param userId 用户ID
   */
  async releaseAllLocksByUser(userId: string): Promise<number> {
    let releasedCount = 0;

    for (const [taskId, lock] of this.locks.entries()) {
      if (lock.userId === userId) {
        this.locks.delete(taskId);
        releasedCount++;
      }
    }

    if (releasedCount > 0) {
      this.logger.debug(`释放用户所有锁: 用户=${userId}, 数量=${releasedCount}`);
    }

    return releasedCount;
  }

  /**
   * 检查任务是否被锁定
   * @param taskId 任务ID
   */
  async isLocked(taskId: string): Promise<boolean> {
    const lock = await this.getLockInfo(taskId);
    return lock !== null;
  }

  /**
   * 检查用户是否持有任务锁
   * @param taskId 任务ID
   * @param userId 用户ID
   */
  async isLockHolder(taskId: string, userId: string): Promise<boolean> {
    const lock = await this.getLockInfo(taskId);
    return lock !== null && lock.userId === userId;
  }
}
