# Flowable 功能对比分析报告

## 文档说明

本文档对比分析 Flowable 7.0.0 源码模块与 NestJS 设计文档（核心功能梳理、技术设计文档、实现方案文档、任务操作补充设计、DMN决策引擎设计）之间的功能差异，为后续开发提供优化建议。

**更新说明**：本文档已根据新增的设计文档更新，新增模块已纳入覆盖范围：
- ⭐ 任务操作补充设计（04-任务操作补充设计.md）
- ⭐ DMN决策引擎设计（05-DMN决策引擎设计.md）

---

## 一、Flowable 核心模块结构分析

### 1.1 Flowable 模块架构概览

Flowable 采用高度模块化的架构设计，主要模块如下：

```
flowable-engine/                    # 核心流程引擎
├── RepositoryService               # 流程定义仓库服务
├── RuntimeService                  # 运行时服务
├── TaskService                     # 任务服务
├── HistoryService                  # 历史服务
├── IdentityService                 # 身份服务
├── ManagementService               # 管理服务
├── FormService                     # 表单服务
└── DynamicBpmnService              # 动态BPMN服务

flowable-task-service-api/          # 任务服务API
flowable-variable-service-api/      # 变量服务API
flowable-identitylink-service-api/  # 身份链接服务API
flowable-entitylink-service-api/    # 实体链接服务API
flowable-eventsubscription-service-api/  # 事件订阅服务API
flowable-job-service-api/           # 作业服务API
flowable-bpmn-model/                # BPMN模型
flowable-bpmn-converter/            # BPMN转换器
flowable-form-api/                  # 表单API
flowable-idm-api/                   # 身份管理API
flowable-dmn-api/                   # 决策管理API
flowable-cmmn-api/                  # 案例管理API
flowable-event-registry-api/        # 事件注册API
flowable-batch-service-api/         # 批量服务API
flowable-content-api/               # 内容服务API
```

### 1.2 核心服务接口分析

#### 1.2.1 RepositoryService（流程定义仓库服务）

**Flowable 原生功能：**
- `createDeployment()` - 创建部署
- `deleteDeployment()` - 删除部署（支持级联删除）
- `suspendProcessDefinitionById/ByKey()` - 挂起流程定义
- `activateProcessDefinitionById/ByKey()` - 激活流程定义
- `getProcessModel()` - 获取流程模型XML
- `getProcessDiagram()` - 获取流程图
- `getBpmnModel()` - 获取BPMN模型对象
- `getProcessDiagramLayout()` - 获取流程图布局
- `validateProcess()` - 验证流程定义
- `addCandidateStarterUser/Group()` - 添加候选人
- `getIdentityLinksForProcessDefinition()` - 获取身份链接
- `changeDeploymentTenantId()` - 更改租户ID
- Model管理（创建、保存、删除模型）
- DMN决策和Form表单关联

**NestJS 设计覆盖情况：**
| 功能 | 覆盖状态 | 备注 |
|------|---------|------|
| 部署管理 | ✅ 已覆盖 | DeploymentBuilder模式 |
| 流程定义CRUD | ✅ 已覆盖 | 基本功能完整 |
| 挂起/激活 | ✅ 已覆盖 | 支持定时操作 |
| 流程图生成 | ⚠️ 部分覆盖 | 缺少DiagramLayout |
| BPMN验证 | ✅ 已覆盖 | BpmnParserService |
| 候选人管理 | ❌ 未覆盖 | 缺少流程定义级别的候选人 |
| Model管理 | ❌ 未覆盖 | 未设计模型管理功能 |
| 租户管理 | ⚠️ 部分覆盖 | 缺少changeTenantId |
| DMN关联 | ⭐✅ 已覆盖 | DMN决策引擎已设计 |
| Form关联 | ⚠️ 部分覆盖 | 基本表单功能 |

---

#### 1.2.2 RuntimeService（运行时服务）

**Flowable 原生功能：**
- `startProcessInstanceByKey/ById()` - 启动流程实例
- `startProcessInstanceByMessage()` - 消息启动流程
- `startProcessInstanceWithForm()` - 表单启动流程
- `deleteProcessInstance()` - 删除流程实例
- `suspendProcessInstanceById()` - 挂起流程实例
- `activateProcessInstanceById()` - 激活流程实例
- `trigger()` - 触发等待状态
- `signalEventReceived()` - 信号事件接收
- `messageEventReceived()` - 消息事件接收
- 变量管理（get/set/remove变量）
- 身份链接管理（addUserIdentityLink等）
- 执行查询（ExecutionQuery）
- 活动实例查询（ActivityInstanceQuery）
- 事件订阅管理
- 流程实例迁移（ProcessMigrationService）
- 多实例执行管理
- Ad-hoc子流程支持
- 条件事件评估
- DataObject支持

**NestJS 设计覆盖情况：**
| 功能 | 覆盖状态 | 备注 |
|------|---------|------|
| 启动流程实例 | ✅ 已覆盖 | 支持多种启动方式 |
| 删除流程实例 | ✅ 已覆盖 | 支持删除原因 |
| 挂起/激活 | ✅ 已覆盖 | 基本功能完整 |
| 信号/消息事件 | ⚠️ 部分覆盖 | 缺少异步事件处理 |
| 变量管理 | ✅ 已覆盖 | VariableService |
| 身份链接 | ⚠️ 部分覆盖 | 缺少Participant管理 |
| 执行查询 | ✅ 已覆盖 | ExecutionService |
| 活动实例查询 | ⚠️ 部分覆盖 | 缺少ActivityInstance |
| 事件订阅 | ✅ 已覆盖 | EventSubscriptionService |
| 流程迁移 | ❌ 未覆盖 | 无迁移功能 |
| 多实例管理 | ❌ 未覆盖 | 缺少addMultiInstanceExecution |
| Ad-hoc子流程 | ❌ 未覆盖 | 未设计 |
| 条件事件评估 | ❌ 未覆盖 | evaluateConditionalEvents |
| DataObject | ❌ 未覆盖 | 未设计 |

---

#### 1.2.3 TaskService（任务服务）

**Flowable 原生功能：**
- 任务查询（TaskQuery）
- 任务认领（claim）
- 任务完成（complete）
- 任务委托（delegate）
- 任务转办（setAssignee）
- 任务归还（setOwner）
- 任务挂起/激活
- 子任务管理
- 附件管理（Attachment）
- 评论管理（Comment）
- 事件记录（Event）
- 候选用户/组管理
- 任务变量管理
- 任务优先级
- 任务到期日
- 任务表单

**NestJS 设计覆盖情况：**
| 功能 | 覆盖状态 | 备注 |
|------|---------|------|
| 任务查询 | ✅ 已覆盖 | TaskService完整 |
| 认领/完成 | ✅ 已覆盖 | 基本功能完整 |
| 委托/转办 | ✅ 已覆盖 | delegate功能 |
| 候选人管理 | ⭐✅ 已覆盖 | IdentityLinkModule已设计 |
| 任务变量 | ✅ 已覆盖 | 支持局部变量 |
| 优先级/到期日 | ✅ 已覆盖 | 实体字段完整 |
| 子任务 | ❌ 未覆盖 | parentTaskId未实现 |
| 附件管理 | ⭐✅ 已覆盖 | ContentModule已设计 |
| 评论管理 | ⭐✅ 已覆盖 | CommentModule已设计 |
| 事件记录 | ❌ 未覆盖 | Event未设计 |
| 任务表单 | ⚠️ 部分覆盖 | formKey存在但功能不完整 |
| 任务状态 | ⚠️ 部分覆盖 | 缺少IN_PROGRESS等状态 |
| ⭐任务驳回 | ⭐✅ 已覆盖 | TaskRejectModule已设计 |
| ⭐任务抄送 | ⭐✅ 已覆盖 | CcModule已设计 |
| ⭐退回策略 | ⭐✅ 已覆盖 | RejectStrategyModule已设计 |

---

#### 1.2.4 HistoryService（历史服务）

**Flowable 原生功能：**
- 历史流程实例查询
- 历史任务实例查询
- 历史活动实例查询
- 历史变量查询
- 历史详情查询
- 历史表单属性查询
- 流程实例历史日志
- 历史任务日志条目

**NestJS 设计覆盖情况：**
| 功能 | 覆盖状态 | 备注 |
|------|---------|------|
| 历史流程实例 | ✅ 已覆盖 | HistoricProcessInstance |
| 历史任务 | ✅ 已覆盖 | HistoricTaskInstance |
| 历史活动 | ⚠️ 部分覆盖 | 缺少完整活动历史 |
| 历史变量 | ✅ 已覆盖 | HistoricVariableInstance |
| 历史详情 | ❌ 未覆盖 | HistoricDetail未设计 |
| 表单属性历史 | ❌ 未覆盖 | 未设计 |
| 历史日志 | ❌ 未覆盖 | ProcessInstanceHistoryLog |
| 任务日志条目 | ❌ 未覆盖 | HistoricTaskLogEntry |

---

### 1.3 独立服务API分析

#### 1.3.1 VariableService（变量服务）

**Flowable 原生功能：**
- VariableScope接口 - 变量作用域
- VariableType - 变量类型系统
- VariableInstance - 变量实例
- HistoricVariableInstance - 历史变量
- 支持多种变量类型（String, Integer, Long, Double, Boolean, Date, Binary, Json, etc.）

**NestJS 设计覆盖情况：**
| 功能 | 覆盖状态 | 备注 |
|------|---------|------|
| 变量作用域 | ✅ 已覆盖 | 支持局部/全局变量 |
| 变量类型 | ⚠️ 部分覆盖 | 缺少完整类型系统 |
| 变量实例 | ✅ 已覆盖 | VariableService |
| 历史变量 | ✅ 已覆盖 | 基本功能完整 |
| Json变量 | ✅ 已覆盖 | 使用JSON类型 |
| 二进制变量 | ❌ 未覆盖 | 缺少Binary支持 |

---

#### 1.3.2 IdentityLinkService（身份链接服务）

**Flowable 原生功能：**
- IdentityLink类型（candidate, assignee, owner, participant, starter等）
- 用户身份链接
- 组身份链接
- 历史身份链接

**NestJS 设计覆盖情况：**
| 功能 | 覆盖状态 | 备注 |
|------|---------|------|
| 候选用户/组 | ⭐✅ 已覆盖 | IdentityLinkModule已设计 |
| 身份链接类型 | ⭐✅ 已覆盖 | IdentityLink实体已设计 |
| 参与者管理 | ⭐✅ 已覆盖 | 支持participant类型 |
| 历史身份链接 | ⭐✅ 已覆盖 | HistoricIdentityLink已设计 |

---

#### 1.3.3 EventSubscriptionService（事件订阅服务）

**Flowable 原生功能：**
- EventSubscription查询
- 信号订阅
- 消息订阅
- 定时器订阅
- 条件事件订阅

**NestJS 设计覆盖情况：**
| 功能 | 覆盖状态 | 备注 |
|------|---------|------|
| 事件订阅查询 | ✅ 已覆盖 | EventSubscriptionService |
| 信号/消息订阅 | ✅ 已覆盖 | 基本功能完整 |
| 定时器订阅 | ⚠️ 部分覆盖 | Timer实体存在但功能不完整 |
| 条件事件 | ❌ 未覆盖 | 未设计 |

---

#### 1.3.4 JobService（作业服务）

**Flowable 原生功能：**
- Job查询
- Job执行
- Job重试
- Job删除
- 定时器Job
- 消息Job
- 异步Job

**NestJS 设计覆盖情况：**
| 功能 | 覆盖状态 | 备注 |
|------|---------|------|
| Job查询 | ⭐✅ 已覆盖 | JobModule已设计 |
| Job执行 | ⭐✅ 已覆盖 | JobExecutor已设计 |
| 定时器Job | ⭐✅ 已覆盖 | TimerJob实体已设计 |
| 异步Job | ⭐✅ 已覆盖 | Bull队列集成已设计 |
| Job重试 | ⭐✅ 已覆盖 | 重试机制已设计 |
| 死信队列 | ⭐✅ 已覆盖 | DeadLetterJob已设计 |
| 外部工作者Job | ⭐✅ 已覆盖 | ExternalWorkerJob已设计 |

---

## 二、功能差异详细分析

### 2.1 核心功能缺失项

#### 2.1.1 流程迁移功能（ProcessMigrationService）

**Flowable 功能：**
```java
ProcessInstanceMigrationBuilder createProcessInstanceMigrationBuilder();
// 支持流程实例从一个版本迁移到另一个版本
// 支持活动节点映射
// 支持批量迁移
```

**NestJS 现状：** 完全缺失

**建议：** 添加 `ProcessMigrationService`，实现流程实例迁移能力

---

#### 2.1.2 多实例执行管理

**Flowable 功能：**
```java
Execution addMultiInstanceExecution(String activityId, String parentExecutionId, Map<String, Object> executionVariables);
void deleteMultiInstanceExecution(String executionId, boolean executionIsCompleted);
```

**NestJS 现状：** 完全缺失

**建议：** 在 `ExecutionService` 中添加多实例执行管理方法

---

#### 2.1.3 Ad-hoc子流程

**Flowable 功能：**
```java
List<Execution> getAdhocSubProcessExecutions(String processInstanceId);
List<FlowNode> getEnabledActivitiesFromAdhocSubProcess(String executionId);
Execution executeActivityInAdhocSubProcess(String executionId, String activityId);
void completeAdhocSubProcess(String executionId);
```

**NestJS 现状：** 完全缺失

**建议：** 如果业务需要Ad-hoc子流程，需要扩展 `ProcessExecutorService`

---

#### 2.1.4 任务附件和评论

**Flowable 功能：**
```java
Attachment createAttachment(String type, String taskId, String processInstanceId, ...);
List<Attachment> getTaskAttachments(String taskId);
Comment addComment(String taskId, String processInstanceId, String message);
List<Comment> getTaskComments(String taskId);
List<Event> getTaskEvents(String taskId);
```

**NestJS 现状：** 完全缺失

**建议：** 添加 `Attachment` 和 `Comment` 实体及相关服务

---

#### 2.1.5 Job服务

**Flowable 功能：**
```java
JobQuery createJobQuery();
void executeJob(String jobId);
void setJobRetries(String jobId, int retries);
void deleteJob(String jobId);
```

**NestJS 现状：** 缺少完整的Job管理服务

**建议：** 
- 添加 `JobService` 和 `Job` 实体
- 实现异步执行器（AsyncExecutor）
- 集成Bull消息队列处理Job

---

### 2.2 实体设计差异

#### 2.2.1 任务候选用户/组

**Flowable 设计：**
- 独立的 `TASK_CANDIDATE_USER` 表
- 独立的 `TASK_CANDIDATE_GROUP` 表
- 支持查询优化

**NestJS 设计：**
- 存储在Task表的 `candidate_users` 和 `candidate_groups` 字段（TEXT类型）
- 缺少独立关联表

**建议：** 创建独立的候选用户/组关联表

```typescript
@Entity('task_candidate_user')
export class TaskCandidateUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id', length: 64 })
  taskId: string;

  @Column({ name: 'user_id', length: 64 })
  userId: string;

  @ManyToOne(() => Task)
  @JoinColumn({ name: 'task_id' })
  task: Task;
}

@Entity('task_candidate_group')
export class TaskCandidateGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id', length: 64 })
  taskId: string;

  @Column({ name: 'group_id', length: 64 })
  groupId: string;

  @ManyToOne(() => Task)
  @JoinColumn({ name: 'task_id' })
  task: Task;
}
```

---

#### 2.2.2 身份链接（IdentityLink）

**Flowable 设计：**
- 独立的 `ACT_RU_IDENTITYLINK` 表
- 支持多种链接类型（candidate, assignee, owner, participant, starter）
- 关联流程定义、流程实例、任务

**NestJS 设计：**
- 缺少独立的IdentityLink实体
- 身份信息分散在各表中

**建议：** 添加 `IdentityLink` 实体

```typescript
@Entity('identity_link')
export class IdentityLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'type', length: 64 })
  type: string; // candidate, assignee, owner, participant, starter

  @Column({ name: 'user_id', length: 64, nullable: true })
  userId: string;

  @Column({ name: 'group_id', length: 64, nullable: true })
  groupId: string;

  @Column({ name: 'task_id', length: 64, nullable: true })
  taskId: string;

  @Column({ name: 'process_instance_id', length: 64, nullable: true })
  processInstanceId: string;

  @Column({ name: 'process_definition_id', length: 64, nullable: true })
  processDefinitionId: string;
}
```

---

#### 2.2.3 任务状态

**Flowable 任务状态：**
```java
String CREATED = "created";
String CLAIMED = "claimed";
String IN_PROGRESS = "inProgress";
String SUSPENDED = "suspended";
String COMPLETED = "completed";
String TERMINATED = "terminated";
```

**NestJS 任务状态：**
```typescript
export enum TaskStatus {
  CREATED = 'CREATED',
  CLAIMED = 'CLAIMED',
  ASSIGNED = 'ASSIGNED',
  COMPLETED = 'COMPLETED',
  DELEGATED = 'DELEGATED',
  DELETED = 'DELETED',
}
```

**差异分析：**
- 缺少 `IN_PROGRESS` 状态（任务进行中）
- 缺少 `SUSPENDED` 状态（任务挂起）
- 缺少 `TERMINATED` 状态（任务终止）

**建议：** 扩展TaskStatus枚举

---

### 2.3 API设计差异

#### 2.3.1 Builder模式

**Flowable 设计：**
```java
// 使用Builder模式创建复杂操作
ProcessInstanceBuilder createProcessInstanceBuilder();
ChangeActivityStateBuilder createChangeActivityStateBuilder();
TaskBuilder createTaskBuilder();
DeploymentBuilder createDeployment();
```

**NestJS 设计：**
- 主要使用DTO对象传递参数
- 缺少Builder模式的链式调用

**建议：** 引入Builder模式提供更灵活的API

```typescript
// 示例：ProcessInstanceBuilder
class ProcessInstanceBuilder {
  private processDefinitionKey: string;
  private businessKey: string;
  private variables: Map<string, any> = new Map();

  processDefinitionKey(key: string): this {
    this.processDefinitionKey = key;
    return this;
  }

  businessKey(key: string): this {
    this.businessKey = key;
    return this;
  }

  variable(name: string, value: any): this {
    this.variables.set(name, value);
    return this;
  }

  async start(): Promise<ProcessInstance> {
    // 启动流程实例
  }
}
```

---

#### 2.3.2 NativeQuery支持

**Flowable 设计：**
```java
// 支持原生SQL查询
NativeProcessInstanceQuery createNativeProcessInstanceQuery();
NativeTaskQuery createNativeTaskQuery();
```

**NestJS 设计：**
- 使用TypeORM的QueryBuilder
- 缺少统一的原生查询接口

**建议：** 提供统一的原生查询能力

---

## 三、优化建议

### 3.1 高优先级（P0）

| 序号 | 功能 | 说明 | 工作量 |
|------|------|------|--------|
| 1 | JobService | 添加Job服务和异步执行器 | 高 |
| 2 | IdentityLink实体 | 添加独立身份链接表 | 中 |
| 3 | TaskCandidate实体 | 添加独立候选用户/组表 | 中 |
| 4 | 任务状态扩展 | 添加IN_PROGRESS、SUSPENDED状态 | 低 |
| 5 | 附件和评论 | 添加Attachment和Comment功能 | 中 |

### 3.2 中优先级（P1）

| 序号 | 功能 | 说明 | 工作量 |
|------|------|------|--------|
| 1 | ProcessMigrationService | 流程实例迁移 | 高 |
| 2 | 多实例执行管理 | 动态添加/删除多实例执行 | 中 |
| 3 | Builder模式 | 引入Builder模式API | 中 |
| 4 | 历史详情 | 添加HistoricDetail功能 | 中 |
| 5 | 条件事件评估 | evaluateConditionalEvents | 中 |

### 3.3 低优先级（P2）

| 序号 | 功能 | 说明 | 工作量 |
|------|------|------|--------|
| 1 | Ad-hoc子流程 | Ad-hoc子流程支持 | 高 |
| 2 | Model管理 | 流程模型管理功能 | 中 |
| 3 | DataObject | 数据对象支持 | 中 |
| 4 | NativeQuery | 原生查询接口 | 低 |
| 5 | 流程定义候选人 | 流程定义级别的候选人管理 | 低 |

---

## 四、数据库表补充建议

### 4.1 需要新增的表

```sql
-- 任务候选用户表
CREATE TABLE task_candidate_user (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  create_time DATETIME NOT NULL,
  INDEX idx_task_id (task_id),
  INDEX idx_user_id (user_id)
);

-- 任务候选组表
CREATE TABLE task_candidate_group (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  group_id VARCHAR(64) NOT NULL,
  create_time DATETIME NOT NULL,
  INDEX idx_task_id (task_id),
  INDEX idx_group_id (group_id)
);

-- 身份链接表
CREATE TABLE identity_link (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(64) NOT NULL,
  user_id VARCHAR(64),
  group_id VARCHAR(64),
  task_id VARCHAR(64),
  process_instance_id VARCHAR(64),
  process_definition_id VARCHAR(64),
  create_time DATETIME NOT NULL,
  INDEX idx_task_id (task_id),
  INDEX idx_process_instance_id (process_instance_id),
  INDEX idx_user_id (user_id),
  INDEX idx_group_id (group_id)
);

-- 作业表
CREATE TABLE job (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(64) NOT NULL,
  process_instance_id VARCHAR(64),
  execution_id VARCHAR(64),
  task_id VARCHAR(64),
  due_date DATETIME,
  retries INT DEFAULT 3,
  status VARCHAR(20) NOT NULL,
  config TEXT,
  exception_message TEXT,
  create_time DATETIME NOT NULL,
  INDEX idx_process_instance_id (process_instance_id),
  INDEX idx_due_date (due_date),
  INDEX idx_status (status)
);

-- 附件表
CREATE TABLE attachment (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64),
  process_instance_id VARCHAR(64),
  type VARCHAR(64),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  url VARCHAR(512),
  content LONGBLOB,
  user_id VARCHAR(64),
  create_time DATETIME NOT NULL,
  INDEX idx_task_id (task_id),
  INDEX idx_process_instance_id (process_instance_id)
);

-- 评论表
CREATE TABLE comment (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64),
  process_instance_id VARCHAR(64),
  type VARCHAR(64),
  message TEXT NOT NULL,
  user_id VARCHAR(64),
  create_time DATETIME NOT NULL,
  INDEX idx_task_id (task_id),
  INDEX idx_process_instance_id (process_instance_id)
);

-- 历史详情表
CREATE TABLE historic_detail (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(64) NOT NULL,
  process_instance_id VARCHAR(64),
  task_id VARCHAR(64),
  activity_instance_id VARCHAR(64),
  name VARCHAR(255),
  value TEXT,
  variable_type VARCHAR(64),
  create_time DATETIME NOT NULL,
  INDEX idx_process_instance_id (process_instance_id),
  INDEX idx_task_id (task_id)
);

-- 流程模型表
CREATE TABLE model (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  key VARCHAR(255) NOT NULL,
  category VARCHAR(255),
  version INT DEFAULT 1,
  meta_info TEXT,
  deployment_id VARCHAR(64),
  editor_source_value_id VARCHAR(64),
  editor_source_extra_value_id VARCHAR(64),
  tenant_id VARCHAR(64),
  create_time DATETIME NOT NULL,
  update_time DATETIME,
  INDEX idx_key (key),
  INDEX idx_deployment_id (deployment_id)
);
```

---

## 五、总结

### 5.1 当前设计覆盖率评估

| 模块 | 覆盖率 | 说明 |
|------|--------|------|
| RepositoryService | 85% | 核心功能完整，⭐DMN关联已设计 |
| RuntimeService | 75% | 核心功能完整，缺少迁移和高级功能 |
| TaskService | 90% | ⭐附件/评论/驳回/抄送/退回策略已设计 |
| HistoryService | 70% | ⭐历史身份链接已设计，缺少详情和日志 |
| IdentityService | 80% | 功能相对完整 |
| FormService | 50% | 基本功能，缺少完整表单引擎 |
| EventSubscription | 80% | ⭐完整事件订阅已设计 |
| JobService | 90% | ⭐JobModule已完整设计（Job/TimerJob/DeadLetterJob/ExternalWorkerJob） |
| VariableService | 75% | 基本功能完整 |
| IdentityLinkService | 90% | ⭐IdentityLinkModule已完整设计 |
| ⭐DMN决策引擎 | 85% | ⭐DmnModule已完整设计（决策表/规则引擎/命中策略/Business Rule Task） |
| ⭐任务操作 | 95% | ⭐驳回/抄送/退回策略/多人退回策略已设计 |
| ⭐批处理 | 80% | ⭐BatchModule已设计 |
| ⭐内容服务 | 75% | ⭐ContentModule已设计 |
| ⭐评论服务 | 75% | ⭐CommentModule已设计 |

**总体覆盖率：约 85%** ⭐（原65%）

### 5.2 新增模块覆盖情况 ⭐

基于新增的设计文档（04-任务操作补充设计.md、05-DMN决策引擎设计.md），以下功能已纳入设计：

| 新增模块 | 覆盖功能 | 设计文档 |
|---------|---------|---------|
| TaskRejectModule | 任务驳回（退回/驳回/拒绝） | 04-任务操作补充设计.md |
| CcModule | 抄送服务（手动/自动抄送） | 04-任务操作补充设计.md |
| RejectStrategyModule | 退回策略（上一节点/发起人/指定节点） | 04-任务操作补充设计.md |
| MultiInstanceRejectModule | 多人退回策略（全部/仅当前/多数人） | 04-任务操作补充设计.md |
| DmnModule | DMN决策引擎（决策表/规则引擎/命中策略） | 05-DMN决策引擎设计.md |
| JobModule | 作业服务（定时器/消息/外部工作者/死信队列） | 06-NestJS开发计划.md |
| IdentityLinkModule | 身份链接（候选人/组/参与者） | 06-NestJS开发计划.md |
| BatchModule | 批处理（批量迁移/批量删除） | 06-NestJS开发计划.md |
| ContentModule | 内容服务（附件/存储） | 06-NestJS开发计划.md |
| CommentModule | 评论服务（流程/任务评论） | 06-NestJS开发计划.md |

### 5.2 建议实施路径

1. **第一阶段（1-2周）**：完善核心实体
   - 添加IdentityLink实体
   - 添加TaskCandidateUser/Group实体
   - 扩展TaskStatus枚举

2. **第二阶段（2-3周）**：添加Job服务
   - 实现Job实体和JobService
   - 集成Bull消息队列
   - 实现异步执行器

3. **第三阶段（1-2周）**：添加附件和评论
   - 实现Attachment实体和服务
   - 实现Comment实体和服务

4. **第四阶段（2-3周）**：高级功能
   - 流程迁移服务
   - 多实例执行管理
   - Builder模式API

### 5.3 风险提示

1. **兼容性风险**：新增表和字段需要考虑与现有数据的兼容
2. **性能风险**：异步执行器和Job服务需要充分测试
3. **复杂度风险**：流程迁移等高级功能实现复杂度较高

---

## 附录：参考文档

- Flowable 7.0.0 源码：`modules/` 目录
- NestJS 设计文档：`new-docs2/01-核心功能梳理.md`
- 技术设计文档：`new-docs2/02-技术设计文档.md`
- 实现方案文档：`new-docs2/03-实现方案文档.md`
