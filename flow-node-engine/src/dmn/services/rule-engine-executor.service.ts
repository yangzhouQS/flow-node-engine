import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { ExecuteDecisionDto, DecisionResultDto } from '../dto/dmn.dto';
import { DmnDecisionEntity, HitPolicy, AggregationType, DmnDecisionStatus } from '../entities/dmn-decision.entity';
import { DmnExecutionEntity, DmnExecutionStatus } from '../entities/dmn-execution.entity';
import {
  RuleEvaluationResult,
  DecisionTableDefinition,
  RuleDefinition,
  DecisionExecutionAuditContainer,
  RuleExecutionAudit,
  InputEntryAudit,
  OutputEntryAudit,
  RuleExecutionContext,
  HitPolicyHandler,
  ContinueEvaluatingBehavior,
  EvaluateRuleValidityBehavior,
  ComposeDecisionResultBehavior,
} from '../interfaces/hit-policy.interface';

import { ConditionEvaluatorService } from './condition-evaluator.service';
import { HitPolicyHandlerFactory } from './hit-policy-handlers.service';

/**
 * 执行决策的配置选项
 * 与Flowable的DecisionExecutionAuditContainer保持一致
 */
export interface ExecuteDecisionOptions {
  /** 是否启用严格模式（默认true）- 违反HitPolicy时抛出异常 */
  strictMode?: boolean;
  /** 是否强制使用DMN 1.1模式（影响COLLECT去重行为） */
  forceDMN11?: boolean;
  /** 是否启用审计跟踪 */
  enableAudit?: boolean;
  /** 租户ID */
  tenantId?: string;
  /** 流程实例ID */
  processInstanceId?: string;
  /** 执行ID */
  executionId?: string;
  /** 活动ID */
  activityId?: string;
  /** 任务ID */
  taskId?: string;
}

/**
 * 规则引擎执行器服务
 * 负责执行决策表并返回结果
 * 
 * 与Flowable DMN引擎保持一致的行为：
 * - 支持strictMode配置
 * - 支持forceDMN11配置
 * - 支持完整的审计跟踪
 * - 支持行为接口（ContinueEvaluating, EvaluateRuleValidity, ComposeDecisionResult）
 */
@Injectable()
export class RuleEngineExecutorService {
  private readonly logger = new Logger(RuleEngineExecutorService.name);

  /** 默认严格模式 */
  private readonly defaultStrictMode = true;
  /** 默认DMN版本 */
  private readonly defaultForceDMN11 = false;

  constructor(
    @InjectRepository(DmnDecisionEntity)
    private readonly decisionRepository: Repository<DmnDecisionEntity>,
    @InjectRepository(DmnExecutionEntity)
    private readonly executionRepository: Repository<DmnExecutionEntity>,
    private readonly hitPolicyHandlerFactory: HitPolicyHandlerFactory,
    private readonly conditionEvaluator: ConditionEvaluatorService,
  ) {}

  /**
   * 执行决策
   * @param dto 执行决策DTO
   * @param options 执行选项
   * @returns 决策结果
   */
  async execute(dto: ExecuteDecisionDto, options?: ExecuteDecisionOptions): Promise<DecisionResultDto> {
    const startTime = Date.now();
    const executionId = uuidv4();
    const strictMode = options?.strictMode ?? this.defaultStrictMode;
    const forceDMN11 = options?.forceDMN11 ?? this.defaultForceDMN11;
    const enableAudit = options?.enableAudit ?? true;

    // 获取决策定义
    let decision: DmnDecisionEntity;
    if (dto.decisionId) {
      decision = await this.decisionRepository.findOne({
        where: { id: dto.decisionId },
      });
    } else if (dto.decisionKey) {
      const queryBuilder = this.decisionRepository.createQueryBuilder('decision');
      queryBuilder
        .where('decision.decisionKey = :key', { key: dto.decisionKey })
        .andWhere('decision.status = :status', { status: DmnDecisionStatus.PUBLISHED });

      if (dto.version) {
        queryBuilder.andWhere('decision.version = :version', { version: dto.version });
      } else {
        queryBuilder.orderBy('decision.version', 'DESC').limit(1);
      }

      decision = await queryBuilder.getOne();
    } else {
      throw new BadRequestException('Either decisionId or decisionKey must be provided');
    }

    if (!decision) {
      throw new BadRequestException('Decision not found');
    }

    if (decision.status !== DmnDecisionStatus.PUBLISHED) {
      throw new BadRequestException(`Decision is not published. Current status: ${decision.status}`);
    }

    // 初始化审计容器
    const auditContainer: DecisionExecutionAuditContainer = {
      decisionId: decision.id,
      decisionKey: decision.decisionKey,
      decisionName: decision.name,
      decisionVersion: decision.version,
      hitPolicy: decision.hitPolicy,
      strictMode,
      forceDMN11,
      ruleExecutions: [],
      startTime: new Date(),
      failed: false,
    };

    try {
      // 解析决策表定义
      const decisionTable = this.parseDecisionTable(decision);

      // 获取Hit Policy处理器
      const handler = this.hitPolicyHandlerFactory.getHandler(decision.hitPolicy as HitPolicy);

      // 创建规则执行上下文
      const ruleContext: RuleExecutionContext = {
        decisionTable,
        inputData: dto.inputData,
        auditContainer,
        strictMode,
        forceDMN11,
        handler,
        ruleResults: new Map(),
        stackVariables: new Map(),
      };

      // 评估规则（使用行为接口）
      const evaluationResults = this.evaluateRulesWithContext(ruleContext);

      // 处理结果
      const hitPolicyResult = handler.handle(evaluationResults);

      // 检查规则有效性（如果处理器支持）
      if (this.hasEvaluateRuleValidityBehavior(handler)) {
        this.validateRuleValidity(handler, evaluationResults, strictMode);
      }

      // 组合决策结果（如果处理器支持）
      let finalOutput = hitPolicyResult.output;
      if (this.hasComposeDecisionResultBehavior(handler)) {
        finalOutput = handler.composeDecisionResults(ruleContext);
      } else if (hitPolicyResult.needsAggregation && decision.aggregation !== AggregationType.NONE) {
        finalOutput = this.applyAggregation(
          hitPolicyResult.output as Record<string, any>[],
          decision.aggregation,
          decisionTable.outputs,
        );
      }

      const executionTimeMs = Date.now() - startTime;

      // 保存执行历史
      await this.saveExecutionHistory({
        id: executionId,
        decisionId: decision.id,
        decisionKey: decision.decisionKey,
        decisionVersion: decision.version,
        status: hitPolicyResult.hasMatch ? DmnExecutionStatus.SUCCESS : DmnExecutionStatus.NO_MATCH,
        inputData: dto.inputData,
        outputResult: finalOutput,
        matchedRules: hitPolicyResult.matchedRuleIds,
        matchedCount: hitPolicyResult.matchedRuleIds.length,
        executionTimeMs,
        processInstanceId: dto.processInstanceId ?? options?.processInstanceId,
        executionId: dto.executionId ?? options?.executionId,
        activityId: dto.activityId ?? options?.activityId,
        taskId: dto.taskId ?? options?.taskId,
        tenantId: dto.tenantId ?? options?.tenantId,
        auditContainer: enableAudit ? auditContainer : undefined,
      });

      return {
        executionId,
        decisionId: decision.id,
        decisionKey: decision.decisionKey,
        decisionVersion: decision.version,
        status: hitPolicyResult.hasMatch ? 'success' : 'no_match',
        outputResult: finalOutput,
        matchedRules: hitPolicyResult.matchedRuleIds,
        matchedCount: hitPolicyResult.matchedRuleIds.length,
        executionTimeMs,
        audit: enableAudit ? auditContainer : undefined,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      this.logger.error(`Decision execution failed: ${error.message}`, error.stack);

      // 保存失败执行历史
      await this.saveExecutionHistory({
        id: executionId,
        decisionId: decision.id,
        decisionKey: decision.decisionKey,
        decisionVersion: decision.version,
        status: DmnExecutionStatus.FAILED,
        inputData: dto.inputData,
        executionTimeMs,
        processInstanceId: dto.processInstanceId ?? options?.processInstanceId,
        executionId: dto.executionId ?? options?.executionId,
        activityId: dto.activityId ?? options?.activityId,
        taskId: dto.taskId ?? options?.taskId,
        tenantId: dto.tenantId ?? options?.tenantId,
        errorMessage: error.message,
        errorDetails: error.stack,
        auditContainer: enableAudit ? auditContainer : undefined,
      });

      throw error;
    }
  }

  /**
   * 检查处理器是否支持ContinueEvaluating行为
   */
  private hasContinueEvaluatingBehavior(handler: HitPolicyHandler): handler is HitPolicyHandler & ContinueEvaluatingBehavior {
    return typeof (handler as ContinueEvaluatingBehavior).shouldContinueEvaluating === 'function';
  }

  /**
   * 检查处理器是否支持EvaluateRuleValidity行为
   */
  private hasEvaluateRuleValidityBehavior(handler: HitPolicyHandler): handler is HitPolicyHandler & EvaluateRuleValidityBehavior {
    return typeof (handler as EvaluateRuleValidityBehavior).evaluateRuleValidity === 'function';
  }

  /**
   * 检查处理器是否支持ComposeDecisionResult行为
   */
  private hasComposeDecisionResultBehavior(handler: HitPolicyHandler): handler is HitPolicyHandler & ComposeDecisionResultBehavior {
    return typeof (handler as ComposeDecisionResultBehavior).composeDecisionResults === 'function';
  }

  /**
   * 验证规则有效性（用于UNIQUE等策略）
   */
  private validateRuleValidity(
    handler: HitPolicyHandler & EvaluateRuleValidityBehavior,
    results: RuleEvaluationResult[],
    strictMode: boolean,
  ): void {
    const matchedResults = results.filter(r => r.matched);
    const validityResult = handler.evaluateRuleValidity(matchedResults, strictMode);

    if (!validityResult.valid) {
      const message = validityResult.errorMessage || 'Rule validity check failed';
      if (strictMode) {
        throw new BadRequestException(message);
      } else {
        this.logger.warn(message);
      }
    }
  }

  /**
   * 使用上下文评估所有规则
   * 支持ContinueEvaluating行为接口
   */
  private evaluateRulesWithContext(context: RuleExecutionContext): RuleEvaluationResult[] {
    const results: RuleEvaluationResult[] = [];
    const decisionTable = context.decisionTable;
    const inputData = context.inputData;
    const auditContainer = context.auditContainer;
    const handler = context.handler;
    
    if (!decisionTable) {
      return results;
    }
    
    const hasContinueBehavior = handler ? this.hasContinueEvaluatingBehavior(handler) : false;

    for (let i = 0; i < decisionTable.rules.length; i++) {
      const rule = decisionTable.rules[i];
      const result = this.evaluateRuleWithAudit(rule, inputData || {}, i, decisionTable.inputs, auditContainer);
      results.push(result);

      // 检查是否应该继续评估（如果处理器支持）
      if (hasContinueBehavior && handler && result.matched) {
        const continueResult = (handler as ContinueEvaluatingBehavior).shouldContinueEvaluating(result.matched);
        if (!continueResult.shouldContinue) {
          this.logger.debug(`Stopping rule evaluation at rule ${i}: ${continueResult.reason || 'Hit policy requires stop'}`);
          break;
        }
      }
    }

    return results;
  }

  /**
   * 解析决策表定义
   */
  private parseDecisionTable(decision: DmnDecisionEntity): DecisionTableDefinition {
    const inputs = decision.inputs ? JSON.parse(decision.inputs) : [];
    const outputs = decision.outputs ? JSON.parse(decision.outputs) : [];
    const rules = decision.rules ? JSON.parse(decision.rules) : [];

    return {
      id: decision.id,
      key: decision.decisionKey,
      name: decision.name,
      hitPolicy: decision.hitPolicy,
      aggregation: decision.aggregation,
      inputs,
      outputs,
      rules: rules.map((rule: any, index: number) => ({
        id: rule.id || `rule_${index}`,
        conditions: rule.conditions || [],
        outputs: rule.outputs || [],
        priority: rule.priority,
        description: rule.description,
      })),
    };
  }

  /**
   * 评估所有规则（不带审计，保持向后兼容）
   */
  private evaluateRules(
    decisionTable: DecisionTableDefinition,
    inputData: Record<string, any>,
  ): RuleEvaluationResult[] {
    const results: RuleEvaluationResult[] = [];

    for (let i = 0; i < decisionTable.rules.length; i++) {
      const rule = decisionTable.rules[i];
      const result = this.evaluateRule(rule, inputData, i, decisionTable.inputs);
      results.push(result);
    }

    return results;
  }

  /**
   * 评估单个规则（带审计跟踪）
   * 与Flowable的RuleExecutionAudit匹配
   */
  private evaluateRuleWithAudit(
    rule: RuleDefinition,
    inputData: Record<string, any>,
    ruleIndex: number,
    inputDefinitions: any[],
    auditContainer: DecisionExecutionAuditContainer,
  ): RuleEvaluationResult {
    const ruleAudit: RuleExecutionAudit = {
      ruleId: rule.id,
      ruleNumber: ruleIndex + 1,
      ruleIndex,
      matched: false,
      inputEntries: [],
      outputEntries: [],
    };

    // 评估所有条件
    const conditionResults = rule.conditions.map((condition) => {
      // 获取输入值
      const inputDef = inputDefinitions.find((i) => i.id === condition.inputId);
      let inputValue = inputData[condition.inputId];

      // 如果输入值不存在，尝试使用表达式
      if (inputValue === undefined && inputDef?.expression) {
        inputValue = this.evaluateExpression(inputDef.expression, inputData);
      }

      // 评估条件
      const matched = this.conditionEvaluator.evaluate(
        inputValue,
        condition.operator,
        condition.value,
      );

      // 记录输入条目审计
      const inputEntryAudit: InputEntryAudit = {
        id: `input_${condition.inputId}`,
        inputId: condition.inputId,
        inputName: inputDef?.name || inputDef?.label || condition.inputId,
        inputValue,
        operator: condition.operator,
        conditionValue: condition.value,
        matched,
      };
      ruleAudit.inputEntries.push(inputEntryAudit);

      return matched;
    });

    // 所有条件都必须满足
    const allConditionsMet = conditionResults.every((result) => result === true);
    ruleAudit.matched = allConditionsMet;

    // 构建输出
    const outputs: Record<string, any> = {};
    if (allConditionsMet) {
      for (const output of rule.outputs) {
        outputs[output.outputId] = output.value;

        // 记录输出条目审计
        const outputEntryAudit: OutputEntryAudit = {
          id: `output_${output.outputId}`,
          outputId: output.outputId,
          outputName: output.outputId,
          outputValue: output.value,
        };
        ruleAudit.outputEntries.push(outputEntryAudit);
      }
    }

    // 添加到审计容器
    auditContainer.ruleExecutions.push(ruleAudit);

    return {
      ruleId: rule.id,
      ruleIndex,
      matched: allConditionsMet,
      outputs,
      priority: rule.priority,
    };
  }

  /**
   * 评估单个规则（不带审计）
   */
  private evaluateRule(
    rule: RuleDefinition,
    inputData: Record<string, any>,
    ruleIndex: number,
    inputDefinitions: any[],
  ): RuleEvaluationResult {
    // 评估所有条件
    const conditionResults = rule.conditions.map((condition) => {
      // 获取输入值
      const inputDef = inputDefinitions.find((i) => i.id === condition.inputId);
      let inputValue = inputData[condition.inputId];

      // 如果输入值不存在，尝试使用表达式
      if (inputValue === undefined && inputDef?.expression) {
        inputValue = this.evaluateExpression(inputDef.expression, inputData);
      }

      // 评估条件
      const matched = this.conditionEvaluator.evaluate(
        inputValue,
        condition.operator,
        condition.value,
      );

      return matched;
    });

    // 所有条件都必须满足
    const allConditionsMet = conditionResults.every((result) => result === true);

    // 构建输出
    const outputs: Record<string, any> = {};
    if (allConditionsMet) {
      for (const output of rule.outputs) {
        outputs[output.outputId] = output.value;
      }
    }

    return {
      ruleId: rule.id,
      ruleIndex,
      matched: allConditionsMet,
      outputs,
      priority: rule.priority,
    };
  }

  /**
   * 评估简单表达式
   */
  private evaluateExpression(expression: string, context: Record<string, any>): any {
    try {
      // 简单的表达式评估：支持属性访问
      if (expression.startsWith('${') && expression.endsWith('}')) {
        const expr = expression.slice(2, -1).trim();
        return this.evaluateSimpleExpression(expr, context);
      }

      // 直接属性访问
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expression)) {
        return context[expression];
      }

      // 点号属性访问
      if (/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(expression)) {
        const parts = expression.split('.');
        let value: any = context;
        for (const part of parts) {
          if (value === null || value === undefined) {
            return undefined;
          }
          value = value[part];
        }
        return value;
      }

      return expression;
    } catch (error) {
      this.logger.warn(`Expression evaluation failed: ${expression}, error: ${error.message}`);
      return undefined;
    }
  }

  /**
   * 评估简单表达式
   */
  private evaluateSimpleExpression(expr: string, context: Record<string, any>): any {
    // 支持简单的属性访问和比较
    const parts = expr.split('.');
    let value: any = context;
    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }
    return value;
  }

  /**
   * 应用聚合函数
   */
  private applyAggregation(
    outputs: Record<string, any>[],
    aggregationType: AggregationType,
    outputDefinitions: any[],
  ): Record<string, any> {
    if (!Array.isArray(outputs) || outputs.length === 0) {
      return {};
    }

    const result: Record<string, any> = {};

    for (const outputDef of outputDefinitions) {
      const outputId = outputDef.id;
      const values = outputs.map((o) => o[outputId]).filter((v) => v !== undefined);

      switch (aggregationType) {
        case AggregationType.SUM:
          result[outputId] = values.reduce(
            (sum, v) => sum + (typeof v === 'number' ? v : parseFloat(v) || 0),
            0,
          );
          break;

        case AggregationType.COUNT:
          result[outputId] = values.length;
          break;

        case AggregationType.MIN:
          result[outputId] = Math.min(
            ...values.map((v) => (typeof v === 'number' ? v : parseFloat(v))).filter((v) => !isNaN(v)),
          );
          break;

        case AggregationType.MAX:
          result[outputId] = Math.max(
            ...values.map((v) => (typeof v === 'number' ? v : parseFloat(v))).filter((v) => !isNaN(v)),
          );
          break;

        case AggregationType.NONE:
        default:
          result[outputId] = values;
          break;
      }
    }

    return result;
  }

  /**
   * 保存执行历史
   */
  private async saveExecutionHistory(data: {
    id: string;
    decisionId: string;
    decisionKey: string;
    decisionVersion: number;
    status: DmnExecutionStatus;
    inputData: Record<string, any>;
    outputResult?: any;
    matchedRules?: string[];
    matchedCount?: number;
    executionTimeMs?: number;
    processInstanceId?: string;
    executionId?: string;
    activityId?: string;
    taskId?: string;
    tenantId?: string;
    errorMessage?: string;
    errorDetails?: string;
    auditContainer?: DecisionExecutionAuditContainer;
  }): Promise<void> {
    try {
      const execution = this.executionRepository.create({
        id: data.id,
        decisionId: data.decisionId,
        decisionKey: data.decisionKey,
        decisionVersion: data.decisionVersion,
        status: data.status,
        inputData: JSON.stringify(data.inputData),
        outputResult: data.outputResult ? JSON.stringify(data.outputResult) : null,
        matchedRules: data.matchedRules ? JSON.stringify(data.matchedRules) : null,
        matchedCount: data.matchedCount || 0,
        executionTimeMs: data.executionTimeMs,
        processInstanceId: data.processInstanceId,
        executionId: data.executionId,
        activityId: data.activityId,
        taskId: data.taskId,
        tenantId: data.tenantId,
        errorMessage: data.errorMessage,
        errorDetails: data.errorDetails,
        createTime: new Date(),
        // 存储审计信息（如果实体支持）
        ...(data.auditContainer && { auditInfo: JSON.stringify(data.auditContainer) }),
      });

      await this.executionRepository.save(execution);
    } catch (error) {
      this.logger.error(`Failed to save execution history: ${error.message}`);
    }
  }

  /**
   * 批量执行决策
   */
  async executeBatch(
    decisionId: string,
    inputDataList: Record<string, any>[],
  ): Promise<DecisionResultDto[]> {
    const results: DecisionResultDto[] = [];

    for (const inputData of inputDataList) {
      try {
        const result = await this.execute({
          decisionId,
          inputData,
        });
        results.push(result);
      } catch (error) {
        results.push({
          executionId: uuidv4(),
          decisionId,
          decisionKey: '',
          decisionVersion: 0,
          status: 'failed',
          matchedCount: 0,
          executionTimeMs: 0,
          errorMessage: error.message,
        });
      }
    }

    return results;
  }

  /**
   * 验证决策表
   */
  async validateDecision(decisionId: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const decision = await this.decisionRepository.findOne({
      where: { id: decisionId },
    });

    if (!decision) {
      return {
        valid: false,
        errors: ['Decision not found'],
        warnings: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // 解析决策表
    let inputs: any[], outputs: any[], rules: any[];
    try {
      inputs = decision.inputs ? JSON.parse(decision.inputs) : [];
      outputs = decision.outputs ? JSON.parse(decision.outputs) : [];
      rules = decision.rules ? JSON.parse(decision.rules) : [];
    } catch (error) {
      errors.push(`Failed to parse decision table: ${error.message}`);
      return { valid: false, errors, warnings };
    }

    // 验证输入定义
    if (inputs.length === 0) {
      errors.push('Decision table must have at least one input');
    }

    // 验证输出定义
    if (outputs.length === 0) {
      errors.push('Decision table must have at least one output');
    }

    // 验证规则
    if (rules.length === 0) {
      warnings.push('Decision table has no rules defined');
    }

    // 验证每条规则的条件和输出
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];

      if (!rule.conditions || rule.conditions.length === 0) {
        warnings.push(`Rule ${i + 1} has no conditions defined`);
      }

      if (!rule.outputs || rule.outputs.length === 0) {
        errors.push(`Rule ${i + 1} has no outputs defined`);
      }

      // 验证条件引用的输入是否存在
      for (const condition of rule.conditions || []) {
        const inputExists = inputs.some((input) => input.id === condition.inputId);
        if (!inputExists) {
          errors.push(`Rule ${i + 1} references unknown input: ${condition.inputId}`);
        }
      }

      // 验证输出引用的输出定义是否存在
      for (const output of rule.outputs || []) {
        const outputExists = outputs.some((o) => o.id === output.outputId);
        if (!outputExists) {
          errors.push(`Rule ${i + 1} references unknown output: ${output.outputId}`);
        }
      }
    }

    // 验证UNIQUE hit policy的规则重叠
    if (decision.hitPolicy === HitPolicy.UNIQUE) {
      // 这里可以添加更复杂的规则重叠检测逻辑
      this.logger.debug('UNIQUE hit policy validation - checking for overlapping rules');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
