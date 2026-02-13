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

  // publish 是 emit 的别名
  publish(eventType: string, data?: any): void {
    this.emit(eventType, data);
  }

  // 监听事件
  on(eventType: string, listener: (data: any) => void): void {
    this.eventEmitter.on(eventType, listener);
  }

  // subscribe 是 on 的别名
  subscribe(eventType: string, listener: (data: any) => void): void {
    this.on(eventType, listener);
  }

  // 移除监听器
  off(eventType: string, listener: (data: any) => void): void {
    this.eventEmitter.off(eventType, listener);
  }

  // unsubscribe 是 off 的别名
  unsubscribe(eventType: string, listener: (data: any) => void): void {
    this.off(eventType, listener);
  }

  // 一次性监听
  once(eventType: string, listener: (data: any) => void): void {
    this.eventEmitter.once(eventType, listener);
  }
}
