import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DmnController } from './controllers/dmn.controller';
import { DmnDecisionEntity } from './entities/dmn-decision.entity';
import { DmnExecutionEntity } from './entities/dmn-execution.entity';
import { ConditionEvaluatorService } from './services/condition-evaluator.service';
import { DmnXmlExporterService } from './services/dmn-xml-exporter.service';
import { DmnXmlParserService } from './services/dmn-xml-parser.service';
import { DmnService } from './services/dmn.service';
import { FeelBuiltinFunctionsService } from './services/feel-builtin-functions.service';
import { FeelEvaluatorService } from './services/feel-evaluator.service';
import { FeelParserService } from './services/feel-parser.service';
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

    // FEEL表达式服务
    FeelBuiltinFunctionsService,
    FeelEvaluatorService,
    FeelParserService,

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
    FeelParserService,
    FeelEvaluatorService,
    FeelBuiltinFunctionsService,
  ],
})
export class DmnModule {}
