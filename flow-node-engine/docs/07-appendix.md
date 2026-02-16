# 附录

本章节提供常见问题解答、术语表、变更日志和贡献指南。

---

## 常见问题（FAQ）

### 1. 通用问题

#### Q1: flow-node-engine 是什么？

flow-node-engine 是一个基于 Node.js + NestJS + MySQL 实现的 BPMN 流程引擎，完全兼容 Flowable 的核心功能，使用 TypeScript 开发，提供完整的类型支持和现代化的开发体验。

#### Q2: 为什么选择 flow-node-engine？

- **技术栈统一**：使用 TypeScript/NestJS，与前端技术栈一致
- **轻量部署**：相比 Java，Node.js 资源消耗更低
- **现代架构**：采用 NestJS 模块化设计
- **功能完整**：支持 BPMN 2.0、DMN 1.3 核心功能
- **扩展性强**：支持自定义节点、监听器、表达式

#### Q3: flow-node-engine 与 Flowable 有什么区别？

| 特性 | flow-node-engine | Flowable |
|------|-----------------|----------|
| 语言 | TypeScript | Java |
| 框架 | NestJS | Spring |
| 数据库 | MySQL + TypeORM | MyBatis |
| 部署 | 更轻量 | 需要 Java 容器 |
| 功能覆盖 | ~65% | 100% |

#### Q4: 支持哪些数据库？

目前支持 MySQL 8.0+。理论上通过 TypeORM 可以支持 PostgreSQL、SQL Server 等数据库，但目前主要针对 MySQL 进行优化。

#### Q5: 如何获取帮助？

- 提交 GitHub Issue
- 查看文档
- 参与社区讨论

---

### 2. 使用问题

#### Q6: 如何部署流程定义？

```bash
# 使用 REST API
curl -X POST 'http://localhost:3000/api/v1/process-definitions/deploy' \
  -F 'file=@/path/to/process.bpmn'
```

#### Q7: 如何设置任务处理人？

有多种方式：

1. **静态分配**：在 BPMN 中直接指定
```xml
<userTask id="Task_1" flowable:assignee="zhangsan" />
```

2. **表达式分配**：使用 UEL 表达式
```xml
<userTask id="Task_1" flowable:assignee="${initiator}" />
```

3. **候选用户/组**
```xml
<userTask id="Task_1" flowable:candidateUsers="user1,user2" flowable:candidateGroups="manager" />
```

4. **动态分配**：通过监听器
```typescript
taskListener.onEvent = (task) => {
  task.assignee = 'zhangsan';
};
```

#### Q8: 如何实现会签/或签？

- **或签**：添加多个候选用户，任意一人处理即可
- **会签**：使用并行多实例，设置完成条件

#### Q9: 如何实现驳回功能？

flow-node-engine 提供了增强的驳回功能：

```typescript
// 驳回到指定节点
await taskRejectService.rejectToStep({
  taskId: 'taskId',
  targetActivityId: 'Task_Submit',
});
```

#### Q10: 流程变量在哪里查看？

```bash
# 获取流程实例变量
GET /api/v1/process-instances/{id}/variables

# 获取任务变量
GET /api/v1/tasks/{id}/variables
```

---

### 3. 开发问题

#### Q11: 如何添加自定义节点？

参考 [二次开发指南 - 扩展自定义节点类型](./06-development.md#1-扩展自定义节点类型)

#### Q12: 如何编写自定义监听器？

参考 [二次开发指南 - 添加自定义监听器](./06-development.md#2-添加自定义监听器)

#### Q13: 如何扩展表达式函数？

参考 [二次开发指南 - 扩展表达式函数](./06-development.md#3-扩展表达式函数)

#### Q14: 测试如何运行？

```bash
# 单元测试
pnpm test

# 集成测试
pnpm test:integration

# E2E 测试
pnpm test:e2e
```

---

### 4. 运维问题

#### Q15: 如何配置生产环境？

1. 修改环境变量：
```env
NODE_ENV=production
LOG_LEVEL=warn
```

2. 使用生产级数据库配置：
```env
DB_HOST=prod-db-host
DB_PASSWORD=strong-password
```

3. 启用缓存：
```env
CACHE_ENABLED=true
```

#### Q16: 如何进行性能优化？

1. 启用缓存
2. 添加数据库索引
3. 使用读写分离
4. 配置历史数据清理

#### Q17: 历史数据如何清理？

```typescript
await historyService.cleanHistory({
  olderThan: new Date('2023-01-01'),
  batchSize: 1000,
});
```

#### Q18: 如何监控流程引擎？

项目提供了 Prometheus 指标端点：

```
GET /metrics
```

---

## 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 流程定义 | Process Definition | 对业务流程的模型描述 |
| 流程实例 | Process Instance | 流程定义的执行实例 |
| 执行 | Execution | 流程执行的路径实例 |
| 任务 | Task | 需要人工处理的工作项 |
| 用户任务 | User Task | 需要用户处理的任务 |
| 服务任务 | Service Task | 自动执行的任务 |
| 网关 | Gateway | 控制流程流转方向 |
| 排他网关 | Exclusive Gateway | 条件为真时选择一条路径 |
| 并行网关 | Parallel Gateway | 并行执行多条路径 |
| 包容网关 | Inclusive Gateway | 满足条件的路径都执行 |
| 子流程 | Sub Process | 嵌套的流程 |
| 调用活动 | Call Activity | 调用外部流程 |
| 多实例 | Multi Instance | 重复执行的任务 |
| 监听器 | Listener | 事件触发时执行的逻辑 |
| 表达式 | Expression | 动态计算值的语法 |
| 变量 | Variable | 流程中存储的数据 |
| 身份链接 | Identity Link | 用户/组与任务的关系 |
| 业务Key | Business Key | 关联业务数据的标识 |
| DMN | Decision Model and Notation | 决策模型与标记 |
| BPMN | Business Process Model and Notation | 业务流程模型与标记 |
| FEEL | Friendly Enough Expression Language | DMN 表达式语言 |

---

## 变更日志

### v1.0.0 (2024-xx-xx)

#### 新增功能

- **BPMN 流程引擎**
  - 流程定义管理（部署、激活、挂起）
  - 流程实例管理（启动、终止、变量）
  - 用户任务、服务任务、脚本任务
  - 排他网关、并行网关、包容网关
  - 子流程、调用活动、事件子流程
  - 表达式求值（UEL）

- **DMN 决策引擎**
  - 决策表执行
  - 8 种命中策略
  - FEEL 表达式支持
  - 聚合函数

- **任务服务**
  - 任务 CRUD
  - 认领、完成、委派、转办
  - 候选用户/组
  - 任务驳回（增强功能）
  - 任务抄送

- **历史服务**
  - 流程历史
  - 任务历史
  - 变量历史

- **表单引擎**
  - 动态表单
  - 表单验证

- **扩展功能**
  - 评论服务
  - 通知服务
  - 进度跟踪
  - 批处理
  - 内容管理

#### 技术更新

- NestJS 11.x
- TypeScript 5.x
- TypeORM 0.3.x
- Vitest 测试框架
- Redis 缓存支持

---

## 贡献指南

### 欢迎贡献

感谢你对 flow-node-engine 项目的兴趣！我们欢迎任何形式的贡献，包括但不限于：

- 提交 Bug 报告
- 提交功能请求
- 提交代码改进
- 完善文档
- 分享使用经验

### 开发环境设置

```bash
# 1. 克隆项目
git clone https://github.com/your-repo/flow-node-engine.git
cd flow-node-engine/flow-node-engine

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env

# 4. 运行测试
pnpm test
```

### 提交规范

#### 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（type）**：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具

**示例**：

```
feat(task): 添加任务批量完成功能

- 支持批量选择任务
- 支持批量审批通过/驳回
- 优化数据库查询性能

Closes #123
```

### 代码规范

- 遵循 ESLint 配置
- 使用 Prettier 格式化
- 保持代码简洁易懂
- 添加必要的注释
- 编写单元测试

### Pull Request 流程

1. Fork 项目
2. 创建功能分支：`git checkout -b feature/xxx`
3. 提交更改：`git commit -m 'feat: xxx'`
4. 推送分支：`git push origin feature/xxx`
5. 创建 Pull Request

### 代码审查标准

- 代码功能正确性
- 代码可读性和可维护性
- 是否有测试覆盖
- 是否符合项目规范

### 行为准则

- 尊重他人，保持友好
- 接受建设性批评
- 关注社区利益
- 避免利益冲突

---

## 联系方式

### 联系方式

- **GitHub**: https://github.com/your-repo/flow-node-engine
- **问题反馈**: https://github.com/your-repo/flow-node-engine/issues
- **讨论交流**: https://github.com/your-repo/flow-node-engine/discussions

### 商务合作

如有商务合作需求，请联系项目维护团队。

---

## 参考资源

### 官方文档

- [BPMN 2.0 规范](https://www.omg.org/spec/BPMN/2.0/)
- [DMN 1.3 规范](https://www.omg.org/spec/DMN/1.3/)
- [NestJS 文档](https://docs.nestjs.com/)
- [TypeORM 文档](https://typeorm.io/)

### 相关项目

- [Flowable](https://flowable.com/) - Java 版流程引擎
- [bpmn-js](https://bpmn.io/) - BPMN 建模库
- [camunda-bpmn-moddle](https://github.com/camunda/camunda-bpmn-moddle) - BPMN 元模型
