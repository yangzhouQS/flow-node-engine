import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DmnController } from './controllers/dmn.controller';
import { DmnDecisionEntity } from './entities/dmn-decision.entity';
import { DmnExecutionEntity } from './entities/dmn-execution.entity';
import { ConditionEvaluatorService } from './services/condition-evaluator.service';
import { DmnService } from './services/dmn.service';
import { HitPolicyHandlerFactory ,
  UniqueHitPolicyHandler,
  FirstHitPolicyHandler,
  PriorityHitPolicyHandler,
  AnyHitPolicyHandler,
  CollectHitPolicyHandler,
  RuleOrderHitPolicyHandler,
  OutputOrderHitPolicyHandler,
  UnorderedHitPolicyHandler,
} from './services/hit-policy-handlers.service';
import { RuleEngineExecutorService } from './services/rule-engine-executor.service';
import { DmnXmlParserService } from './services/dmn-xml-parser.service';
import { DmnXmlExporterService } from './services/dmn-xml-exporter.service';


@Module({
  imports: [TypeOrmModule.forFeature([DmnDecisionEntity, DmnExecutionEntity])],
  controllers: [DmnController],
  providers: [
    // 服务
    DmnService,
    RuleEngineExecutorService,
    ConditionEvaluatorService,

    // XML导入导出服务
    DmnXmlParserService,
    DmnXmlExporterService,

    // Hit Policy处理器（与Flowable保持一致，支持8种策略）
    UniqueHitPolicyHandler,
    FirstHitPolicyHandler,
    PriorityHitPolicyHandler,
    AnyHitPolicyHandler,
    CollectHitPolicyHandler,
    RuleOrderHitPolicyHandler,
    OutputOrderHitPolicyHandler,
    UnorderedHitPolicyHandler,
    HitPolicyHandlerFactory,
  ],
  exports: [
    DmnService,
    RuleEngineExecutorService,
    HitPolicyHandlerFactory,
    ConditionEvaluatorService,
    DmnXmlParserService,
    DmnXmlExporterService,
  ],
})
export class DmnModule {}
