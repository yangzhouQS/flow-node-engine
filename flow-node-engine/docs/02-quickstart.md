# 快速入门

本章节将帮助你快速上手 flow-node-engine，从环境准备到运行你的第一个流程。

---

## 环境准备

### 系统要求

| 要求 | 最低版本 | 推荐版本 |
|------|----------|----------|
| **Node.js** | 18.x | 20.x LTS |
| **npm/pnpm** | 8.x | 9.x |
| **MySQL** | 8.0 | 8.0+ |
| **Redis** | 6.0 | 7.0+ |

### 依赖项清单

在开始之前，请确保本地开发环境已安装以下软件：

1. **Node.js** - JavaScript 运行时
   ```bash
   # 检查 Node.js 版本
   node --version
   # 输出类似: v20.11.0
   ```

2. **pnpm** - 包管理工具（推荐）
   ```bash
   # 安装 pnpm
   npm install -g pnpm
   
   # 检查 pnpm 版本
   pnpm --version
   ```

3. **MySQL** - 关系型数据库
   ```bash
   # 检查 MySQL 版本
   mysql --version
   ```

4. **Git** - 版本控制工具
   ```bash
   # 检查 Git 版本
   git --version
   ```

---

## 安装部署

### 1. 克隆项目

```bash
git clone https://github.com/your-repo/flow-node-engine.git
cd flow-node-engine/flow-node-engine
```

### 2. 安装依赖

```bash
# 使用 pnpm 安装依赖
pnpm install

# 或使用 npm
npm install
```

### 3. 配置环境变量

项目根目录下提供了环境变量配置文件模板：

```bash
# 复制环境配置模板
cp .env.example .env
```

编辑 `.env` 文件，配置数据库和 Redis 连接信息：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=flow_engine

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# 应用配置
NODE_ENV=development
PORT=3000

# JWT 配置
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

### 4. 初始化数据库

```bash
# 使用 TypeORM 初始化数据库
pnpm run typeorm:init

# 或者手动创建数据库
mysql -u root -p -e "CREATE DATABASE flow_engine CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 5. 启动应用

```bash
# 开发模式（热重载）
pnpm run start:dev

# 或使用 npm
npm run start:dev
```

应用启动成功后，访问以下地址：

- API 地址：`http://localhost:3000`
- Swagger 文档：`http://localhost:3000/api-docs`

---

## 基础示例

下面通过一个完整的示例，展示如何使用 flow-node-engine 创建和部署一个简单的审批流程。

### 示例：员工请假审批流程

#### 1. 定义 BPMN 流程文件

创建一个名为 `leave-approval.bpmn` 的文件：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  
  <bpmn:process id="LeaveApprovalProcess" name="请假审批流程" isExecutable="true">
    <!-- 开始事件 -->
    <bpmn:startEvent id="StartEvent_1" name="开始">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    
    <!-- 用户任务：提交请假申请 -->
    <bpmn:userTask id="Task_SubmitApplication" name="提交请假申请">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    
    <!-- 排他网关：审批决策 -->
    <bpmn:exclusiveGateway id="Gateway_Approval" name="审批是否通过">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_Approved</bpmn:outgoing>
      <bpmn:outgoing>Flow_Rejected</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    
    <!-- 用户任务：主管审批 -->
    <bpmn:userTask id="Task_ManagerApproval" name="主管审批">
      <bpmn:incoming>Flow_Approved</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:userTask>
    
    <!-- 结束事件：审批通过 -->
    <bpmn:endEvent id="EndEvent_Approved" name="审批通过">
      <bpmn:incoming>Flow_3</bpmn:incoming>
    </bpmn:endEvent>
    
    <!-- 结束事件：审批驳回 -->
    <bpmn:endEvent id="EndEvent_Rejected" name="审批驳回">
      <bpmn:incoming>Flow_Rejected</bpmn:incoming>
    </bpmn:endEvent>
    
    <!-- 连线 -->
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_SubmitApplication" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_SubmitApplication" targetRef="Gateway_Approval" />
    <bpmn:sequenceFlow id="Flow_Approved" name="通过" sourceRef="Gateway_Approval" targetRef="Task_ManagerApproval">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        approved = true
      </bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_Rejected" name="驳回" sourceRef="Gateway_Approval" targetRef="EndEvent_Rejected">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        approved = false
      </bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_ManagerApproval" targetRef="EndEvent_Approved" />
    
  </bpmn:process>
  
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="LeaveApprovalProcess">
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
```

#### 2. 部署流程定义

通过 REST API 部署流程：

```bash
curl -X POST 'http://localhost:3000/api/v1/process-definitions/deploy' \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@/path/to/leave-approval.bpmn'
```

或使用 Swagger UI 上传文件。

#### 3. 启动流程实例

```bash
curl -X POST 'http://localhost:3000/api/v1/process-instances' \
  -H 'Content-Type: application/json' \
  -d '{
    "processDefinitionKey": "LeaveApprovalProcess",
    "businessKey": "LEAVE-2024-001",
    "variables": {
      "applicant": "zhangsan",
      "days": 3,
      "reason": "年假"
    }
  }'
```

响应示例：

```json
{
  "code": 0,
  "data": {
    "id": "a1b2c3d4e5f6g7h8i9j0",
    "processDefinitionId": "LeaveApprovalProcess:1:123456",
    "processDefinitionKey": "LeaveApprovalProcess",
    "businessKey": "LEAVE-2024-001",
    "status": "ACTIVE",
    "startTime": "2024-01-15T10:30:00.000Z",
    "variables": {
      "applicant": "zhangsan",
      "days": 3,
      "reason": "年假"
    }
  }
}
```

#### 4. 查询待办任务

```bash
curl -X GET 'http://localhost:3000/api/v1/tasks?processInstanceId=a1b2c3d4e5f6g7h8i9j0' \
  -H 'Authorization: Bearer <your-token>'
```

响应示例：

```json
{
  "code": 0,
  "data": [
    {
      "id": "task-001",
      "name": "提交请假申请",
      "assignee": null,
      "owner": "zhangsan",
      "processInstanceId": "a1b2c3d4e5f6g7h8i9j0",
      "status": "PENDING"
    }
  ]
}
```

#### 5. 认领任务

```bash
curl -X POST 'http://localhost:3000/api/v1/tasks/task-001/claim' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "zhangsan"
  }'
```

#### 6. 完成任务

```bash
curl -X POST 'http://localhost:3000/api/v1/tasks/task-001/complete' \
  -H 'Content-Type: application/json' \
  -d '{
    "variables": {
      "approved": true
    }
  }'
```

#### 7. 查看流程状态

```bash
curl -X GET 'http://localhost:3000/api/v1/process-instances/a1b2c3d4e5f6g7h8i9j0'
```

---

## 常见问题排查

### 问题1：数据库连接失败

**症状**：启动时报错 `ER_ACCESS_DENIED_ERROR`

**解决方案**：
1. 检查 `.env` 文件中的数据库配置是否正确
2. 确认 MySQL 服务是否启动
3. 检查用户名和密码是否正确

```bash
# 测试数据库连接
mysql -u root -p -h localhost
```

### 问题2：端口被占用

**症状**：启动时报错 `EADDRINUSE: address already in use`

**解决方案**：
1. 修改 `.env` 中的 `PORT` 配置
2. 或停止占用端口的进程

```bash
# 查看端口占用
netstat -ano | findstr :3000
# 结束进程
taskkill /PID <进程ID> /F
```

### 问题3：Redis 连接失败

**症状**：启动时报错 `ECONNREFUSED`

**解决方案**：
1. 检查 Redis 服务是否启动
2. 检查 `.env` 中的 Redis 配置

```bash
# 启动 Redis（Windows）
redis-server

# 测试连接
redis-cli ping
```

### 问题4：依赖安装失败

**症状**：安装依赖时报错

**解决方案**：
1. 清理缓存后重试
2. 删除 `node_modules` 和 `pnpm-lock.yaml` 后重新安装

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```
