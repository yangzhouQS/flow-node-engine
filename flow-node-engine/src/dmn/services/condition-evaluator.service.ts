import { Injectable, Logger } from '@nestjs/common';

import { ConditionEvaluator } from '../interfaces/hit-policy.interface';

/**
 * 条件评估器服务
 * 支持多种操作符进行条件评估
 */
@Injectable()
export class ConditionEvaluatorService implements ConditionEvaluator {
  private readonly logger = new Logger(ConditionEvaluatorService.name);

  /**
   * 评估条件
   * @param inputValue 输入值
   * @param operator 操作符
   * @param conditionValue 条件值
   * @returns 是否满足条件
   */
  evaluate(inputValue: any, operator: string, conditionValue: any): boolean {
    try {
      // 处理空值情况
      if (inputValue === null || inputValue === undefined) {
        return this.evaluateNull(operator, conditionValue);
      }

      // 处理条件值为空的情况
      if (conditionValue === null || conditionValue === undefined) {
        return this.evaluateNullInput(inputValue, operator);
      }

      switch (operator.toLowerCase()) {
        case '==':
        case 'equals':
        case 'equal':
          return this.equals(inputValue, conditionValue);

        case '!=':
        case 'notequals':
        case 'notequal':
          return !this.equals(inputValue, conditionValue);

        case '>':
        case 'greaterthan':
        case 'gt':
          return this.greaterThan(inputValue, conditionValue);

        case '>=':
        case 'greaterthanorequal':
        case 'gte':
          return this.greaterThanOrEqual(inputValue, conditionValue);

        case '<':
        case 'lessthan':
        case 'lt':
          return this.lessThan(inputValue, conditionValue);

        case '<=':
        case 'lessthanorequal':
        case 'lte':
          return this.lessThanOrEqual(inputValue, conditionValue);

        case 'in':
          return this.inArray(inputValue, conditionValue);

        case 'notin':
        case 'not in':
          return !this.inArray(inputValue, conditionValue);

        case 'between':
          return this.between(inputValue, conditionValue);

        case 'contains':
        case 'includes':
          return this.contains(inputValue, conditionValue);

        case 'notcontains':
        case 'excludes':
          return !this.contains(inputValue, conditionValue);

        case 'startswith':
        case 'starts with':
          return this.startsWith(inputValue, conditionValue);

        case 'endswith':
        case 'ends with':
          return this.endsWith(inputValue, conditionValue);

        case 'matches':
        case 'regex':
          return this.matches(inputValue, conditionValue);

        case 'is null':
        case 'isnull':
        case 'null':
          return inputValue === null || inputValue === undefined;

        case 'is not null':
        case 'isnotnull':
        case 'notnull':
          return inputValue !== null && inputValue !== undefined;

        case 'is empty':
        case 'isempty':
        case 'empty':
          return this.isEmpty(inputValue);

        case 'is not empty':
        case 'isnotempty':
        case 'notempty':
          return !this.isEmpty(inputValue);

        default:
          this.logger.warn(`Unknown operator: ${operator}, defaulting to equality check`);
          return this.equals(inputValue, conditionValue);
      }
    } catch (error) {
      this.logger.error(`Error evaluating condition: ${error.message}`);
      return false;
    }
  }

  /**
   * 相等比较
   */
  private equals(inputValue: any, conditionValue: any): boolean {
    // 处理数字比较
    if (typeof inputValue === 'number' || typeof conditionValue === 'number') {
      const numInput = Number(inputValue);
      const numCondition = Number(conditionValue);
      if (!isNaN(numInput) && !isNaN(numCondition)) {
        return numInput === numCondition;
      }
    }

    // 处理布尔值比较
    if (typeof inputValue === 'boolean' || typeof conditionValue === 'boolean') {
      return Boolean(inputValue) === Boolean(conditionValue);
    }

    // 处理字符串比较（忽略大小写）
    if (typeof inputValue === 'string' && typeof conditionValue === 'string') {
      return inputValue.toLowerCase() === conditionValue.toLowerCase();
    }

    // 严格相等比较
    return inputValue === conditionValue;
  }

  /**
   * 大于比较
   */
  private greaterThan(inputValue: any, conditionValue: any): boolean {
    const numInput = Number(inputValue);
    const numCondition = Number(conditionValue);
    if (isNaN(numInput) || isNaN(numCondition)) {
      return String(inputValue) > String(conditionValue);
    }
    return numInput > numCondition;
  }

  /**
   * 大于等于比较
   */
  private greaterThanOrEqual(inputValue: any, conditionValue: any): boolean {
    const numInput = Number(inputValue);
    const numCondition = Number(conditionValue);
    if (isNaN(numInput) || isNaN(numCondition)) {
      return String(inputValue) >= String(conditionValue);
    }
    return numInput >= numCondition;
  }

  /**
   * 小于比较
   */
  private lessThan(inputValue: any, conditionValue: any): boolean {
    const numInput = Number(inputValue);
    const numCondition = Number(conditionValue);
    if (isNaN(numInput) || isNaN(numCondition)) {
      return String(inputValue) < String(conditionValue);
    }
    return numInput < numCondition;
  }

  /**
   * 小于等于比较
   */
  private lessThanOrEqual(inputValue: any, conditionValue: any): boolean {
    const numInput = Number(inputValue);
    const numCondition = Number(conditionValue);
    if (isNaN(numInput) || isNaN(numCondition)) {
      return String(inputValue) <= String(conditionValue);
    }
    return numInput <= numCondition;
  }

  /**
   * 在数组中
   */
  private inArray(inputValue: any, conditionValue: any): boolean {
    if (Array.isArray(conditionValue)) {
      return conditionValue.some((v) => this.equals(inputValue, v));
    }
    // 如果条件值是逗号分隔的字符串
    if (typeof conditionValue === 'string') {
      const values = conditionValue.split(',').map((v) => v.trim());
      return values.some((v) => this.equals(inputValue, v));
    }
    return this.equals(inputValue, conditionValue);
  }

  /**
   * 在范围内
   */
  private between(inputValue: any, conditionValue: any): boolean {
    const numInput = Number(inputValue);
    if (isNaN(numInput)) {
      return false;
    }

    if (Array.isArray(conditionValue) && conditionValue.length >= 2) {
      const min = Number(conditionValue[0]);
      const max = Number(conditionValue[1]);
      return numInput >= min && numInput <= max;
    }

    if (typeof conditionValue === 'object' && conditionValue !== null) {
      const min = Number(conditionValue.min ?? conditionValue.start);
      const max = Number(conditionValue.max ?? conditionValue.end);
      return numInput >= min && numInput <= max;
    }

    return false;
  }

  /**
   * 包含子串
   */
  private contains(inputValue: any, conditionValue: any): boolean {
    const strInput = String(inputValue).toLowerCase();
    const strCondition = String(conditionValue).toLowerCase();
    return strInput.includes(strCondition);
  }

  /**
   * 以指定字符串开头
   */
  private startsWith(inputValue: any, conditionValue: any): boolean {
    const strInput = String(inputValue).toLowerCase();
    const strCondition = String(conditionValue).toLowerCase();
    return strInput.startsWith(strCondition);
  }

  /**
   * 以指定字符串结尾
   */
  private endsWith(inputValue: any, conditionValue: any): boolean {
    const strInput = String(inputValue).toLowerCase();
    const strCondition = String(conditionValue).toLowerCase();
    return strInput.endsWith(strCondition);
  }

  /**
   * 正则匹配
   */
  private matches(inputValue: any, conditionValue: any): boolean {
    try {
      const regex = new RegExp(String(conditionValue));
      return regex.test(String(inputValue));
    } catch {
      return false;
    }
  }

  /**
   * 是否为空
   */
  private isEmpty(inputValue: any): boolean {
    if (inputValue === null || inputValue === undefined) {
      return true;
    }
    if (typeof inputValue === 'string') {
      return inputValue.trim() === '';
    }
    if (Array.isArray(inputValue)) {
      return inputValue.length === 0;
    }
    if (typeof inputValue === 'object') {
      return Object.keys(inputValue).length === 0;
    }
    return false;
  }

  /**
   * 处理输入值为空的情况
   */
  private evaluateNull(operator: string, conditionValue: any): boolean {
    switch (operator.toLowerCase()) {
      case 'is null':
      case 'isnull':
      case 'null':
        return true;
      case 'is not null':
      case 'isnotnull':
      case 'notnull':
        return false;
      case 'is empty':
      case 'isempty':
      case 'empty':
        return true;
      case 'is not empty':
      case 'isnotempty':
      case 'notempty':
        return false;
      default:
        return false;
    }
  }

  /**
   * 处理条件值为空的情况
   */
  private evaluateNullInput(inputValue: any, operator: string): boolean {
    switch (operator.toLowerCase()) {
      case 'is null':
      case 'isnull':
      case 'null':
        return inputValue === null || inputValue === undefined;
      case 'is not null':
      case 'isnotnull':
      case 'notnull':
        return inputValue !== null && inputValue !== undefined;
      case 'is empty':
      case 'isempty':
      case 'empty':
        return this.isEmpty(inputValue);
      case 'is not empty':
      case 'isnotempty':
      case 'notempty':
        return !this.isEmpty(inputValue);
      default:
        return false;
    }
  }
}
