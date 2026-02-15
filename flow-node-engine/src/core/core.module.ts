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

// 导入监听器服务
import { ListenerRegistryService } from './services/listener-registry.service';
import { BuiltinListenerFactory } from './services/builtin-listeners.service';

// 导入补偿服务
import { CompensationService } from './services/compensation.service';

// 导入多实例服务
import { MultiInstanceService } from './services/multi-instance.service';

// 导入事务子流程服务
import {
  TransactionSubProcessService,
  TransactionSubProcessExecutor,
} from './services/transaction-subprocess.service';

// 导入动态流程修改服务
import { DynamicProcessService } from './services/dynamic-modification.service';

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
    // 监听器服务
    ListenerRegistryService,
    BuiltinListenerFactory,
    // 补偿服务
    CompensationService,
    // 多实例服务
    MultiInstanceService,
    // 事务子流程服务
    TransactionSubProcessService,
    TransactionSubProcessExecutor,
    // 动态流程修改服务
    DynamicProcessService,
  ],
  exports: [
    ProcessEngineService,
    EventBusService,
    ExpressionEvaluatorService,
    BpmnParserService,
    ProcessExecutorService,
    GatewayExecutorService,
    InclusiveGatewayStateService,
    // 监听器服务
    ListenerRegistryService,
    BuiltinListenerFactory,
    // 补偿服务
    CompensationService,
    // 多实例服务
    MultiInstanceService,
    // 事务子流程服务
    TransactionSubProcessService,
    TransactionSubProcessExecutor,
    // 动态流程修改服务
    DynamicProcessService,
  ],
})
export class ProcessEngineCoreModule {}

// 别名导出，方便导入
export { ProcessEngineCoreModule as CoreModule };
