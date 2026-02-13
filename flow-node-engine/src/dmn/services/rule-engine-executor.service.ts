import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DmnDecisionEntity, HitPolicy, AggregationType, DmnDecisionStatus } from '../entities/dmn-decision.entity';
import { DmnExecutionEntity, DmnExecutionStatus } from '../entities/dmn-execution.entity';
import {
  RuleEvaluationResult,
  DecisionTableDefinition,
  RuleDefinition,
} from '../interfaces/hit-policy.interface';
import { ExecuteDecisionDto, DecisionResultDto } from '../dto/dmn.dto';
import { HitPolicyHandlerFactory, CollectHitPolicyHandler } from './hit-policy-handlers.service';
import { ConditionEvaluatorService } from './condition-evaluator.service';

/**
 * 规则引擎执行器服务
 * 负责执行决策表并返回结果
 */
@Injectable()
export class RuleEngineExecutorService {
  private readonly logger = new Logger(RuleEngineExecutorService.name);

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
   * @returns 决策结果
   */
  async execute(dto: ExecuteDecisionDto): Promise<DecisionResultDto> {
    const startTime = Date.now();
    const executionId = uuidv4();

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
      throw new Error('Either decisionId or decisionKey must be provided');
    }

    if (!decision) {
      throw new Error('Decision not found');
    }

    if (decision.status !== DmnDecisionStatus.PUBLISHED) {
      throw new Error(`Decision is not published. Current status: ${decision.status}`);
    }

    try {
      // 解析决策表定义
      const decisionTable = this.parseDecisionTable(decision);

      // 评估所有规则
      const evaluationResults = this.evaluateRules(decisionTable, dto.inputData);

      // 获取Hit Policy处理器并处理结果
      const handler = this.hitPolicyHandlerFactory.getHandler(decision.hitPolicy as HitPolicy);
      const hitPolicyResult = handler.handle(evaluationResults);

      // 处理聚合（如果需要）
      let finalOutput = hitPolicyResult.output;
      if (hitPolicyResult.needsAggregation && decision.aggregation !== AggregationType.NONE) {
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
        processInstanceId: dto.processInstanceId,
        executionId: dto.executionId,
        activityId: dto.activityId,
        taskId: dto.taskId,
        tenantId: dto.tenantId,
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
        processInstanceId: dto.processInstanceId,
        executionId: dto.executionId,
        activityId: dto.activityId,
        taskId: dto.taskId,
        tenantId: dto.tenantId,
        errorMessage: error.message,
        errorDetails: error.stack,
      });

      throw error;
    }
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
   * 评估所有规则
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
   * 评估单个规则
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
