// DMN决策引擎模块导出

// 实体
export { DmnDecisionEntity, DmnDecisionStatus, HitPolicy, AggregationType } from './entities/dmn-decision.entity';
export { DmnExecutionEntity, DmnExecutionStatus } from './entities/dmn-execution.entity';

// DTO
export {
  CreateDecisionDto,
  UpdateDecisionDto,
  QueryDecisionDto,
  DecisionResponseDto,
  ExecuteDecisionDto,
  DecisionResultDto,
  ExecutionHistoryDto,
  DecisionInputDto,
  DecisionOutputDto,
  DecisionRuleDto,
  RuleConditionDto,
  RuleOutputDto,
} from './dto/dmn.dto';

// 接口
export {
  HitPolicyHandler,
  HitPolicyResult,
  RuleEvaluationResult,
  ConditionEvaluator,
  RuleDefinition,
  RuleCondition,
  RuleOutput,
  DecisionTableDefinition,
  DecisionInputDefinition,
  DecisionOutputDefinition,
} from './interfaces/hit-policy.interface';

// 服务
export { DmnService } from './services/dmn.service';
export { RuleEngineExecutorService } from './services/rule-engine-executor.service';
export { ConditionEvaluatorService } from './services/condition-evaluator.service';
export {
  HitPolicyHandlerFactory,
  UniqueHitPolicyHandler,
  FirstHitPolicyHandler,
  PriorityHitPolicyHandler,
  AnyHitPolicyHandler,
  CollectHitPolicyHandler,
  RuleOrderHitPolicyHandler,
  OutputOrderHitPolicyHandler,
} from './services/hit-policy-handlers.service';

// 控制器
export { DmnController } from './controllers/dmn.controller';

// 模块
export { DmnModule } from './dmn.module';
