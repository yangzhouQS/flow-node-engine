import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBusService } from './event-bus.service';

describe('EventBusService', () => {
  let service: EventBusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventBusService],
    }).compile();

    service = module.get<EventBusService>(EventBusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('emit', () => {
    it('should emit event without data', () => {
      const listener = vi.fn();
      service.on('test-event', listener);
      
      service.emit('test-event');
      
      expect(listener).toHaveBeenCalledWith(undefined);
    });

    it('should emit event with data', () => {
      const listener = vi.fn();
      const testData = { message: 'hello' };
      service.on('test-event', listener);
      
      service.emit('test-event', testData);
      
      expect(listener).toHaveBeenCalledWith(testData);
    });

    it('should not throw if no listeners registered', () => {
      expect(() => service.emit('non-existent-event', {})).not.toThrow();
    });
  });

  describe('publish', () => {
    it('should be alias for emit', () => {
      const listener = vi.fn();
      service.on('test-event', listener);
      
      service.publish('test-event', { data: 'test' });
      
      expect(listener).toHaveBeenCalledWith({ data: 'test' });
    });
  });

  describe('on', () => {
    it('should register listener for event', () => {
      const listener = vi.fn();
      
      service.on('test-event', listener);
      service.emit('test-event', 'data');
      
      expect(listener).toHaveBeenCalledWith('data');
    });

    it('should allow multiple listeners for same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      service.on('test-event', listener1);
      service.on('test-event', listener2);
      service.emit('test-event', 'data');
      
      expect(listener1).toHaveBeenCalledWith('data');
      expect(listener2).toHaveBeenCalledWith('data');
    });
  });

  describe('subscribe', () => {
    it('should be alias for on', () => {
      const listener = vi.fn();
      
      service.subscribe('test-event', listener);
      service.emit('test-event', 'data');
      
      expect(listener).toHaveBeenCalledWith('data');
    });
  });

  describe('off', () => {
    it('should remove registered listener', () => {
      const listener = vi.fn();
      
      service.on('test-event', listener);
      service.off('test-event', listener);
      service.emit('test-event', 'data');
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should not affect other listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      service.on('test-event', listener1);
      service.on('test-event', listener2);
      service.off('test-event', listener1);
      service.emit('test-event', 'data');
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith('data');
    });
  });

  describe('unsubscribe', () => {
    it('should be alias for off', () => {
      const listener = vi.fn();
      
      service.on('test-event', listener);
      service.unsubscribe('test-event', listener);
      service.emit('test-event', 'data');
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('once', () => {
    it('should register one-time listener', () => {
      const listener = vi.fn();
      
      service.once('test-event', listener);
      service.emit('test-event', 'data1');
      service.emit('test-event', 'data2');
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('data1');
    });

    it('should not affect other listeners after being triggered', () => {
      const onceListener = vi.fn();
      const normalListener = vi.fn();
      
      service.once('test-event', onceListener);
      service.on('test-event', normalListener);
      service.emit('test-event', 'data1');
      service.emit('test-event', 'data2');
      
      expect(onceListener).toHaveBeenCalledTimes(1);
      expect(normalListener).toHaveBeenCalledTimes(2);
    });
  });
});
