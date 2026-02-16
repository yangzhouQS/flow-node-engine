# 核心概念

本章节介绍 flow-node-engine 的核心概念和架构设计，帮助你理解流程引擎的工作原理。

---

## 核心术语

### 1. 节点（Node）

节点是流程定义中的基本组成元素，代表流程中的一个步骤或活动。

#### 节点类型

| 类型 | 说明 | 示例 |
|------|------|------|
| **开始事件（Start Event）** | 流程的起点 | 用户发起请假申请 |
| **结束事件（End Event）** | 流程的终点 | 流程完成 |
| **用户任务（User Task）** | 需要人工处理的任务 | 审批、填写表单 |
| **服务任务（Service Task）** | 自动执行的任务 | 发送通知、调用接口 |
| **脚本任务（Script Task）** | 执行脚本的任务 | 数据转换 |
| **网关（Gateway）** | 控制流程流转 | 排他网关、并行网关 |
| **子流程（Sub Process）** | 嵌套的流程 | 嵌套审批流程 |

### 2. 流程（Flow）

流程是节点和连线组成的业务过程定义。

#### 流程定义

流程定义是对业务流程的模型描述，包括：
- 节点：流程中的各个步骤
- 连线：节点之间的流转关系
- 事件：流程的开始和结束
- 网关：流程的条件分支

#### 流程实例

流程实例是流程定义的具体执行，每启动一次流程就会创建一个流程实例。

```typescript
interface ProcessInstance {
  id: string;                    // 实例ID
  processDefinitionId: string;   // 流程定义ID
  processDefinitionKey: string;  // 流程定义Key
  businessKey: string;           // 业务Key
  status: 'ACTIVE' | 'SUSPENDED' | 'COMPLETED' | 'TERMINATED';
  startTime: Date;               // 开始时间
  endTime: Date;                 // 结束时间
  startUserId: string;           // 启动用户ID
}
```

#### 流程生命周期

```
┌─────────┐     ┌─────────┐     ┌──────────┐     ┌────────────┐
│  ACTIVE │────▶│SUSPENDED│────▶│ RESUMED  │────▶│ COMPLETED  │
└─────────┘     └─────────┘     └──────────┘     └────────────┘
     │                                           
     │                  ┌────────────┐
     └────────────────▶│ TERMINATED │
                        └────────────┘
```

### 3. 引擎（Engine）

引擎是流程执行的核心，负责解析流程定义、管理流程实例、执行任务。

#### 核心服务

| 服务 | 说明 |
|------|------|
| **ProcessDefinitionService** | 流程定义管理 |
| **ProcessInstanceService** | 流程实例管理 |
| **TaskService** | 任务管理 |
| **HistoryService** | 历史记录 |
| **ExpressionEvaluatorService** | 表达式求值 |
| **EventBusService** | 事件总线 |

---

## 架构设计概述

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         应用层 (NestJS)                         │
├─────────────────────────────────────────────────────────────────┤
│  Controllers │  Services │  Modules │  Guards │  Interceptors  │
├─────────────────────────────────────────────────────────────────┤
│                      流程引擎核心层                              │
├─────────────────────────────────────────────────────────────────┤
│  ProcessExecutor │ TaskExecutor │ GatewayExecutor │ Expression  │
├─────────────────────────────────────────────────────────────────┤
│                        数据访问层                                │
├─────────────────────────────────────────────────────────────────┤
│  TypeORM │ Repository │ Entities │ Migrations                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     外部服务 (可选)                              │
├─────────────────────────────────────────────────────────────────┤
│  Redis (缓存/队列) │ MySQL (数据存储) │ Kafka (消息队列)        │
└─────────────────────────────────────────────────────────────────┘
```

### 模块说明

#### 1. 核心模块（core）

核心模块是流程引擎的大脑，负责流程的执行和控制。

```
src/core/
├── interfaces/          # 核心接口定义
│   ├── bpmn-process.interface.ts
│   ├── process-instance.interface.ts
│   ├── listener.interface.ts
│   ├── compensation.interface.ts
│   └── multi-instance.interface.ts
├── services/
│   ├── process-executor.service.ts    # 流程执行器
│   ├── bpmn-parser.service.ts          # BPMN 解析器
│   ├── expression-evaluator.service.ts # 表达式求值
│   ├── gateway-executor.service.ts    # 网关执行器
│   ├── listener-registry.service.ts   # 监听器注册
│   └── compensation.service.ts        # 补偿服务
└── repositories/         # 数据仓储
```

#### 2. 任务模块（task）

任务模块负责人工任务的处理。

```
src/task/
├── controllers/
│   ├── task.controller.ts        # 任务 CRUD
│   └── task-reject.controller.ts # 任务驳回
├── services/
│   ├── task.service.ts           # 任务核心服务
│   ├── task-reject.service.ts    # 任务驳回
│   └── cc.service.ts             # 抄送服务
├── entities/
│   ├── task.entity.ts           # 任务实体
│   └── task-candidate-user.entity.ts
└── dto/                         # 数据传输对象
```

#### 3. 决策引擎模块（dmn）

DMN 模块负责业务规则的执行。

```
src/dmn/
├── services/
│   ├── dmn.service.ts            # 决策服务
│   ├── rule-engine-executor.service.ts # 规则引擎
│   ├── feel-evaluator.service.ts # FEEL 表达式
│   └── hit-policy-handlers.service.ts # 命中策略
├── entities/
│   ├── dmn-decision.entity.ts   # 决策实体
│   └── dmn-execution.entity.ts  # 执行记录
└── interfaces/
    └── hit-policy.interface.ts   # 命中策略接口
```

#### 4. 历史模块（history）

历史模块记录流程执行的历史数据。

```
src/history/
├── services/
│   ├── history.service.ts        # 历史服务
│   └── history-archive.service.ts # 归档服务
└── entities/
    ├── historic-process-instance.entity.ts
    ├── historic-task-instance.entity.ts
    └── historic-variable-instance.entity.ts
```

### 核心工作流程

#### 流程启动流程

```
用户请求
    │
    ▼
┌─────────────────┐
│  部署流程定义   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  启动流程实例   │◀──────────────┐
└────────┬────────┘               │
         │                        │
         ▼                        │
┌─────────────────┐               │
│  解析 BPMN     │               │
│  流程定义       │               │
└────────┬────────┘               │
         │                        │
         ▼                        │
┌─────────────────┐               │
│  创建执行树     │               │
└────────┬────────┘               │
         │                        │
         ▼                        │
┌─────────────────┐               │
│  执行第一个节点 │               │
│  (User Task)   │               │
└────────┬────────┘               │
         │                        │
         ▼                        │
┌─────────────────┐               │
│  保存任务到数据库 │             │
└────────┬────────┘               │
         │                        │
         ▼                        │
┌─────────────────┐               │
│  返回任务列表   │───────────────▶ 流程结束
│  给前端         │
└─────────────────┘
```

#### 任务处理流程

```
用户完成任务
    │
    ▼
┌─────────────────┐
│  验证任务状态   │
└────────┬────────┘
         │
    ┌────┴────┐
    │ 有效    │ 无效
    ▼         ▼
┌─────────────────┐
│  执行任务前监听器 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  处理任务变量   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  计算下一步节点 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  执行任务后监听器 │
└────────┬────────┘
         │
    ┌────┴────┐
    │ 有后续节点 │ 无后续节点
    ▼         ▼
┌─────────────────┐
│  执行业务逻辑   │◀──────────────┐
└────────┬────────┘               │
         │                        │
         ▼                        │
┌─────────────────┐               │
│  流转到下一节点 │               │
└────────┬────────┘               │
         │                        │
         ▼                        │
┌─────────────────┐               │
│  创建新任务     │───────────────▶ 流程结束
└─────────────────┘
```

### 扩展性设计

#### 1. 监听器扩展

支持两种类型的监听器：

```typescript
// 执行监听器 - 在流程节点进入、离开、执行时触发
interface ExecutionListener {
  event: 'start' | 'end' | 'take';
  implementation: 'class' | 'expression' | 'delegateExpression';
  onEvent: (execution: Execution) => void;
}

// 任务监听器 - 在任务创建、分配、完成、删除时触发
interface TaskListener {
  event: 'create' | 'assignment' | 'complete' | 'delete';
  implementation: 'class' | 'expression';
  onEvent: (task: Task) => void;
}
```

#### 2. 表达式扩展

支持多种表达式类型：

| 类型 | 说明 | 示例 |
|------|------|------|
| **UEL** | 统一表达式语言 | `${user.name}` |
| **FEEL** | DMN 表达式语言 | `if age >= 18 then "adult" else "minor"` |
| **脚本** | JavaScript 脚本 | `<script>...</script>` |

#### 3. 自定义节点行为

可以通过实现接口来扩展节点行为：

```typescript
// 自定义服务任务
@Injectable()
export class MyCustomService implements ActivityBehavior {
  async execute(execution: Execution): Promise<void> {
    // 自定义业务逻辑
    console.log('执行自定义服务任务');
    
    // 继续流程
    this.leave(execution);
  }
}
```

---

## 数据模型

### 核心实体关系

```
┌──────────────────┐       ┌──────────────────┐
│ ProcessDefinition │       │   Deployment     │
└────────┬─────────┘       └────────┬─────────┘
         │                         │
         │ 1:n                     │ 1:n
         ▼                         ▼
┌──────────────────┐       ┌──────────────────┐
│ ProcessInstance  │──────▶│    Execution     │
└────────┬─────────┘       └────────┬─────────┘
         │                         │
         │ 1:n                      │ 1:n
         ▼                         ▼
┌──────────────────┐       ┌──────────────────┐
│      Task       │◀──────│   IdentityLink    │
└──────────────────┘       └──────────────────┘
         │
         │ n:1
         ▼
┌──────────────────┐
│  TaskComment    │
└──────────────────┘
```

### 核心表结构

| 表名 | 说明 |
|------|------|
| `process_definition` | 流程定义表 |
| `deployment` | 部署记录表 |
| `process_instance` | 流程实例表 |
| `execution` | 执行表 |
| `task` | 任务表 |
| `identity_link` | 身份关联表 |
| `variable` | 变量表 |
| `event_subscription` | 事件订阅表 |
| `job` | 作业表 |
