import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';

// 导入实体
import { InclusiveGatewayStateEntity } from './entities/inclusive-gateway-state.entity';

// 导入核心服务
import { BpmnParserService } from './services/bpmn-parser.service';
import { EventBusService } from './services/event-bus.service';
import { ExpressionEvaluatorService } from './services/expression-evaluator.service';
import { GatewayExecutorService } from './services/gateway-executor.service';
import { InclusiveGatewayStateService } from './services/inclusive-gateway-state.service';
import { ProcessEngineService } from './services/process-engine.service';
import { ProcessExecutorService } from './services/process-executor.service';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    TypeOrmModule.forFeature([InclusiveGatewayStateEntity]),
  ],
  providers: [
    ProcessEngineService,
    EventBusService,
    ExpressionEvaluatorService,
    BpmnParserService,
    ProcessExecutorService,
    GatewayExecutorService,
    InclusiveGatewayStateService,
  ],
  exports: [
    ProcessEngineService,
    EventBusService,
    ExpressionEvaluatorService,
    BpmnParserService,
    ProcessExecutorService,
    GatewayExecutorService,
    InclusiveGatewayStateService,
  ],
})
export class ProcessEngineCoreModule {}

// 别名导出，方便导入
export { ProcessEngineCoreModule as CoreModule };
