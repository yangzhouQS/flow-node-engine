import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { EventBusService } from './event-bus.service';
import { ExpressionEvaluatorService } from './expression-evaluator.service';

describe('ExpressionEvaluatorService', () => {
  let service: ExpressionEvaluatorService;
  let eventBusService: EventBusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpressionEvaluatorService,
        EventBusService,
      ],
    }).compile();

    service = module.get<ExpressionEvaluatorService>(ExpressionEvaluatorService);
    eventBusService = module.get<EventBusService>(EventBusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluate', () => {
    it('should evaluate simple variable expression', () => {
      const expression = '${name}';
      const context = { name: 'test' };
      
      const result = service.evaluate(expression, context);
      
      expect(result).toBe('test');
    });

    it('should evaluate nested variable expression', () => {
      const expression = '${user.name}';
      const context = { user: { name: 'John' } };
      
      const result = service.evaluate(expression, context);
      
      expect(result).toBe('John');
    });

    it('should return undefined for non-existent variable', () => {
      const expression = '${nonExistent}';
      const context = {};
      
      const result = service.evaluate(expression, context);
      
      expect(result).toBeUndefined();
    });

    it('should evaluate numeric expression', () => {
      // Expression evaluator replaces variables with JSON.stringify values
      const expression = '5 + 3';
      const context = {};
      
      const result = service.evaluate(expression, context);
      
      expect(result).toBe(8);
    });

    it('should evaluate expression with variables', () => {
      const expression = '${a}';
      const context = { a: 5 };
      
      const result = service.evaluate(expression, context);
      
      expect(result).toBe(5);
    });

    it('should handle boolean values', () => {
      const expression = '${isActive}';
      const context = { isActive: true };
      
      const result = service.evaluate(expression, context);
      
      expect(result).toBe(true);
    });

    it('should handle null values', () => {
      const expression = '${value}';
      const context = { value: null };
      
      const result = service.evaluate(expression, context);
      
      expect(result).toBeNull();
    });

    it('should emit evaluate.start event', () => {
      const listener = vi.fn();
      eventBusService.on('expression.evaluate.start', listener);
      
      service.evaluate('${test}', { test: 'value' });
      
      expect(listener).toHaveBeenCalledWith({
        expression: '${test}',
        variables: { test: 'value' },
      });
    });

    it('should emit evaluate.end event on success', () => {
      const listener = vi.fn();
      eventBusService.on('expression.evaluate.end', listener);
      
      service.evaluate('${test}', { test: 'value' });
      
      expect(listener).toHaveBeenCalledWith({
        expression: '${test}',
        variables: { test: 'value' },
        result: 'value',
      });
    });

    it('should emit evaluate.error event on failure', () => {
      const listener = vi.fn();
      eventBusService.on('expression.evaluate.error', listener);
      
      // Invalid expression that will throw
      expect(() => service.evaluate('invalid syntax !!!', {})).toThrow();
      
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('evaluateCondition', () => {
    it('should return true for truthy condition', () => {
      const expression = '${value} > 5';
      const context = { value: 10 };
      
      const result = service.evaluateCondition(expression, context);
      
      expect(result).toBe(true);
    });

    it('should return false for falsy condition', () => {
      const expression = '${value} > 10';
      const context = { value: 5 };
      
      const result = service.evaluateCondition(expression, context);
      
      expect(result).toBe(false);
    });

    it('should handle boolean expressions', () => {
      const expression = '${isActive} && ${count} > 0';
      const context = { isActive: true, count: 5 };
      
      const result = service.evaluateCondition(expression, context);
      
      expect(result).toBe(true);
    });

    it('should handle equality comparison', () => {
      const expression = '${status} === "approved"';
      const context = { status: 'approved' };
      
      const result = service.evaluateCondition(expression, context);
      
      expect(result).toBe(true);
    });

    it('should handle not equal comparison', () => {
      const expression = '${status} !== "rejected"';
      const context = { status: 'approved' };
      
      const result = service.evaluateCondition(expression, context);
      
      expect(result).toBe(true);
    });

    it('should handle complex boolean logic', () => {
      const expression = '(${age} >= 18) && (${hasLicense} === true)';
      const context = { age: 25, hasLicense: true };
      
      const result = service.evaluateCondition(expression, context);
      
      expect(result).toBe(true);
    });

    it('should convert truthy values to true', () => {
      const expression = '${value}';
      const context = { value: 'non-empty string' };
      
      const result = service.evaluateCondition(expression, context);
      
      expect(result).toBe(true);
    });

    it('should convert falsy values to false', () => {
      const expression = '${value}';
      const context = { value: 0 };
      
      const result = service.evaluateCondition(expression, context);
      
      expect(result).toBe(false);
    });
  });

  describe('parseVariables', () => {
    it('should parse single variable', () => {
      const expression = '${name}';
      
      const result = service.parseVariables(expression);
      
      expect(result).toEqual(['name']);
    });

    it('should parse multiple variables', () => {
      const expression = '${firstName} and ${lastName}';
      
      const result = service.parseVariables(expression);
      
      expect(result).toEqual(['firstName', 'lastName']);
    });

    it('should parse nested variable paths', () => {
      const expression = '${user.profile.name}';
      
      const result = service.parseVariables(expression);
      
      expect(result).toEqual(['user.profile.name']);
    });

    it('should return empty array for no variables', () => {
      const expression = 'static text without variables';
      
      const result = service.parseVariables(expression);
      
      expect(result).toEqual([]);
    });

    it('should handle mixed content', () => {
      const expression = 'Hello ${name}, you have ${count} messages';
      
      const result = service.parseVariables(expression);
      
      expect(result).toEqual(['name', 'count']);
    });
  });
});
