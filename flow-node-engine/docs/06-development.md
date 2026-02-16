# 开发指南

本章节为开发者提供项目结构说明、二次开发指南以及测试调试方法。

---

## 项目结构说明

### 目录结构

```
flow-node-engine/
├── src/
│   ├── app.module.ts              # 应用根模块
│   ├── main.ts                    # 应用入口
│   │
│   ├── auth/                      # 认证模块
│   │   ├── guards/                # 守卫
│   │   └── decorators/            # 装饰器
│   │
│   ├── batch/                     # 批处理模块
│   │   ├── controllers/
│   │   ├── dto/
│   │   ├── entities/
│   │   └── services/
│   │
│   ├── comment/                   # 评论模块
│   │
│   ├── common/                    # 公共模块
│   │   ├── constants/              # 常量
│   │   ├── dto/                    # 公共DTO
│   │   ├── entities/               # 公共实体
│   │   ├── enums/                  # 枚举
│   │   ├── exceptions/             # 异常
│   │   ├── filters/                # 过滤器
│   │   ├── interceptors/           # 拦截器
│   │   ├── middlewares/            # 中间件
│   │   └── services/               # 公共服务
│   │
│   ├── config/                     # 配置模块
│   │
│   ├── content/                    # 内容管理模块
│   │
│   ├── core/                       # 核心引擎模块
│   │   ├── interfaces/             # 接口定义
│   │   ├── repositories/           # 数据仓储
│   │   └── services/               # 核心服务
│   │
│   ├── diagram/                    # 流程图模块
│   │
│   ├── dmn/                        # DMN决策引擎
│   │   ├── controllers/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── interfaces/
│   │   └── services/
│   │
│   ├── event/                      # 事件模块
│   │
│   ├── event-subscription/         # 事件订阅模块
│   │
│   ├── form/                       # 表单模块
│   │
│   ├── history/                    # 历史模块
│   │
│   ├── identity/                   # 身份管理模块
│   │
│   ├── identity-link/              # 身份关联模块
│   │
│   ├── integration/                # 集成模块
│   │
│   ├── job/                        # 作业调度模块
│   │
│   ├── ldap/                       # LDAP集成模块
│   │
│   ├── mail/                       # 邮件模块
│   │
│   ├── migration/                  # 流程迁移模块
│   │
│   ├── notification/               # 通知模块
│   │
│   ├── process-definition/        # 流程定义模块
│   │
│   ├── process-instance/          # 流程实例模块
│   │
│   ├── progress-tracking/        # 进度跟踪模块
│   │
│   └── task/                      # 任务模块
│       ├── controllers/
│       ├── dto/
│       ├── entities/
│       └── services/
│
├── test/                          # 测试目录
│   ├── e2e/                       # 端到端测试
│   ├── fixtures/                  # 测试数据
│   └── integration/              # 集成测试
│
├── docs/                          # 文档目录
├── package.json
├── tsconfig.json
├── vitest.config.ts               # 测试配置
├── nest-cli.json
└── README.md
```

### 核心模块功能划分

| 模块 | 主要功能 |
|------|----------|
| **core** | 流程解析、执行器、表达式求值、监听器、补偿 |
| **task** | 任务创建、认领、完成、驳回、抄送 |
| **process-definition** | 流程定义管理、部署、激活、挂起 |
| **process-instance** | 流程实例管理、启动、终止、变量 |
| **dmn** | 决策表、规则引擎、FEEL表达式 |
| **history** | 历史记录、归档、清理 |
| **identity** | 用户、角色、组管理 |
| **job** | 定时任务、异步任务 |
| **form** | 动态表单、验证 |

---

## 二次开发指南

### 1. 扩展自定义节点类型

如果你需要添加自定义的节点类型，可以按照以下步骤实现：

#### 步骤1：定义节点行为接口

```typescript
// src/core/interfaces/custom-activity.interface.ts
import { Execution } from './execution.interface';

export interface ActivityBehavior {
  execute(execution: Execution): Promise<void>;
}
```

#### 步骤2：实现自定义处理器

```typescript
// src/core/services/custom-handlers/http-call.handler.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ActivityBehavior } from '../interfaces/custom-activity.interface';
import { Execution } from '../interfaces/execution.interface';

@Injectable()
export class HttpCallHandler implements ActivityBehavior {
  constructor(private readonly httpService: HttpService) {}

  async execute(execution: Execution): Promise<void> {
    const url = execution.getVariable('httpUrl');
    const method = execution.getVariable('httpMethod') || 'GET';
    const body = execution.getVariable('httpBody');

    const response = await this.httpService.axiosRef.request({
      url,
      method,
      data: body,
    });

    execution.setVariable('httpResponse', response.data);
    this.leave(execution);
  }

  private leave(execution: Execution): void {
    execution.takeAllOutgoingExecutions();
  }
}
```

#### 步骤3：注册自定义处理器

```typescript
// src/core/services/activity-behavior-registry.service.ts
import { Injectable } from '@nestjs/common';
import { HttpCallHandler } from './custom-handlers/http-call.handler';

@Injectable()
export class ActivityBehaviorRegistry {
  private behaviors = new Map<string, any>();

  constructor(private readonly httpCallHandler: HttpCallHandler) {
    this.registerBehaviors();
  }

  private registerBehaviors(): void {
    this.behaviors.set('httpCall', this.httpCallHandler);
    this.behaviors.set('mailTask', new MailTaskHandler());
    // 添加更多自定义处理器
  }

  getBehavior(type: string): any {
    return this.behaviors.get(type);
  }
}
```

#### 步骤4：在 BPMN 解析器中处理

```typescript
// src/core/services/bpmn-parser.service.ts
parseElement(element: BpmnElement): ProcessNode {
  // ... 其他解析逻辑
  
  if (element.type === 'serviceTask') {
    const implementation = element.$attrs['flowable:class'] || 
                         element.$attrs['flowable:delegateExpression'];
    
    if (implementation === 'HttpCallHandler') {
      return {
        ...baseElement,
        behavior: this.activityBehaviorRegistry.getBehavior('httpCall'),
      };
    }
  }
}
```

---

### 2. 添加自定义监听器

```typescript
// src/core/services/custom-listener/audit-log.listener.ts
import { Injectable, Logger } from '@nestjs/common';
import { ExecutionListener, TaskListener } from '../interfaces/listener.interface';
import { Execution } from '../interfaces/execution.interface';

@Injectable()
export class AuditLogListener implements ExecutionListener, TaskListener {
  private readonly logger = new Logger(AuditLogListener.name);

  async onEvent(execution: Execution): Promise<void> {
    const eventType = execution.getEventName();
    const processInstanceId = execution.getProcessInstanceId();
    const activityId = execution.getCurrentActivityId();

    this.logger.log(
      `审计日志: 事件类型=${eventType}, 流程实例ID=${processInstanceId}, 节点ID=${activityId}`
    );

    // 可以将审计日志保存到数据库
    await this.saveAuditLog({
      eventType,
      processInstanceId,
      activityId,
      timestamp: new Date(),
    });
  }

  private async saveAuditLog(log: any): Promise<void> {
    // 保存到数据库
  }
}
```

---

### 3. 扩展表达式函数

```typescript
// src/core/services/extended-expression.functions.ts
export class ExtendedExpressionFunctions {
  static getApproverByDepartment(department: string): string {
    const approverMap: Record<string, string> = {
      '技术部': 'tech_manager',
      '财务部': 'finance_manager',
      '人力资源部': 'hr_manager',
    };
    return approverMap[department] || 'default_manager';
  }

  static calculateDays(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  static isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }
}
```

在表达式中使用：

```xml
<bpmn:userTask id="Task_1">
  <bpmn:incoming>Flow_1</bpmn:incoming>
  <bpmn:outgoing>Flow_2</bpmn:outgoing>
  <bpmn:extensionElements>
    <flowable:field name="assignee">
      <flowable:expression>
        ${extendedFunctions.getApproverByDepartment(department)}
      </flowable:expression>
    </flowable:field>
  </bpmn:extensionElements>
</bpmn:userTask>
```

---

### 4. 添加新的命中策略

```typescript
// src/dmn/services/hit-policy/rule-order.handler.ts
import { Injectable } from '@nestjs/common';
import { HitPolicyHandler } from '../interfaces/hit-policy.interface';
import { DecisionRule, DecisionTable } from '../entities/dmn-decision.entity';

@Injectable()
export class RuleOrderHitPolicyHandler implements HitPolicyHandler {
  evaluate(
    decisionTable: DecisionTable,
    rules: DecisionRule[],
    inputs: Record<string, any>
  ): any {
    // 按规则优先级排序
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (this.matches(rule, inputs)) {
        return this.collectOutputs(rule);
      }
    }

    return null;
  }

  private matches(rule: DecisionRule, inputs: Record<string, any>): boolean {
    // 检查输入是否匹配规则
    return true;
  }

  private collectOutputs(rule: DecisionRule): any {
    // 收集输出
    return rule.outputs;
  }
}
```

---

## 测试与调试

### 1. 单元测试

项目使用 Vitest 作为测试框架。

#### 运行单元测试

```bash
# 运行所有单元测试
pnpm test

# 运行指定文件的测试
pnpm test src/core/services/process-executor.service.spec.ts

# 监听模式运行测试
pnpm test:watch
```

#### 测试示例

```typescript
// src/task/services/task.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from '../entities/task.entity';

describe('TaskService', () => {
  let service: TaskService;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: getRepositoryToken(Task),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findTodoTasks', () => {
    it('should return todo tasks for a user', async () => {
      const mockTasks = [
        { id: '1', name: '审批任务', assignee: 'user1' },
      ];
      mockRepository.find.mockResolvedValue(mockTasks);

      const result = await service.findTodoTasks('user1');

      expect(result).toEqual(mockTasks);
      expect(mockRepository.find).toHaveBeenCalled();
    });
  });
});
```

---

### 2. 集成测试

#### 运行集成测试

```bash
# 运行集成测试
pnpm test:integration

# 或使用 vitest
vitest run --config vitest.config.ts --testNamePattern "integration"
```

#### 测试示例

```typescript
// test/integration/process-instance.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ProcessInstanceModule } from '../../src/process-instance/process-instance.module';

describe('ProcessInstance (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ProcessInstanceModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should start a new process instance', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/process-instances')
      .send({
        processDefinitionKey: 'TestProcess',
        variables: { testVar: 'testValue' },
      })
      .expect(201);

    expect(response.body.code).toBe(0);
    expect(response.body.data).toHaveProperty('id');
  });
});
```

---

### 3. 端到端测试

#### 运行 E2E 测试

```bash
# 运行 E2E 测试
pnpm test:e2e
```

#### 测试示例

```typescript
// test/e2e/task-management.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestUtils } from '../utils/test-utils';

describe('Task Management (E2E)', () => {
  let app: INestApplication;
  let testUtils: TestUtils;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    testUtils = new TestUtils(app);
    await testUtils.init();
  });

  afterAll(async () => {
    await testUtils.cleanup();
    await app.close();
  });

  describe('Task Lifecycle', () => {
    it('should complete a task flow', async () => {
      // 1. 部署流程
      const deployment = await testUtils.deployProcess('simple-approval.bpmn');
      
      // 2. 启动流程
      const instance = await testUtils.startProcess(deployment.key);
      
      // 3. 获取任务
      const tasks = await testUtils.getTasks(instance.id);
      expect(tasks).toHaveLength(1);
      
      // 4. 完成任务
      const completed = await testUtils.completeTask(tasks[0].id);
      expect(completed).toBe(true);
    });
  });
});
```

---

### 4. 调试环境搭建

#### 使用 VS Code 调试

创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug: Start:dev",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["run", "start:debug"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug: Test",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["run", "test:debug"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

#### 使用 NDB 调试

```bash
# 全局安装 ndb
npm install -g ndb

# 启动调试
ndb pnpm run start:dev
```

---

### 5. 常见问题调试方法

#### 调试流程执行问题

```typescript
// 在关键位置添加日志
@Injectable()
export class ProcessExecutorService {
  async execute(execution: Execution): Promise<void> {
    console.log('=== Process Execution Debug ===');
    console.log('ProcessInstanceId:', execution.getProcessInstanceId());
    console.log('CurrentActivity:', execution.getCurrentActivityId());
    console.log('Variables:', execution.getVariables());
    
    try {
      await this.doExecute(execution);
    } catch (error) {
      console.error('Execution Error:', error);
      throw error;
    }
  }
}
```

#### 调试数据库查询

```typescript
// 启用查询日志
const dataSource = new DataSource({
  // ...
  logging: ['query', 'error'], // 启用查询日志
});

// 或者临时启用
dataSource.manager.query('SELECT * FROM task').then(() => {
  // 查看日志输出
});
```

---

### 6. 性能测试

#### 运行性能测试

```bash
# 运行性能测试
pnpm test:performance
```

#### 性能测试示例

```typescript
// test/performance/process-instance-startup.perf.spec.ts
import { describe } from 'vitest';

describe('Performance Tests', () => {
  it('should start 1000 process instances in < 10 seconds', async () => {
    const startTime = Date.now();
    
    const promises = Array(1000).fill(null).map((_, i) => 
      processInstanceService.start({
        processDefinitionKey: 'TestProcess',
        variables: { index: i },
      })
    );
    
    await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    console.log(`Started 1000 instances in ${duration}ms`);
    
    expect(duration).toBeLessThan(10000);
  });
});
```
