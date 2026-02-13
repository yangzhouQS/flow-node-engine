import { Injectable, Logger } from '@nestjs/common';

import { EventBusService } from './event-bus.service';

/**
 * 表达式求值服务
 * 用于解析和执行流程中的表达式
 */
@Injectable()
export class ExpressionEvaluatorService {
  private readonly logger = new Logger(ExpressionEvaluatorService.name);

  constructor(private readonly eventBusService: EventBusService) {}

  /**
   * 计算表达式
   * @param expression 表达式字符串
   * @param variables 变量上下文
   * @returns 计算结果
   */
  evaluate(expression: string, variables: Record<string, any> = {}): any {
    try {
      // 发布表达式求值开始事件
      this.eventBusService.emit('expression.evaluate.start', {
        expression,
        variables,
      });

      // 简单的表达式求值（实际项目中可以使用更强大的表达式引擎）
      const result = this.evaluateExpression(expression, variables);

      // 发布表达式求值完成事件
      this.eventBusService.emit('expression.evaluate.end', {
        expression,
        variables,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to evaluate expression: ${expression}`,
        error.stack,
      );
      this.eventBusService.emit('expression.evaluate.error', {
        expression,
        variables,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 判断条件表达式
   * @param expression 条件表达式
   * @param variables 变量上下文
   * @returns 是否满足条件
   */
  evaluateCondition(
    expression: string,
    variables: Record<string, any> = {},
  ): boolean {
    const result = this.evaluate(expression, variables);
    return Boolean(result);
  }

  /**
   * 解析表达式中的变量引用
   * @param expression 表达式字符串
   * @returns 变量名列表
   */
  parseVariables(expression: string): string[] {
    // 匹配 ${variableName} 格式的变量引用
    const regex = /\$\{([^}]+)\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(expression)) !== null) {
      variables.push(match[1]);
    }

    return variables;
  }

  /**
   * 表达式求值实现
   * @param expression 表达式字符串
   * @param variables 变量上下文
   * @returns 计算结果
   */
  private evaluateExpression(
    expression: string,
    variables: Record<string, any>,
  ): any {
    // 如果表达式是简单的变量引用，直接返回变量值
    if (expression.startsWith('${') && expression.endsWith('}')) {
      const varName = expression.slice(2, -1);
      return this.getVariableValue(varName, variables);
    }

    // 如果表达式包含变量引用，先替换变量
    let processedExpression = expression;
    const varRegex = /\$\{([^}]+)\}/g;
    processedExpression = processedExpression.replace(varRegex, (_, varName) => {
      const value = this.getVariableValue(varName, variables);
      return JSON.stringify(value);
    });

    // 尝试执行表达式
    try {
      // 注意：在生产环境中，应该使用更安全的表达式引擎
      // 这里仅作为示例，实际项目应使用 vm2、expr-eval 等安全库
      return Function(`"use strict"; return (${processedExpression})`)();
    } catch (error) {
      throw new Error(`Failed to evaluate expression: ${expression}`);
    }
  }

  /**
   * 获取变量值
   * @param varName 变量名（支持点号分隔的路径）
   * @param variables 变量上下文
   * @returns 变量值
   */
  private getVariableValue(varName: string, variables: Record<string, any>): any {
    const parts = varName.split('.');
    let value = variables;

    for (const part of parts) {
      if (value == null) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }
}
