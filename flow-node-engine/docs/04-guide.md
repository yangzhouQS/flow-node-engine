# 使用指南

本章节详细介绍 flow-node-engine 的核心功能使用方法、API 参考和配置说明。

---

## 核心功能使用详解

### 1. 流程定义管理

#### 1.1 部署流程定义

部署 BPMN 文件创建流程定义：

```typescript
// 方式一：通过 REST API
import { Injectable } from '@nestjs/common';
import { ProcessDefinitionService } from './process-definition.service';

@Injectable()
export class MyService {
  constructor(
    private readonly processDefinitionService: ProcessDefinitionService,
  ) {}

  async deployProcess(file: Express.Multer.File): Promise<Deployment> {
    return this.processDefinitionService.deploy({
      name: '请假审批流程',
      category: 'approval',
      file: file.buffer,
      fileName: file.originalname,
    });
  }
}
```

**REST API**：
```
POST /api/v1/process-definitions/deploy
Content-Type: multipart/form-data
```

#### 1.2 获取流程定义列表

```typescript
const definitions = await this.processDefinitionService.findAll({
  category: 'approval',
  latest: true,
  startable: true,
});
```

**REST API**：
```
GET /api/v1/process-definitions?category=approval&latest=true
```

#### 1.3 激活/挂起流程定义

```typescript
// 挂起流程定义
await this.processDefinitionService.suspend('processDefinitionId');

// 激活流程定义
await this.processDefinitionService.activate('processDefinitionId');
```

### 2. 流程实例管理

#### 2.1 启动流程实例

```typescript
const processInstance = await this.processInstanceService.start({
  processDefinitionKey: 'LeaveApprovalProcess',
  businessKey: 'LEAVE-2024-001',
  variables: {
    applicant: 'zhangsan',
    days: 3,
    reason: '年假',
  },
  initiator: 'admin',
});
```

**REST API**：
```
POST /api/v1/process-instances
Content-Type: application/json

{
  "processDefinitionKey": "LeaveApprovalProcess",
  "businessKey": "LEAVE-2024-001",
  "variables": {
    "applicant": "zhangsan",
    "days": 3,
    "reason": "年假"
  }
}
```

#### 2.2 查询流程实例

```typescript
// 根据ID查询
const instance = await this.processInstanceService.findById('instanceId');

// 根据业务Key查询
const instance = await this.processInstanceService.findByBusinessKey('LEAVE-2024-001');

// 条件查询
const instances = await this.processInstanceService.findAll({
  processDefinitionKey: 'LeaveApprovalProcess',
  startedAfter: new Date('2024-01-01'),
  status: 'ACTIVE',
});
```

#### 2.3 终止流程实例

```typescript
await this.processInstanceService.terminate('instanceId', '主动终止');
```

### 3. 任务管理

#### 3.1 查询待办任务

```typescript
// 查询用户待办任务
const tasks = await this.taskService.findTodoTasks('userId', {
  processDefinitionKey: 'LeaveApprovalProcess',
});

// 查询候选任务
const candidateTasks = await this.taskService.findCandidateTasks('userId');
```

**REST API**：
```
GET /api/v1/tasks?assignee=userId&processDefinitionKey=LeaveApprovalProcess
```

#### 3.2 认领任务

```typescript
await this.taskService.claimTask('taskId', 'userId');
```

**REST API**：
```
POST /api/v1/tasks/{taskId}/claim
Content-Type: application/json

{
  "userId": "user123"
}
```

#### 3.3 完成任务

```typescript
await this.taskService.completeTask('taskId', {
  variables: {
    approved: true,
    comment: '审批通过',
  },
});
```

**REST API**：
```
POST /api/v1/tasks/{taskId}/complete
Content-Type: application/json

{
  "variables": {
    "approved": true,
    "comment": "审批通过"
  }
}
```

#### 3.4 委派任务

```typescript
await this.taskService.delegateTask('taskId', 'fromUserId', 'toUserId');
```

#### 3.5 转办任务

```typescript
await this.taskService.transferTask('taskId', 'fromUserId', 'toUserId');
```

### 4. 任务驳回

flow-node-engine 提供了增强的任务驳回功能，支持多层级驳回。

#### 4.1 驳回到指定节点

```typescript
import { TaskRejectService } from './task-reject.service';

await this.taskRejectService.rejectToStep({
  taskId: 'taskId',
  targetActivityId: 'Task_SubmitApplication',
  variables: {
    rejectReason: '信息不完整',
  },
});
```

#### 4.2 驳回到上一节点

```typescript
await this.taskRejectService.rejectToPreviousStep({
  taskId: 'taskId',
  variables: {
    rejectReason: '需要补充材料',
  },
});
```

#### 4.3 驳回配置

可以为每个任务节点配置允许的驳回目标：

```typescript
// 创建驳回配置
await this.taskRejectService.createRejectConfig({
  processDefinitionId: 'processDefinitionId',
  taskDefinitionKey: 'Task_ManagerApproval',
  rejectTargets: [
    { activityId: 'Task_SubmitApplication', name: '申请人' },
    { activityId: 'Task_ManagerApproval', name: '主管' },
  ],
  defaultTarget: 'Task_SubmitApplication',
});
```

### 5. 任务抄送

支持将任务抄送给其他用户：

#### 5.1 发起抄送

```typescript
import { CcService } from './cc.service';

await this.ccService.createCcRecord({
  taskId: 'taskId',
  ccUsers: ['user1', 'user2'],
  ccReason: '请知悉',
});
```

#### 5.2 查询抄送记录

```typescript
const ccRecords = await this.ccService.findCcRecords('userId');
```

### 6. 监听器使用

#### 6.1 执行监听器

在流程节点执行时触发：

```typescript
// BPMN 中配置
<userTask id="Task_1">
  <extensionElements>
    <flowable:executionListener event="start" class="MyListener" />
    <flowable:executionListener event="end" class="MyListener" />
  </extensionElements>
</userTask>
```

```typescript
// 实现监听器
@Injectable()
export class MyExecutionListener implements ExecutionListener {
  onEvent(execution: Execution): void {
    console.log('节点事件触发:', execution.getCurrentActivityId());
  }
}
```

#### 6.2 任务监听器

在任务状态变更时触发：

```typescript
// BPMN 中配置
<userTask id="Task_1">
  <extensionElements>
    <flowable:taskListener event="create" class="MyTaskListener" />
    <flowable:taskListener event="complete" class="MyTaskListener" />
  </extensionElements>
</userTask>
```

```typescript
// 实现监听器
@Injectable()
export class MyTaskListener implements TaskListener {
  onEvent(task: Task): void {
    console.log('任务事件触发:', task.name);
  }
}
```

### 7. 变量管理

#### 7.1 设置变量

```typescript
// 在流程实例级别设置
await this.variableService.set('processInstanceId', 'variableKey', 'variableValue');

// 在任务级别设置
await this.variableService.setForTask('taskId', 'variableKey', 'variableValue');
```

#### 7.2 获取变量

```typescript
const value = await this.variableService.get('processInstanceId', 'variableKey');

// 获取所有变量
const variables = await this.variableService.getAll('processInstanceId');
```

### 8. 表达式使用

#### 8.1 UEL 表达式

```typescript
// 在 BPMN 中使用
${userService.getAssignee(task.id)}

// 支持的运算
${user.name}
${user.age >= 18}
${'Hello ' + user.name}
```

#### 8.2 FEEL 表达式

```typescript
// 条件表达式
if age >= 18 then "adult" else "minor"

// 区间表达式
date("2024-01-01") in [date("2024-01-01")..date("2024-12-31")]

// 列表操作
sum([1, 2, 3, 4, 5])
```

### 9. DMN 决策服务

#### 9.1 部署决策表

```typescript
const decision = await this.dmnService.deployDecisionTable({
  name: '请假审批规则',
  category: 'approval',
  file: dmnFile.buffer,
});
```

#### 9.2 执行决策

```typescript
const result = await this.dmnService.execute({
  decisionKey: 'LeaveApprovalRule',
  inputVariables: {
    days: 3,
    leaveType: '年假',
    department: '技术部',
  },
});
```

---

## API 参考

### 流程定义 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/process-definitions/deploy` | 部署流程定义 |
| GET | `/api/v1/process-definitions` | 获取流程定义列表 |
| GET | `/api/v1/process-definitions/:id` | 获取流程定义详情 |
| PUT | `/api/v1/process-definitions/:id/suspend` | 挂起流程定义 |
| PUT | `/api/v1/process-definitions/:id/activate` | 激活流程定义 |

### 流程实例 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/process-instances` | 启动流程实例 |
| GET | `/api/v1/process-instances` | 查询流程实例列表 |
| GET | `/api/v1/process-instances/:id` | 获取流程实例详情 |
| DELETE | `/api/v1/process-instances/:id` | 终止流程实例 |
| PUT | `/api/v1/process-instances/:id/suspend` | 挂起流程实例 |
| PUT | `/api/v1/process-instances/:id/resume` | 恢复流程实例 |

### 任务 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/tasks` | 查询任务列表 |
| GET | `/api/v1/tasks/:id` | 获取任务详情 |
| POST | `/api/v1/tasks/:id/claim` | 认领任务 |
| POST | `/api/v1/tasks/:id/unclaim` | 取消认领 |
| POST | `/api/v1/tasks/:id/complete` | 完成任务 |
| POST | `/api/v1/tasks/:id/delegate` | 委派任务 |
| POST | `/api/v1/tasks/:id/transfer` | 转办任务 |
| POST | `/api/v1/tasks/:id/reject` | 驳回任务 |

### 身份管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/identity/users` | 创建用户 |
| GET | `/api/v1/identity/users` | 查询用户列表 |
| POST | `/api/v1/identity/groups` | 创建用户组 |
| POST | `/api/v1/identity/roles` | 创建角色 |

### 历史 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/history/process-instances` | 查询历史流程实例 |
| GET | `/api/v1/history/tasks` | 查询历史任务 |
| GET | `/api/v1/history/variables` | 查询历史变量 |

---

## 配置说明

### 环境变量配置

项目通过环境变量进行配置，主要配置项如下：

```env
# ====================
# 应用基础配置
# ====================
NODE_ENV=development
PORT=3000
APP_NAME=flow-node-engine

# ====================
# 数据库配置
# ====================
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=flow_engine
DB_TYPE=mysql

# ====================
# Redis 配置
# ====================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ====================
# JWT 配置
# ====================
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# ====================
# 日志配置
# ====================
LOG_LEVEL=info
LOG_DIR=./logs
LOG_MAX_FILES=30

# ====================
# 缓存配置
# ====================
CACHE_ENABLED=true
CACHE_TTL=3600

# ====================
# 任务队列配置
# ====================
QUEUE_CONCURRENT=5
QUEUE_MAX_RETRY=3
```

### 配置文件

除环境变量外，还可以通过配置文件进行更细粒度的控制：

```typescript
// config/flowable.config.ts
export default {
  processEngine: {
    // 流程引擎配置
    enableHistory: true,
    historyLevel: 'full',
    enableIncidents: true,
    incidentRetryTimeout: 1800,
  },
  
  jobExecutor: {
    // 作业执行器配置
    asyncExecutorActivate: true,
    jobExecutorActivate: true,
    timerJobAcquirePriority: 50,
    asyncJobAcquirePriority: 50,
  },
  
  task: {
    // 任务配置
    defaultTaskPriority: 50,
    enableTaskLocalVariables: true,
    taskAssigneeNullCheck: true,
  },
  
  history: {
    // 历史配置
    historyEnabled: true,
    historyCleanStrategy: 'full',
    historyRetentionDays: 30,
  },
};
```

### 自定义配置示例

#### 配置自定义数据库连接

```typescript
// app.module.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const typeOrmOptions: TypeOrmModuleOptions = {
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
};
```

#### 配置 Redis 缓存

```typescript
// cache.config.ts
import { CacheModuleOptions } from '@nestjs/cache-manager';

export const cacheConfig: CacheModuleOptions = {
  store: 'redis',
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB) || 0,
  ttl: parseInt(process.env.CACHE_TTL) || 3600,
  max: 100,
};
```

#### 配置日志

```typescript
// logger.config.ts
import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';

export const loggerConfig: WinstonModuleOptions = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, context }) => {
          return `${timestamp} [${context}] ${level}: ${message}`;
        }),
      ),
    }),
    new DailyRotateFile({
      filename: 'logs/%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '100m',
      maxFiles: '30',
    }),
  ],
};
```
