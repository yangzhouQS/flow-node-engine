import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

// 导入核心服务
import { BpmnParserService } from './services/bpmn-parser.service';
import { EventBusService } from './services/event-bus.service';
import { ExpressionEvaluatorService } from './services/expression-evaluator.service';
import { GatewayExecutorService } from './services/gateway-executor.service';
import { ProcessEngineService } from './services/process-engine.service';
import { ProcessExecutorService } from './services/process-executor.service';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot(),
  ],
  providers: [
    ProcessEngineService,
    EventBusService,
    ExpressionEvaluatorService,
    BpmnParserService,
    ProcessExecutorService,
    GatewayExecutorService,
  ],
  exports: [
    ProcessEngineService,
    EventBusService,
    ExpressionEvaluatorService,
    BpmnParserService,
    ProcessExecutorService,
    GatewayExecutorService,
  ],
})
export class ProcessEngineCoreModule {}

// 别名导出，方便导入
export { ProcessEngineCoreModule as CoreModule };
