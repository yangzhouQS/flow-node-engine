import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class EventBusService {
  private readonly eventEmitter: EventEmitter2;

  constructor() {
    this.eventEmitter = new EventEmitter2();
  }

  // 发布事件
  emit(eventType: string, data?: any): void {
    this.eventEmitter.emit(eventType, data);
  }

  // 监听事件
  on(eventType: string, listener: (data: any) => void): void {
    this.eventEmitter.on(eventType, listener);
  }

  // 移除监听器
  off(eventType: string, listener: (data: any) => void): void {
    this.eventEmitter.off(eventType, listener);
  }
}
