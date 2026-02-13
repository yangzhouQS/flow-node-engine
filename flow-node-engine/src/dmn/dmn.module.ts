import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DmnDecisionEntity } from './entities/dmn-decision.entity';
import { DmnExecutionEntity } from './entities/dmn-execution.entity';
import { DmnController } from './controllers/dmn.controller';
import { DmnService } from './services/dmn.service';
import { RuleEngineExecutorService } from './services/rule-engine-executor.service';
import { HitPolicyHandlerFactory } from './services/hit-policy-handlers.service';
import {
  UniqueHitPolicyHandler,
  FirstHitPolicyHandler,
  PriorityHitPolicyHandler,
  AnyHitPolicyHandler,
  CollectHitPolicyHandler,
  RuleOrderHitPolicyHandler,
  OutputOrderHitPolicyHandler,
} from './services/hit-policy-handlers.service';
import { ConditionEvaluatorService } from './services/condition-evaluator.service';

@Module({
  imports: [TypeOrmModule.forFeature([DmnDecisionEntity, DmnExecutionEntity])],
  controllers: [DmnController],
  providers: [
    // 服务
    DmnService,
    RuleEngineExecutorService,
    ConditionEvaluatorService,

    // Hit Policy处理器
    UniqueHitPolicyHandler,
    FirstHitPolicyHandler,
    PriorityHitPolicyHandler,
    AnyHitPolicyHandler,
    CollectHitPolicyHandler,
    RuleOrderHitPolicyHandler,
    OutputOrderHitPolicyHandler,
    HitPolicyHandlerFactory,
  ],
  exports: [
    DmnService,
    RuleEngineExecutorService,
    HitPolicyHandlerFactory,
    ConditionEvaluatorService,
  ],
})
export class DmnModule {}
