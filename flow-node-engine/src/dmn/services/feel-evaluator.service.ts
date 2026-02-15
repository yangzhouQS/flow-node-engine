import { Injectable, Logger } from '@nestjs/common';
import {
  FeelExpression,
  FeelExpressionType,
  FeelLiteralExpression,
  FeelVariableExpression,
  FeelBinaryExpression,
  FeelUnaryExpression,
  FeelBetweenExpression,
  FeelRangeExpression,
  FeelListExpression,
  FeelInExpression,
  FeelIfExpression,
  FeelFunctionCallExpression,
  FeelEvaluationContext,
  FeelEvaluationResult,
  FeelErrorType,
  FeelPropertyAccessExpression,
  FeelContextExpression,
  FeelFilterExpression,
  FeelForExpression,
  FeelSomeExpression,
  FeelEveryExpression,
  FeelCaseExpression,
  FeelLambdaExpression,
  FeelProjectionExpression,
} from '../interfaces/feel-expression.interface';
import { FeelBuiltinFunctionsService } from './feel-builtin-functions.service';

/**
 * FEEL表达式求值引擎服务
 * 实现DMN 1.3 FEEL表达式求值
 */
@Injectable()
export class FeelEvaluatorService {
  private readonly logger = new Logger(FeelEvaluatorService.name);

  constructor(private readonly builtinFunctions: FeelBuiltinFunctionsService) {}

  /**
   * 求值FEEL表达式
   */
  evaluate(expression: FeelExpression, context: FeelEvaluationContext): FeelEvaluationResult {
    try {
      const value = this.evaluateExpression(expression, context);
      return { success: true, value };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`FEEL求值错误: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        errorType: this.getErrorType(error),
      };
    }
  }

  /**
   * 求值表达式字符串（便捷方法）
   */
  evaluateString(expression: string, variables: Record<string, any> = {}): FeelEvaluationResult {
    try {
      const value = this.evaluateSimpleExpression(expression, variables);
      return { success: true, value };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        errorType: FeelErrorType.RUNTIME_ERROR,
      };
    }
  }

  /**
   * 根据表达式类型分发求值
   */
  private evaluateExpression(expression: FeelExpression, context: FeelEvaluationContext): any {
    switch (expression.type) {
      case FeelExpressionType.NUMBER:
      case FeelExpressionType.STRING:
      case FeelExpressionType.BOOLEAN:
      case FeelExpressionType.NULL:
      case FeelExpressionType.LITERAL:
        return this.evaluateLiteral(expression as FeelLiteralExpression);

      case FeelExpressionType.VARIABLE:
        return this.evaluateVariable(expression as FeelVariableExpression, context);

      case FeelExpressionType.PROPERTY_ACCESS:
        return this.evaluatePropertyAccess(expression as FeelPropertyAccessExpression, context);

      case FeelExpressionType.ADDITION:
      case FeelExpressionType.SUBTRACTION:
      case FeelExpressionType.MULTIPLICATION:
      case FeelExpressionType.DIVISION:
      case FeelExpressionType.EXPONENTIATION:
      case FeelExpressionType.EQUAL:
      case FeelExpressionType.NOT_EQUAL:
      case FeelExpressionType.LESS_THAN:
      case FeelExpressionType.LESS_THAN_OR_EQUAL:
      case FeelExpressionType.GREATER_THAN:
      case FeelExpressionType.GREATER_THAN_OR_EQUAL:
      case FeelExpressionType.AND:
      case FeelExpressionType.OR:
        return this.evaluateBinary(expression as FeelBinaryExpression, context);

      case FeelExpressionType.NEGATION:
      case FeelExpressionType.NOT:
        return this.evaluateUnary(expression as FeelUnaryExpression, context);

      case FeelExpressionType.BETWEEN:
        return this.evaluateBetween(expression as FeelBetweenExpression, context);

      case FeelExpressionType.RANGE:
      case FeelExpressionType.OPEN_RANGE:
        return this.evaluateRange(expression as FeelRangeExpression, context);

      case FeelExpressionType.LIST:
        return this.evaluateList(expression as FeelListExpression, context);

      case FeelExpressionType.IN:
      case FeelExpressionType.NOT_IN:
        return this.evaluateIn(expression as FeelInExpression, context);

      case FeelExpressionType.IF:
        return this.evaluateIf(expression as FeelIfExpression, context);

      case FeelExpressionType.CASE:
        return this.evaluateCase(expression as FeelCaseExpression, context);

      case FeelExpressionType.FUNCTION_CALL:
        return this.evaluateFunctionCall(expression as FeelFunctionCallExpression, context);

      case FeelExpressionType.LAMBDA:
        return this.evaluateLambda(expression as FeelLambdaExpression, context);

      case FeelExpressionType.FOR:
        return this.evaluateFor(expression as FeelForExpression, context);

      case FeelExpressionType.SOME:
        return this.evaluateSome(expression as FeelSomeExpression, context);

      case FeelExpressionType.EVERY:
        return this.evaluateEvery(expression as FeelEveryExpression, context);

      case FeelExpressionType.FILTER:
        return this.evaluateFilter(expression as FeelFilterExpression, context);

      case FeelExpressionType.PROJECTION:
        return this.evaluateProjection(expression as FeelProjectionExpression, context);

      case FeelExpressionType.CONTEXT:
        return this.evaluateContext(expression as FeelContextExpression, context);

      default:
        throw new Error(`不支持的表达式类型: ${expression.type}`);
    }
  }

  /**
   * 求值字面量
   */
  private evaluateLiteral(expression: FeelLiteralExpression): any {
    return expression.value;
  }

  /**
   * 求值变量引用
   */
  private evaluateVariable(expression: FeelVariableExpression, context: FeelEvaluationContext): any {
    const name = expression.name;
    if (!(name in context.variables)) {
      throw new Error(`变量未找到: ${name}`);
    }
    return context.variables[name];
  }

  /**
   * 求值属性访问
   */
  private evaluatePropertyAccess(
    expression: FeelPropertyAccessExpression,
    context: FeelEvaluationContext
  ): any {
    const obj = this.evaluateExpression(expression.object, context);
    if (obj === null || obj === undefined) {
      throw new Error('无法访问null或undefined的属性');
    }
    return obj[expression.property];
  }

  /**
   * 求值二元运算
   */
  private evaluateBinary(expression: FeelBinaryExpression, context: FeelEvaluationContext): any {
    const left = this.evaluateExpression(expression.left, context);
    const right = this.evaluateExpression(expression.right, context);

    switch (expression.type) {
      case FeelExpressionType.ADDITION:
        return this.add(left, right);

      case FeelExpressionType.SUBTRACTION:
        return this.subtract(left, right);

      case FeelExpressionType.MULTIPLICATION:
        return this.multiply(left, right);

      case FeelExpressionType.DIVISION:
        return this.divide(left, right);

      case FeelExpressionType.EXPONENTIATION:
        return this.power(left, right);

      case FeelExpressionType.EQUAL:
        return this.equals(left, right);

      case FeelExpressionType.NOT_EQUAL:
        return !this.equals(left, right);

      case FeelExpressionType.LESS_THAN:
        return this.compare(left, right) < 0;

      case FeelExpressionType.LESS_THAN_OR_EQUAL:
        return this.compare(left, right) <= 0;

      case FeelExpressionType.GREATER_THAN:
        return this.compare(left, right) > 0;

      case FeelExpressionType.GREATER_THAN_OR_EQUAL:
        return this.compare(left, right) >= 0;

      case FeelExpressionType.AND:
        return this.toBoolean(left) && this.toBoolean(right);

      case FeelExpressionType.OR:
        return this.toBoolean(left) || this.toBoolean(right);

      default:
        throw new Error(`未知的二元运算: ${expression.type}`);
    }
  }

  /**
   * 求值一元运算
   */
  private evaluateUnary(expression: FeelUnaryExpression, context: FeelEvaluationContext): any {
    const operand = this.evaluateExpression(expression.operand, context);

    switch (expression.type) {
      case FeelExpressionType.NEGATION:
        if (typeof operand !== 'number') {
          throw new Error('负号运算符只能用于数字');
        }
        return -operand;

      case FeelExpressionType.NOT:
        return !this.toBoolean(operand);

      default:
        throw new Error(`未知的一元运算: ${expression.type}`);
    }
  }

  /**
   * 求值between表达式
   */
  private evaluateBetween(expression: FeelBetweenExpression, context: FeelEvaluationContext): boolean {
    const value = this.evaluateExpression(expression.value, context);
    const low = this.evaluateExpression(expression.low, context);
    const high = this.evaluateExpression(expression.high, context);

    return this.compare(value, low) >= 0 && this.compare(value, high) <= 0;
  }

  /**
   * 求值范围表达式
   */
  private evaluateRange(expression: FeelRangeExpression, context: FeelEvaluationContext): any {
    const start = this.evaluateExpression(expression.start, context);
    const end = this.evaluateExpression(expression.end, context);

    return {
      start,
      end,
      startInclusive: expression.startInclusive,
      endInclusive: expression.endInclusive,
    };
  }

  /**
   * 求值列表表达式
   */
  private evaluateList(expression: FeelListExpression, context: FeelEvaluationContext): any[] {
    return expression.elements.map((element) => this.evaluateExpression(element, context));
  }

  /**
   * 求值in表达式
   */
  private evaluateIn(expression: FeelInExpression, context: FeelEvaluationContext): boolean {
    const value = this.evaluateExpression(expression.value, context);
    const list = this.evaluateExpression(expression.list, context);

    if (!Array.isArray(list)) {
      throw new Error('in运算符的右侧必须是列表');
    }

    const isIn = list.some((item) => this.equals(value, item));
    return expression.type === FeelExpressionType.IN ? isIn : !isIn;
  }

  /**
   * 求值if表达式
   */
  private evaluateIf(expression: FeelIfExpression, context: FeelEvaluationContext): any {
    const condition = this.evaluateExpression(expression.condition, context);

    if (this.toBoolean(condition)) {
      return this.evaluateExpression(expression.thenExpression, context);
    } else {
      return this.evaluateExpression(expression.elseExpression, context);
    }
  }

  /**
   * 求值case表达式
   */
  private evaluateCase(expression: FeelCaseExpression, context: FeelEvaluationContext): any {
    for (const caseItem of expression.cases) {
      const condition = this.evaluateExpression(caseItem.condition, context);
      if (this.toBoolean(condition)) {
        return this.evaluateExpression(caseItem.result, context);
      }
    }

    if (expression.defaultResult) {
      return this.evaluateExpression(expression.defaultResult, context);
    }

    return null;
  }

  /**
   * 求值函数调用
   */
  private evaluateFunctionCall(
    expression: FeelFunctionCallExpression,
    context: FeelEvaluationContext
  ): any {
    const functionName = expression.functionName;
    const args = expression.parameters.map((param) => this.evaluateExpression(param, context));

    // 首先检查上下文中的函数
    if (context.functions && functionName in context.functions) {
      const func = context.functions[functionName];
      return func.implementation(...args);
    }

    // 然后检查内置函数
    const builtinFunc = this.builtinFunctions.getFunction(functionName);
    if (builtinFunc) {
      return builtinFunc.implementation(...args);
    }

    throw new Error(`函数未找到: ${functionName}`);
  }

  /**
   * 求值lambda表达式
   */
  private evaluateLambda(expression: FeelLambdaExpression, context: FeelEvaluationContext): (...args: any[]) => any {
    return (...args: any[]) => {
      const newVariables = { ...context.variables };
      expression.parameters.forEach((param, index) => {
        newVariables[param] = args[index];
      });

      const newContext: FeelEvaluationContext = {
        ...context,
        variables: newVariables,
      };

      return this.evaluateExpression(expression.body, newContext);
    };
  }

  /**
   * 求值for表达式
   */
  private evaluateFor(expression: FeelForExpression, context: FeelEvaluationContext): any[] {
    const iterable = this.evaluateExpression(expression.iterable, context);

    if (!Array.isArray(iterable)) {
      throw new Error('for表达式的迭代目标必须是列表');
    }

    return iterable.map((item) => {
      const newVariables = { ...context.variables, [expression.iterator]: item };
      const newContext: FeelEvaluationContext = { ...context, variables: newVariables };
      return this.evaluateExpression(expression.body, newContext);
    });
  }

  /**
   * 求值some表达式
   */
  private evaluateSome(expression: FeelSomeExpression, context: FeelEvaluationContext): boolean {
    const iterable = this.evaluateExpression(expression.iterable, context);

    if (!Array.isArray(iterable)) {
      throw new Error('some表达式的迭代目标必须是列表');
    }

    return iterable.some((item) => {
      const newVariables = { ...context.variables, [expression.iterator]: item };
      const newContext: FeelEvaluationContext = { ...context, variables: newVariables };
      const result = this.evaluateExpression(expression.condition, newContext);
      return this.toBoolean(result);
    });
  }

  /**
   * 求值every表达式
   */
  private evaluateEvery(expression: FeelEveryExpression, context: FeelEvaluationContext): boolean {
    const iterable = this.evaluateExpression(expression.iterable, context);

    if (!Array.isArray(iterable)) {
      throw new Error('every表达式的迭代目标必须是列表');
    }

    return iterable.every((item) => {
      const newVariables = { ...context.variables, [expression.iterator]: item };
      const newContext: FeelEvaluationContext = { ...context, variables: newVariables };
      const result = this.evaluateExpression(expression.condition, newContext);
      return this.toBoolean(result);
    });
  }

  /**
   * 求值过滤表达式
   */
  private evaluateFilter(expression: FeelFilterExpression, context: FeelEvaluationContext): any {
    const list = this.evaluateExpression(expression.list, context);

    if (!Array.isArray(list)) {
      throw new Error('过滤表达式的目标必须是列表');
    }

    // 如果过滤条件是数字，表示索引访问
    if (expression.filter.type === FeelExpressionType.NUMBER) {
      const index = (expression.filter as FeelLiteralExpression).value as number;
      // FEEL索引从1开始
      return list[index - 1];
    }

    // 否则是条件过滤
    return list.filter((item) => {
      const newVariables = { ...context.variables, item };
      const newContext: FeelEvaluationContext = { ...context, variables: newVariables };
      const result = this.evaluateExpression(expression.filter, newContext);
      return this.toBoolean(result);
    });
  }

  /**
   * 求值投影表达式
   */
  private evaluateProjection(
    expression: FeelProjectionExpression,
    context: FeelEvaluationContext
  ): any[] {
    const ctx = this.evaluateExpression(expression.context, context);

    if (!Array.isArray(ctx)) {
      throw new Error('投影表达式的目标必须是列表');
    }

    return ctx.map((item) => {
      const result: Record<string, any> = {};
      for (const prop of expression.properties) {
        result[prop] = item[prop];
      }
      return result;
    });
  }

  /**
   * 求值上下文表达式
   */
  private evaluateContext(expression: FeelContextExpression, context: FeelEvaluationContext): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(expression.entries)) {
      result[key] = this.evaluateExpression(value, context);
    }

    return result;
  }

  // ==================== 辅助方法 ====================

  /**
   * 加法运算
   */
  private add(left: any, right: any): any {
    if (typeof left === 'string' || typeof right === 'string') {
      return String(left) + String(right);
    }
    if (typeof left === 'number' && typeof right === 'number') {
      return left + right;
    }
    throw new Error('加法运算符只能用于数字或字符串');
  }

  /**
   * 减法运算
   */
  private subtract(left: any, right: any): number {
    if (typeof left !== 'number' || typeof right !== 'number') {
      throw new Error('减法运算符只能用于数字');
    }
    return left - right;
  }

  /**
   * 乘法运算
   */
  private multiply(left: any, right: any): number {
    if (typeof left !== 'number' || typeof right !== 'number') {
      throw new Error('乘法运算符只能用于数字');
    }
    return left * right;
  }

  /**
   * 除法运算
   */
  private divide(left: any, right: any): number {
    if (typeof left !== 'number' || typeof right !== 'number') {
      throw new Error('除法运算符只能用于数字');
    }
    if (right === 0) {
      throw new Error('除数不能为零');
    }
    return left / right;
  }

  /**
   * 幂运算
   */
  private power(left: any, right: any): number {
    if (typeof left !== 'number' || typeof right !== 'number') {
      throw new Error('幂运算符只能用于数字');
    }
    return Math.pow(left, right);
  }

  /**
   * 相等比较
   */
  private equals(left: any, right: any): boolean {
    if (left === null && right === null) return true;
    if (left === null || right === null) return false;
    if (typeof left !== typeof right) return false;
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) return false;
      return left.every((item, index) => this.equals(item, right[index]));
    }
    return left === right;
  }

  /**
   * 比较运算
   */
  private compare(left: any, right: any): number {
    if (typeof left !== typeof right) {
      throw new Error('比较运算符要求相同类型');
    }
    if (typeof left === 'number' || typeof left === 'string') {
      if (left < right) return -1;
      if (left > right) return 1;
      return 0;
    }
    throw new Error('比较运算符只能用于数字或字符串');
  }

  /**
   * 转换为布尔值
   */
  private toBoolean(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  /**
   * 获取错误类型
   */
  private getErrorType(error: any): FeelErrorType {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('变量未找到')) {
      return FeelErrorType.VARIABLE_NOT_FOUND;
    }
    if (message.includes('函数未找到')) {
      return FeelErrorType.FUNCTION_NOT_FOUND;
    }
    if (message.includes('除数不能为零')) {
      return FeelErrorType.DIVISION_BY_ZERO;
    }
    if (message.includes('类型') || message.includes('只能用于')) {
      return FeelErrorType.TYPE_ERROR;
    }
    if (message.includes('参数')) {
      return FeelErrorType.INVALID_ARGUMENTS;
    }

    return FeelErrorType.RUNTIME_ERROR;
  }

  /**
   * 简单表达式求值（用于条件表达式）
   */
  private evaluateSimpleExpression(expression: string, variables: Record<string, any>): any {
    expression = expression.trim();

    // 处理字符串字面量
    if ((expression.startsWith('"') && expression.endsWith('"')) ||
        (expression.startsWith("'") && expression.endsWith("'"))) {
      return expression.slice(1, -1);
    }

    // 处理数字字面量
    if (!isNaN(Number(expression))) {
      return Number(expression);
    }

    // 处理布尔字面量
    if (expression.toLowerCase() === 'true') return true;
    if (expression.toLowerCase() === 'false') return false;
    if (expression.toLowerCase() === 'null') return null;

    // 处理比较运算符
    const comparisonOperators = ['<=', '>=', '!=', '<', '>', '='];
    for (const op of comparisonOperators) {
      const parts = this.splitExpression(expression, op);
      if (parts) {
        const left = this.evaluateSimpleExpression(parts[0], variables);
        const right = this.evaluateSimpleExpression(parts[1], variables);
        switch (op) {
          case '=': return this.equals(left, right);
          case '!=': return !this.equals(left, right);
          case '<': return this.compare(left, right) < 0;
          case '<=': return this.compare(left, right) <= 0;
          case '>': return this.compare(left, right) > 0;
          case '>=': return this.compare(left, right) >= 0;
        }
      }
    }

    // 处理逻辑运算符
    const andParts = this.splitExpression(expression, ' and ');
    if (andParts) {
      return this.toBoolean(this.evaluateSimpleExpression(andParts[0], variables)) &&
             this.toBoolean(this.evaluateSimpleExpression(andParts[1], variables));
    }

    const orParts = this.splitExpression(expression, ' or ');
    if (orParts) {
      return this.toBoolean(this.evaluateSimpleExpression(orParts[0], variables)) ||
             this.toBoolean(this.evaluateSimpleExpression(orParts[1], variables));
    }

    // 处理between表达式
    const betweenMatch = expression.match(/^(.+?)\s+between\s+(.+?)\s+and\s+(.+)$/i);
    if (betweenMatch) {
      const value = this.evaluateSimpleExpression(betweenMatch[1], variables);
      const low = this.evaluateSimpleExpression(betweenMatch[2], variables);
      const high = this.evaluateSimpleExpression(betweenMatch[3], variables);
      return this.compare(value, low) >= 0 && this.compare(value, high) <= 0;
    }

    // 处理in表达式
    const inMatch = expression.match(/^(.+?)\s+in\s+\[(.+)\]$/i);
    if (inMatch) {
      const value = this.evaluateSimpleExpression(inMatch[1], variables);
      const listStr = inMatch[2];
      const items = listStr.split(',').map((s) => this.evaluateSimpleExpression(s.trim(), variables));
      return items.some((item) => this.equals(value, item));
    }

    // 处理算术运算符
    const arithmeticOperators = ['+', '-', '*', '/'];
    for (const op of arithmeticOperators) {
      const parts = this.splitExpression(expression, op);
      if (parts) {
        const left = this.evaluateSimpleExpression(parts[0], variables);
        const right = this.evaluateSimpleExpression(parts[1], variables);
        switch (op) {
          case '+': return this.add(left, right);
          case '-': return this.subtract(left, right);
          case '*': return this.multiply(left, right);
          case '/': return this.divide(left, right);
        }
      }
    }

    // 处理变量引用
    if (expression in variables) {
      return variables[expression];
    }

    // 处理属性访问（点号表示法）
    if (expression.includes('.')) {
      const parts = expression.split('.');
      let value = variables;
      for (const part of parts) {
        if (value === null || value === undefined) {
          throw new Error(`无法访问null或undefined的属性: ${part}`);
        }
        value = value[part];
      }
      return value;
    }

    throw new Error(`无法解析表达式: ${expression}`);
  }

  /**
   * 分割表达式（考虑优先级和括号）
   */
  private splitExpression(expression: string, operator: string): [string, string] | null {
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < expression.length; i++) {
      const char = expression[i];

      if ((char === '"' || char === "'") && !inString) {
        inString = true;
        stringChar = char;
        continue;
      }

      if (inString) {
        if (char === stringChar) {
          inString = false;
        }
        continue;
      }

      if (char === '(' || char === '[' || char === '{') {
        depth++;
        continue;
      }

      if (char === ')' || char === ']' || char === '}') {
        depth--;
        continue;
      }

      if (depth === 0) {
        const remaining = expression.substring(i);
        if (remaining.startsWith(operator)) {
          const left = expression.substring(0, i).trim();
          const right = expression.substring(i + operator.length).trim();
          if (left && right) {
            return [left, right];
          }
        }
      }
    }

    return null;
  }
}
