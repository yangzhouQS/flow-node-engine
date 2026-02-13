import { Injectable, Logger } from '@nestjs/common';

import { BpmnParserService, BpmnParseResult } from './bpmn-parser.service';
import { EventBusService } from './event-bus.service';
import { ExpressionEvaluatorService } from './expression-evaluator.service';
import { ProcessExecutorService, ExecutionContext } from './process-executor.service';

/**
 * 流程引擎服务
 * 这是整个流程引擎的入口点
 * 提供对其他核心服务的访问
 */
@Injectable()
export class ProcessEngineService {
  private readonly logger = new Logger(ProcessEngineService.name);

  constructor(
    private readonly eventBusService: EventBusService,
    private readonly expressionEvaluator: ExpressionEvaluatorService,
    private readonly bpmnParser: BpmnParserService,
    private readonly processExecutor: ProcessExecutorService,
  ) {}

  /**
   * 解析 BPMN XML
   * @param bpmnXml BPMN XML 字符串
   * @returns 解析结果
   */
  async parseBpmn(bpmnXml: string): Promise<BpmnParseResult> {
    return this.bpmnParser.parse(bpmnXml);
  }

  /**
   * 验证 BPMN XML
   * @param bpmnXml BPMN XML 字符串
   * @returns 验证结果
   */
  async validateBpmn(bpmnXml: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    return this.bpmnParser.validate(bpmnXml);
  }

  /**
   * 生成流程图
   * @param bpmnXml BPMN XML 字符串
   * @returns SVG 字符串
   */
  async generateDiagram(bpmnXml: string): Promise<string> {
    return this.bpmnParser.generateDiagram(bpmnXml);
  }

  /**
   * 计算表达式
   * @param expression 表达式字符串
   * @param variables 变量上下文
   * @returns 计算结果
   */
  evaluateExpression(expression: string, variables: Record<string, any> = {}): any {
    return this.expressionEvaluator.evaluate(expression, variables);
  }

  /**
   * 判断条件表达式
   * @param expression 条件表达式
   * @param variables 变量上下文
   * @returns 是否满足条件
   */
  evaluateCondition(expression: string, variables: Record<string, any> = {}): boolean {
    return this.expressionEvaluator.evaluateCondition(expression, variables);
  }

  /**
   * 启动流程实例
   * @param bpmnXml BPMN XML 字符串
   * @param businessKey 业务键
   * @param variables 初始变量
   * @returns 执行上下文
   */
  async startProcess(
    bpmnXml: string,
    businessKey: string,
    variables: Record<string, any> = {},
  ): Promise<ExecutionContext> {
    this.logger.log(`Starting process with business key: ${businessKey}`);

    // 解析 BPMN
    const parseResult = await this.parseBpmn(bpmnXml);
    if (!parseResult.isValid) {
      throw new Error(
        `Invalid BPMN XML: ${parseResult.errors.join(', ')}`,
      );
    }

    // 启动流程实例
    return this.processExecutor.start(
      parseResult.processDefinition,
      businessKey,
      variables,
    );
  }

  /**
   * 继续执行流程实例
   * @param processInstanceId 流程实例 ID
   * @param taskId 任务 ID（如果有）
   * @param variables 更新的变量
   * @returns 执行上下文
   */
  async continueProcess(
    processInstanceId: string,
    taskId?: string,
    variables: Record<string, any> = {},
  ): Promise<ExecutionContext> {
    return this.processExecutor.continue(processInstanceId, taskId, variables);
  }

  /**
   * 挂起流程实例
   * @param processInstanceId 流程实例 ID
   */
  async suspendProcess(processInstanceId: string): Promise<void> {
    return this.processExecutor.suspend(processInstanceId);
  }

  /**
   * 恢复流程实例
   * @param processInstanceId 流程实例 ID
   */
  async resumeProcess(processInstanceId: string): Promise<void> {
    return this.processExecutor.resume(processInstanceId);
  }

  /**
   * 终止流程实例
   * @param processInstanceId 流程实例 ID
   * @param reason 终止原因
   */
  async terminateProcess(
    processInstanceId: string,
    reason?: string,
  ): Promise<void> {
    return this.processExecutor.terminate(processInstanceId, reason);
  }

  /**
   * 获取执行上下文
   * @param processInstanceId 流程实例 ID
   * @returns 执行上下文
   */
  getExecutionContext(processInstanceId: string): ExecutionContext | undefined {
    return this.processExecutor.getExecutionContext(processInstanceId);
  }

  /**
   * 发布事件
   * @param eventType 事件类型
   * @param data 事件数据
   */
  emit(eventType: string, data?: any): void {
    this.eventBusService.emit(eventType, data);
  }

  /**
   * 监听事件
   * @param eventType 事件类型
   * @param listener 事件监听器
   */
  on(eventType: string, listener: (data: any) => void): void {
    this.eventBusService.on(eventType, listener);
  }

  /**
   * 移除事件监听器
   * @param eventType 事件类型
   * @param listener 事件监听器
   */
  off(eventType: string, listener: (data: any) => void): void {
    this.eventBusService.off(eventType, listener);
  }

  /**
   * 获取引擎信息
   * @returns 引擎信息
   */
  getEngineInfo(): {
    name: string;
    version: string;
    services: string[];
  } {
    return {
      name: 'Flow Node Engine',
      version: '1.0.0',
      services: [
        'EventBusService',
        'ExpressionEvaluatorService',
        'BpmnParserService',
        'ProcessExecutorService',
        'GatewayExecutorService',
      ],
    };
  }
}
