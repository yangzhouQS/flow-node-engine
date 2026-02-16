# 场景示例

本章节通过具体的业务场景，展示 flow-node-engine 的实际应用方法。

---

## 基础场景示例

### 场景1：简单的请假审批流程

#### 场景描述

公司员工需要请假，需要经过直接主管审批。流程如下：

1. 员工提交请假申请
2. 主管审批
3. 审批通过/驳回

#### 流程定义

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  
  <bpmn:process id="SimpleLeaveApproval" name="简单请假审批" isExecutable="true">
    <!-- 开始 -->
    <bpmn:startEvent id="StartEvent_1" name="开始">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    
    <!-- 提交申请 -->
    <bpmn:userTask id="Task_Submit" name="提交请假申请" flowable:assignee="${initiator}">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    
    <!-- 主管审批 -->
    <bpmn:userTask id="Task_Approve" name="主管审批" flowable:candidateGroups="manager">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:userTask>
    
    <!-- 结束 -->
    <bpmn:endEvent id="EndEvent_1" name="结束">
      <bpmn:incoming>Flow_3</bpmn:incoming>
    </bpmn:endEvent>
    
    <!-- 连线 -->
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_Submit" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_Submit" targetRef="Task_Approve" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_Approve" targetRef="EndEvent_1" />
  </bpmn:process>
</bpmn:definitions>
```

#### 启动流程

```bash
curl -X POST 'http://localhost:3000/api/v1/process-instances' \
  -H 'Content-Type: application/json' \
  -d '{
    "processDefinitionKey": "SimpleLeaveApproval",
    "businessKey": "LEAVE-001",
    "variables": {
      "days": 3,
      "reason": "家中有事"
    },
    "initiator": "zhangsan"
  }'
```

#### 处理任务

```bash
# 1. 提交申请（张三）
curl -X POST 'http://localhost:3000/api/v1/tasks/{taskId}/complete' \
  -H 'Content-Type: application/json' \
  -d '{
    "variables": {
      "days": 3,
      "reason": "家中有事"
    }
  }'

# 2. 主管审批（李四）
curl -X POST 'http://localhost:3000/api/v1/tasks/{taskId}/claim' \
  -H 'Content-Type: application/json' \
  -d '{"userId": "lisi"}'

curl -X POST 'http://localhost:3000/api/v1/tasks/{taskId}/complete' \
  -H 'Content-Type: application/json' \
  -d '{
    "variables": {
      "approved": true
    }
  }'
```

---

### 场景2：使用 DMN 决策表确定审批人

#### 场景描述

根据请假天数和部门，自动确定审批人：

- 请假天数 ≤ 3：由直接主管审批
- 请假天数 > 3：由部门经理审批

#### DMN 决策表

```xml
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             id="decision_approver"
             name="确定审批人"
             namespace="http://flowable.org/decisiontable">
  
  <decision id="approver" name="审批人决策">
    <decisionTable>
      <input label="请假天数">
        <inputExpression id="input1" typeRef="integer">
          <text>days</text>
        </inputExpression>
      </input>
      <output id="output1" label="审批人" typeRef="string"/>
      <rule>
        <inputEntry id="UnaryTests_1">
          <text><= 3</text>
        </inputEntry>
        <outputEntry id="LiteralExpression_1">
          <text>"direct_manager"</text>
        </outputEntry>
      </rule>
      <rule>
        <inputEntry id="UnaryTests_2">
          <text>> 3</text>
        </inputEntry>
        <outputEntry id="LiteralExpression_2">
          <text>"department_manager"</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>
```

#### 流程定义（集成 DMN）

```xml
<userTask id="Task_Approve" name="审批">
  <bpmn:incoming>Flow_1</bpmn:incoming>
  <bpmn:outgoing>Flow_2</bpmn:outgoing>
  <bpmn:multiInstanceLoopCharacteristics>
    <bpmn:loopCardinality>1</bpmn:loopCardinality>
  </bpmn:multiInstanceLoopCharacteristics>
  <bpmn:extensionElements>
    <flowable:taskListener event="create">
      <flowable:field name="assignee">
        <flowable:expression>${approverDecisionService.getApprover(days)}</flowable:expression>
      </flowable:field>
    </flowable:taskListener>
  </bpmn:extensionElements>
</userTask>
```

---

### 场景3：并行任务处理

#### 场景描述

某些审批需要多个部门同时审批，所有部门审批完成后流程才能继续。

#### 流程定义

```xml
<!-- 并行网关 -->
<bpmn:parallelGateway id="Gateway_Parallel" name="并行审批">
  <bpmn:incoming>Flow_1</bpmn:incoming>
  <bpmn:outgoing>Flow_Parallel_1</bpmn:outgoing>
  <bpmn:outgoing>Flow_Parallel_2</bpmn:outgoing>
</bpmn:parallelGateway>

<!-- 部门A审批 -->
<bpmn:userTask id="Task_DeptA" name="部门A审批" flowable:candidateGroups="dept_a">
  <bpmn:incoming>Flow_Parallel_1</bpmn:incoming>
  <bpmn:outgoing>Flow_Join_1</bpmn:outgoing>
</bpmn:userTask>

<!-- 部门B审批 -->
<bpmn:userTask id="Task_DeptB" name="部门B审批" flowable:candidateGroups="dept_b">
  <bpmn:incoming>Flow_Parallel_2</bpmn:incoming>
  <bpmn:outgoing>Flow_Join_2</bpmn:outgoing>
</bpmn:userTask>

<!-- 汇聚网关 -->
<bpmn:parallelGateway id="Gateway_Join" name="汇聚">
  <bpmn:incoming>Flow_Join_1</bpmn:incoming>
  <bpmn:incoming>Flow_Join_2</bpmn:incoming>
  <bpmn:outgoing>Flow_End</bpmn:outgoing>
</bpmn:parallelGateway>
```

---

## 进阶场景示例

### 场景4：多层级审批流程

#### 场景描述

根据请假天数确定审批层级：

- 1-3天：直接主管审批
- 4-7天：主管 + 经理审批
- 8天以上：主管 + 经理 + 总监审批

#### 实现方案

使用多实例（Multi-Instance）结合 DMN 决策：

```typescript
// 决策表返回审批层级
const approvers = await this.dmnService.execute({
  decisionKey: 'ApprovalLevelDecision',
  inputVariables: { days: 5 },
});
// 返回: ["manager", "director"]
```

```xml
<!-- 多实例用户任务 -->
<bpmn:userTask id="Task_Approval" name="逐级审批">
  <bpmn:multiInstanceLoopCharacteristics flowable:collection="${approverList}" 
                                          flowable:elementVariable="approver"
                                          isSequential="true">
    <bpmn:loopCardinality>${approverList.size()}</bpmn:loopCardinality>
  </bpmn:multiInstanceLoopCharacteristics>
</bpmn:userTask>
```

---

### 场景5：会签审批（多人审批）

#### 场景描述

一个任务需要多个人共同审批，可以设置：

- **或签**：任意一人审批即可通过
- **会签**：所有人审批才能通过

#### 或签实现

```typescript
// 添加多个候选用户
for (const userId of ['user1', 'user2', 'user3']) {
  await this.taskService.addCandidateUser(taskId, userId);
}

// 任意一人完成即可
await this.taskService.completeTask(taskId, { variables: { approved: true } });
```

#### 会签实现

```xml
<!-- 使用并行多实例 -->
<bpmn:userTask id="Task_Countersign" name="会签审批">
  <bpmn:multiInstanceLoopCharacteristics isSequential="false"
                                          flowable:collection="${candidateUsers}"
                                          flowable:elementVariable="user">
  </bpmn:multiInstanceLoopCharacteristics>
  <!-- 完成条件：有人驳回则全部终止，有人通过则继续等待 -->
  <bpmn:completionCondition>${nrOfCompleted >= nrOfInstances or rejected == true}</bpmn:completionCondition>
</bpmn:userTask>
```

---

### 场景6：动态流程跳转

#### 场景描述

在某些情况下，需要动态调整流程走向，比如：加签、委派到特殊处理人等。

#### 动态修改实现

```typescript
import { DynamicModificationService } from './dynamic-modification.service';

const modificationService = new DynamicModificationService();

// 示例1：跳过某个节点
await modificationService.createProcessModification('processInstanceId')
  .removeActivity('Task_Review')
  .execute();

// 示例2：添加新的审批节点
await modificationService.createProcessModification('processInstanceId')
  .addActivity({
    id: 'Task_SpecialApproval',
    type: 'userTask',
    assignee: 'specialUser',
  }, 'Task_Original')
  .execute();

// 示例3：变更任务处理人
await modificationService.createProcessModification('processInstanceId')
  .changeActivityVariable('Task_Review', 'assignee', 'newUserId')
  .execute();
```

---

### 场景7：子流程调用

#### 场景描述

将常用的审批流程抽取为子流程，供其他流程调用。

#### 主流程定义

```xml
<!-- 调用子流程 -->
<bpmn:callActivity id="CallActivity_SubProcess" 
                    calledElement="SubApprovalProcess"
                    flowable:calledElementBinding="latest"
                    flowable:calledElementTenantId="${tenantId}">
  <bpmn:incoming>Flow_1</bpmn:incoming>
  <bpmn:outgoing>Flow_2</bpmn:outgoing>
  <bpmn:extensionElements>
    <flowable:in source="days" target="days" />
    <flowable:out source="approved" target="approved" />
  </bpmn:extensionElements>
</bpmn:callActivity>
```

#### 子流程定义

```xml
<bpmn:process id="SubApprovalProcess" isExecutable="true">
  <bpmn:startEvent id="StartEvent_1">
    <bpmn:outgoing>Flow_1</bpmn:outgoing>
  </bpmn:startEvent>
  
  <bpmn:userTask id="Task_SubApprove" name="子流程审批">
    <bpmn:incoming>Flow_1</bpmn:incoming>
    <bpmn:outgoing>Flow_2</bpmn:outgoing>
  </bpmn:userTask>
  
  <bpmn:endEvent id="EndEvent_1">
    <bpmn:incoming>Flow_2</bpmn:incoming>
  </bpmn:endEvent>
</bpmn:process>
```

---

### 场景8：补偿机制

#### 场景描述

当流程执行失败时，需要回滚已经执行的操作。

#### 场景说明

例如：订单流程中，如果支付失败，需要取消预留库存。

```xml
<!-- 预留库存的服务任务 -->
<bpmn:serviceTask id="Task_ReserveStock" name="预留库存" 
                  flowable:class="ReserveStockHandler">
  <bpmn:incoming>Flow_1</bpmn:incoming>
  <bpmn:outgoing>Flow_2</bpmn:outgoing>
</bpmn:serviceTask>

<!-- 补偿边界事件 -->
<bpmn:boundaryEvent id="CompensateStock" 
                     attachedToRef="Task_ReserveStock"
                     cancelActivity="true">
  <bpmn:compensateEventDefinition />
</bpmn:boundaryEvent>

<!-- 补偿处理器 -->
<bpmn:serviceTask id="Task_ReleaseStock" name="释放库存"
                  isForCompensation="true"
                  flowable:class="ReleaseStockHandler">
  <bpmn:incoming>Flow_Compensate</bpmn:incoming>
  <bpmn:outgoing>Flow_End</bpmn:outgoing>
</bpmn:serviceTask>
```

```typescript
@Injectable()
export class ReserveStockHandler implements JavaDelegate {
  async execute(execution: Execution): Promise<void> {
    const orderId = execution.getVariable('orderId');
    const quantity = execution.getVariable('quantity');
    
    // 预留库存
    const reservation = await this.stockService.reserve(orderId, quantity);
    
    // 设置补偿所需的变量
    execution.setVariable('reservationId', reservation.id);
  }
}

@Injectable()
export class ReleaseStockHandler implements JavaDelegate {
  async execute(execution: Execution): Promise<void> {
    const reservationId = execution.getVariable('reservationId');
    
    // 释放预留的库存
    await this.stockService.release(reservationId);
  }
}
```

---

## 常见问题解决方案

### 问题1：任务认领失败

**症状**：`TaskClaimException: The task was not claimed by ...`

**原因**：
1. 任务已经被其他人认领
2. 任务配置了其他处理人

**解决方案**：

```typescript
// 先检查任务状态
const task = await this.taskService.findById('taskId');

if (task.assignee) {
  // 任务已被认领，可以转办
  await this.taskService.transferTask('taskId', task.assignee, 'newUserId');
} else {
  // 任务未被认领，直接认领
  await this.taskService.claimTask('taskId', 'userId');
}
```

---

### 问题2：表达式求值失败

**症状**：`ExpressionException: Unable to resolve expression ...`

**原因**：
1. 表达式语法错误
2. 变量不存在
3. 表达式方法未注册

**解决方案**：

```typescript
// 检查变量是否存在
const variables = await this.variableService.getAll('processInstanceId');
console.log('可用变量:', variables);

// 使用默认值
const value = execution.getVariable('optionalVar') || 'defaultValue';

// 调试表达式
const result = await this.expressionEvaluator.evaluate(
  '${userService.getAssignee(task.id)}',
  execution
);
```

---

### 问题3：流程卡住不动

**症状**：流程启动后，任务没有创建

**可能原因**：
1. 网关条件表达式错误
2. 表达式导致流程走向死路
3. 流程定义有误

**排查方法**：

```typescript
// 1. 查看执行记录
const executions = await this.executionService.findByProcessInstanceId(instanceId);
console.log('当前执行:', executions);

// 2. 查看流程图
const diagram = await this.diagramService.generateDiagram(
  processDefinitionId,
  instanceId
);

// 3. 检查网关条件
const gatewayExec = executions.find(e => e.activityType === 'exclusiveGateway');
if (gatewayExec) {
  // 评估每个条件
  for (const seqFlow of gatewayExec.outgoingFlows) {
    const result = await this.expressionEvaluator.evaluate(
      seqFlow.conditionExpression,
      gatewayExec
    );
    console.log(`条件 ${seqFlow.id}: ${result}`);
  }
}
```

---

### 问题4：高并发下的性能问题

**症状**：流程启动慢，任务查询超时

**解决方案**：

1. **启用缓存**

```typescript
// 在环境变量中启用
CACHE_ENABLED=true
CACHE_TTL=3600
```

2. **优化数据库索引**

```sql
-- 添加必要的索引
CREATE INDEX idx_task_assignee ON task(assignee);
CREATE INDEX idx_task_process_instance ON task(process_instance_id);
CREATE INDEX idx_execution_process_instance ON execution(process_instance_id);
CREATE INDEX idx_variable_execution ON variable(execution_id);
```

3. **使用读写分离**

```typescript
// 配置主从复制
const dataSource = new DataSource({
  type: 'mysql',
  // 主库
  master: {
    host: 'master-host',
    port: 3306,
    username: 'root',
    password: 'password',
    database: 'flow_engine',
  },
  // 从库
  slaves: [
    { host: 'slave1-host', port: 3306 },
    { host: 'slave2-host', port: 3306 },
  ],
  // 读写分离
  autoSlashSlaves: true,
});
```

---

### 问题5：流程历史数据过多

**症状**：数据库查询变慢，历史表数据量巨大

**解决方案**：

1. **配置历史清理策略**

```typescript
// config/flowable.config.ts
export default {
  history: {
    historyEnabled: true,
    historyCleanStrategy: 'full',
    historyRetentionDays: 30,
  },
};
```

2. **手动清理历史数据**

```typescript
// 清理30天前的历史数据
await this.historyService.cleanHistory({
  olderThan: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  batchSize: 1000,
});
```

3. **归档历史数据**

```typescript
// 归档到历史表
await this.historyArchiveService.archive({
  processDefinitionKey: 'OldProcess',
  beforeDate: new Date('2023-01-01'),
});
```
