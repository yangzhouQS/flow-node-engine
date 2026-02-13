# DMN 决策引擎项目整体架构分析

## 1. 项目概述

### 1.1 DMN 简介

DMN (Decision Model and Notation) 是 OMG 组织制定的国际标准（DMN 1.1），用于描述和建模业务决策。Flowable DMN 引擎是 Flowable 工作流平台的核心组件之一，提供独立的决策引擎功能。

**核心价值：**
- 将业务规则从代码中分离，实现可视化配置
- 支持动态修改决策表，无需重新部署应用
- 提供完整的决策执行审计追踪
- 与 BPMN 流程引擎无缝集成，支持 Business Rule Task

### 1.2 设计哲学

Flowable DMN 引擎遵循以下设计原则：

1. **独立性**：DMN 引擎可完全独立运行，拥有独立的数据源和数据表
2. **可扩展性**：支持自定义 HitPolicy、自定义函数委托、自定义表达式解析器
3. **可配置性**：通过 DmnEngineConfiguration 提供丰富的配置选项
4. **标准兼容**：完全符合 OMG DMN 1.1 规范

---

## 2. 目录结构与职责

### 2.1 源码目录结构

```
modules/flowable-dmn-engine/
├── src/main/java/org/flowable/dmn/
│   └── engine/
│       ├── DmnEngine.java                    # 引擎主接口
│       ├── DmnEngineConfiguration.java       # 引擎配置类（45KB，核心配置）
│       ├── DmnEngines.java                   # 引擎注册表和管理器
│       ├── RuleEngineExecutor.java           # 规则执行器接口
│       ├── FlowableDmnExpressionException.java
│       │
│       └── impl/                             # 实现层
│           ├── DmnEngineImpl.java            # 引擎实现
│           ├── DmnDecisionServiceImpl.java   # 决策服务实现
│           ├── DmnRepositoryServiceImpl.java # 仓库服务实现
│           ├── DmnHistoryServiceImpl.java    # 历史服务实现
│           ├── DmnManagementServiceImpl.java # 管理服务实现
│           ├── RuleEngineExecutorImpl.java   # 规则执行器实现（核心算法）
│           ├── ExecuteDecisionBuilderImpl.java
│           │
│           ├── agenda/                       # 执行议程
│           │   ├── DmnEngineAgenda.java
│           │   ├── DefaultDmnEngineAgenda.java
│           │   ├── DmnEngineAgendaFactory.java
│           │   └── operation/
│           │       ├── DmnOperation.java
│           │       ├── ExecuteDecisionOperation.java
│           │       └── ExecuteDecisionServiceOperation.java
│           │
│           ├── cmd/                          # 命令模式实现
│           │   ├── AbstractExecuteDecisionCmd.java
│           │   ├── DeployCmd.java
│           │   ├── DeleteDeploymentCmd.java
│           │   ├── EvaluateDecisionCmd.java
│           │   ├── ExecuteDecisionCmd.java
│           │   ├── ExecuteDecisionServiceCmd.java
│           │   ├── ExecuteDecisionWithAuditTrailCmd.java
│           │   └── ...
│           │
│           ├── db/                           # 数据库管理
│           │   ├── DmnDbSchemaManager.java
│           │   ├── EntityDependencyOrder.java
│           │   └── EntityToTableMap.java
│           │
│           ├── deployer/                     # 部署器
│           │   ├── DmnDeployer.java
│           │   ├── DmnDeploymentHelper.java
│           │   ├── ParsedDeployment.java
│           │   ├── ParsedDeploymentBuilder.java
│           │   └── CachingAndArtifactsManager.java
│           │
│           ├── el/                           # 表达式语言
│           │   ├── ELExecutionContext.java
│           │   ├── ELExecutionContextBuilder.java
│           │   ├── ELExpressionExecutor.java
│           │   ├── ELInputEntryExpressionPreParser.java
│           │   ├── ELOutputEntryExpressionPreParser.java
│           │   ├── ExecutionVariableFactory.java
│           │   ├── RuleExpressionCondition.java
│           │   ├── RuleExpressionOutput.java
│           │   │
│           │   └── 内置函数委托/
│           │       ├── CollectionsFunctionDelegate.java
│           │       ├── FlowableToDateFunctionDelegate.java
│           │       ├── FlowableAddDateFunctionDelegate.java
│           │       ├── FlowableSubtractDateFunctionDelegate.java
│           │       └── FlowableCurrentDateFunctionDelegate.java
│           │
│           ├── hitpolicy/                    # 命中策略实现
│           │   ├── HitPolicyBehavior.java    # 策略接口
│           │   ├── AbstractHitPolicy.java    # 策略基类
│           │   ├── HitPolicyUnique.java      # 唯一策略
│           │   ├── HitPolicyFirst.java       # 首次命中
│           │   ├── HitPolicyAny.java         # 任意命中
│           │   ├── HitPolicyPriority.java    # 优先级
│           │   ├── HitPolicyRuleOrder.java   # 规则顺序
│           │   ├── HitPolicyOutputOrder.java # 输出顺序
│           │   └── HitPolicyCollect.java     # 收集策略
│           │
│           ├── interceptor/
│           │   └── DmnCommandInvoker.java    # 命令调用器
│           │
│           ├── parser/
│           │   ├── DmnParse.java             # DMN XML 解析
│           │   └── DmnParseFactory.java
│           │
│           ├── persistence/                  # 持久化层
│           │   ├── deploy/
│           │   │   ├── DeploymentManager.java
│           │   │   ├── DecisionCacheEntry.java
│           │   │   └── Deployer.java
│           │   │
│           │   ├── entity/
│           │   │   ├── DecisionEntity.java
│           │   │   ├── DecisionEntityImpl.java
│           │   │   ├── DmnDeploymentEntity.java
│           │   │   ├── DmnDeploymentEntityImpl.java
│           │   │   ├── DmnResourceEntity.java
│           │   │   ├── DmnResourceEntityImpl.java
│           │   │   ├── HistoricDecisionExecutionEntity.java
│           │   │   └── HistoricDecisionExecutionEntityImpl.java
│           │   │
│           │   └── entity/data/
│           │       ├── DecisionDataManager.java
│           │       ├── DmnDeploymentDataManager.java
│           │       ├── DmnResourceDataManager.java
│           │       ├── HistoricDecisionExecutionDataManager.java
│           │       │
│           │       └── impl/                  # MyBatis 实现
│           │           ├── MybatisDecisionDataManager.java
│           │           ├── MybatisDmnDeploymentDataManager.java
│           │           ├── MybatisDmnResourceDataManager.java
│           │           └── MybatisHistoricDecisionExecutionDataManager.java
│           │
│           ├── repository/
│           │   └── DmnDeploymentBuilderImpl.java
│           │
│           └── util/
│               ├── CommandContextUtil.java
│               └── DecisionUtil.java
│
├── src/main/resources/org/flowable/dmn/db/
│   ├── create/                               # 数据库建表脚本
│   │   ├── flowable.mysql.create.dmn.sql
│   │   ├── flowable.postgres.create.dmn.sql
│   │   ├── flowable.oracle.create.dmn.sql
│   │   └── ...
│   │
│   ├── drop/                                 # 数据库删表脚本
│   │
│   ├── mapping/                              # MyBatis 映射文件
│   │   ├── mappings.xml
│   │   └── entity/
│   │       ├── Decision.xml
│   │       ├── DmnDeployment.xml
│   │       ├── DmnResource.xml
│   │       └── HistoricDecisionExecution.xml
│   │
│   └── upgrade/                              # 数据库升级脚本
│
└── src/test/                                 # 测试代码
    ├── java/org/flowable/dmn/engine/test/
    │   ├── deployment/
    │   ├── history/
    │   ├── runtime/
    │   │   ├── RuntimeTest.java
    │   │   ├── HitPolicyUniqueTest.java
    │   │   ├── HitPolicyFirstTest.java
    │   │   ├── HitPolicyAnyTest.java
    │   │   ├── HitPolicyPriorityTest.java
    │   │   ├── HitPolicyRuleOrderTest.java
    │   │   ├── HitPolicyOutputOrderTest.java
    │   │   ├── HitPolicyCollectTest.java
    │   │   └── drd/
    │   │       └── DecisionServiceTest.java
    │   └── ...
    │
    └── resources/                            # 测试资源
        ├── *.dmn                             # DMN 测试文件
        └── flowable.dmn.cfg.xml              # 测试配置
```

### 2.2 API 模块结构

```
modules/flowable-dmn-api/src/main/java/org/flowable/dmn/api/
├── DmnDecisionService.java              # 决策执行服务接口
├── DmnRepositoryService.java            # 仓库管理服务接口
├── DmnHistoryService.java               # 历史服务接口
├── DmnManagementService.java            # 管理服务接口
├── DmnEngineConfigurationApi.java       # 引擎配置 API
│
├── ExecuteDecisionBuilder.java          # 决策执行构建器
├── ExecuteDecisionContext.java          # 决策执行上下文
│
├── DmnDecision.java                     # 决策定义接口
├── DmnDeployment.java                   # 部署接口
├── DmnDeploymentBuilder.java            # 部署构建器
│
├── DmnDecisionQuery.java                # 决策查询接口
├── DmnDeploymentQuery.java              # 部署查询接口
├── DmnHistoricDecisionExecutionQuery.java
│
├── DecisionExecutionAuditContainer.java # 决策执行审计容器
├── DecisionServiceExecutionAuditContainer.java
├── RuleExecutionAuditContainer.java     # 规则执行审计容器
│
├── DmnDecisionRuleResult.java           # 决策规则结果
├── DecisionTypes.java                   # 决策类型常量
└── DmnChangeTenantIdEntityTypes.java    # 租户变更实体类型
```

---

## 3. 核心组件依赖关系

### 3.1 组件依赖图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DmnEngine                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        DmnEngineConfiguration                        │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │    │
│  │  │ DmnDecisionService│  │DmnRepositoryService│  │ DmnHistoryService│   │    │
│  │  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘   │    │
│  │           │                     │                     │             │    │
│  │           ▼                     ▼                     ▼             │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │                     CommandExecutor                           │   │    │
│  │  │  ┌─────────────────────────────────────────────────────────┐ │   │    │
│  │  │  │                 Command Interceptors                     │ │   │    │
│  │  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │ │   │    │
│  │  │  │  │   Log       │→ │ Transaction │→ │   Dmn       │      │ │   │    │
│  │  │  │  │  Interceptor│  │ Interceptor │  │  CmdInvoker │      │ │   │    │
│  │  │  │  └─────────────┘  └─────────────┘  └──────┬──────┘      │ │   │    │
│  │  │  └──────────────────────────────────────────│──────────────┘ │   │    │
│  │  └──────────────────────────────────────────────│────────────────┘   │    │
│  │                                                 ▼                    │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │                    DmnEngineAgenda                            │   │    │
│  │  │  ┌────────────────────────────────────────────────────────┐  │   │    │
│  │  │  │              ExecuteDecisionOperation                   │  │   │    │
│  │  │  │                        │                               │  │   │    │
│  │  │  │                        ▼                               │  │   │    │
│  │  │  │             RuleEngineExecutorImpl                     │  │   │    │
│  │  │  │                        │                               │  │   │    │
│  │  │  │           ┌────────────┼────────────┐                 │  │   │    │
│  │  │  │           ▼            ▼            ▼                 │  │   │    │
│  │  │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐        │  │   │    │
│  │  │  │  │Expression  │ │ HitPolicy  │ │  Audit     │        │  │   │    │
│  │  │  │  │  Manager   │ │ Behaviors  │ │  Trail     │        │  │   │    │
│  │  │  │  └────────────┘ └────────────┘ └────────────┘        │  │   │    │
│  │  │  └────────────────────────────────────────────────────────┘  │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 数据访问层依赖

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Entity Managers                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │DecisionEntity    │  │DmnDeployment     │  │HistoricDecision  │   │
│  │  Manager         │  │  EntityManager   │  │ExecutionEntityMgr│   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘   │
│           │                     │                     │             │
│           ▼                     ▼                     ▼             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      Data Managers                            │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐  │   │
│  │  │DecisionData      │  │DmnDeployment     │  │HistoricDeci│  │   │
│  │  │  Manager         │  │  DataManager     │  │sionExecDMgr│  │   │
│  │  └────────┬─────────┘  └────────┬─────────┘  └────────┬───┘  │   │
│  └───────────│─────────────────────│─────────────────────│───────┘   │
│              │                     │                     │           │
│              ▼                     ▼                     ▼           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     DbSqlSession                             │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │                   MyBatis Session                       │  │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐        │  │   │
│  │  │  │ Decision   │  │ DmnDeploy  │  │ Historic   │        │  │   │
│  │  │  │  .xml      │  │  ment.xml  │  │ Decision.xml│        │  │   │
│  │  │  └────────────┘  └────────────┘  └────────────┘        │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. 核心数据流

### 4.1 决策执行流程

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           决策执行完整流程                                     │
└──────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐
    │   Client    │
    │  Application│
    └──────┬──────┘
           │ 1. createExecuteDecisionBuilder()
           ▼
    ┌─────────────────┐
    │ DmnDecision     │
    │   Service       │
    └──────┬──────────┘
           │ 2. decisionKey("xxx").variables(map).executeDecision()
           ▼
    ┌─────────────────┐
    │ ExecuteDecision │
    │    Builder      │
    └──────┬──────────┘
           │ 3. buildExecuteDecisionContext()
           ▼
    ┌─────────────────┐
    │ CommandExecutor │
    │  (Interceptor   │
    │     Chain)      │
    └──────┬──────────┘
           │ 4. execute(new ExecuteDecisionCmd())
           ▼
    ┌─────────────────┐
    │ DmnCommandInvoker│
    │                 │
    └──────┬──────────┘
           │ 5. agenda.planOperation(new ExecuteDecisionOperation())
           ▼
    ┌─────────────────┐
    │ DmnEngineAgenda │
    │                 │
    └──────┬──────────┘
           │ 6. executeOperation()
           ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                    ExecuteDecisionOperation                          │
    │  ┌───────────────────────────────────────────────────────────────┐  │
    │  │  7. 获取 Decision 定义 (DeploymentManager.getDecision())       │  │
    │  │  8. 调用 RuleEngineExecutor.execute()                          │  │
    └───────────────────────────────────────────────────────────────────┘  │
    └──────┬──────────────────────────────────────────────────────────────┘
           │
           ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                    RuleEngineExecutorImpl                           │
    │  ┌───────────────────────────────────────────────────────────────┐  │
    │  │  9. 创建 ELExecutionContext (执行上下文)                        │  │
    │  │  10. 健全性检查 sanityCheckDecisionTable()                     │  │
    │  │  11. 执行决策表 evaluateDecisionTable()                        │  │
    │  │      ├── 遍历所有规则 executeRule()                           │  │
    │  │      │   ├── 执行输入表达式评估                               │  │
    │  │      │   ├── 检查 HitPolicy 有效性                            │  │
    │  │      │   └── 收集有效规则输出                                 │  │
    │  │      ├── 组合规则结论 executeOutputEntryAction()              │  │
    │  │      └── 组合决策结果 composeDecisionResults()                │  │
    │  │  12. 返回 DecisionExecutionAuditContainer                      │  │
    └───────────────────────────────────────────────────────────────────┘  │
    └──────┬──────────────────────────────────────────────────────────────┘
           │
           ▼
    ┌─────────────────┐
    │ DecisionResult  │
    │  List<Map<String│
    │  , Object>>     │
    └─────────────────┘
```

### 4.2 规则执行详细流程

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           单条规则执行流程                                     │
└──────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │                    DecisionTable (决策表)                            │
    │  ┌───────────────────────────────────────────────────────────────┐  │
    │  │  Input Clauses (输入子句)    │  Output Clauses (输出子句)      │  │
    │  │  ┌─────────┬─────────┐     │  ┌─────────┬─────────┐         │  │
    │  │  │  Age    │  Score  │     │  │ Result  │  Level   │         │  │
    │  │  ├─────────┼─────────┤     │  ├─────────┼─────────┤         │  │
    │  │  │  > 60   │  > 80   │     │  │  Pass   │  A       │ Rule 1 │  │
    │  │  │  > 40   │  > 60   │     │  │  Pass   │  B       │ Rule 2 │  │
    │  │  │  -      │  -      │     │  │  Fail   │  C       │ Rule 3 │  │
    │  │  └─────────┴─────────┘     │  └─────────┴─────────┘         │  │
    │  └───────────────────────────────────────────────────────────────┘  │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                    规则评估 (Rule Evaluation)                        │
    │                                                                      │
    │   for each rule in decisionTable.getRules():                        │
    │   ┌─────────────────────────────────────────────────────────────┐   │
    │   │  Rule 1:                                                      │   │
    │   │  ┌─────────────────────────────────────────────────────────┐│   │
    │   │  │  Input Entry 1: Age > 60                                 ││   │
    │   │  │  ┌─────────────────────────────────────────────────────┐││   │
    │   │  │  │  ELExpressionExecutor.executeInputExpression()      │││   │
    │   │  │  │  输入: inputClause.inputExpression = "age"          │││   │
    │   │  │  │       inputEntry.text = "> 60"                      │││   │
    │   │  │  │       executionContext.variables = {age: 65}        │││   │
    │   │  │  │  评估: age > 60 => 65 > 60 => true                  │││   │
    │   │  │  └─────────────────────────────────────────────────────┘││   │
    │   │  │                                                          ││   │
    │   │  │  Input Entry 2: Score > 80                               ││   │
    │   │  │  ┌─────────────────────────────────────────────────────┐││   │
    │   │  │  │  评估: score > 80 => 75 > 80 => false               │││   │
    │   │  │  └─────────────────────────────────────────────────────┘││   │
    │   │  │                                                          ││   │
    │   │  │  规则结果: false (因为条件2不满足)                        ││   │
    │   │  └─────────────────────────────────────────────────────────┘│   │
    │   │                                                              │   │
    │   │  Rule 2:                                                     │   │
    │   │  ┌─────────────────────────────────────────────────────────┐│   │
    │   │  │  Input Entry 1: Age > 40 => 65 > 40 => true             ││   │
    │   │  │  Input Entry 2: Score > 60 => 75 > 60 => true           ││   │
    │   │  │  规则结果: true ✓                                         ││   │
    │   │  │                                                          ││   │
    │   │  │  Output Entry:                                           ││   │
    │   │  │  ┌─────────────────────────────────────────────────────┐││   │
    │   │  │  │  composeOutputEntryResult()                          │││   │
    │   │  │  │  输出: Result = "Pass", Level = "B"                  │││   │
    │   │  │  │  更新 executionContext.stackVariables                │││   │
    │   │  │  │  添加到 ruleResults                                   │││   │
    │   │  │  └─────────────────────────────────────────────────────┘││   │
    │   │  └─────────────────────────────────────────────────────────┘│   │
    │   └─────────────────────────────────────────────────────────────┘   │
    │                                                                      │
    │   HitPolicy 处理:                                                    │
    │   ┌─────────────────────────────────────────────────────────────┐   │
    │   │  HitPolicyUnique: 检查是否只有一条规则匹配                     │   │
    │   │  HitPolicyFirst: 找到第一条匹配规则后停止评估                  │   │
    │   │  HitPolicyCollect: 收集所有匹配规则的输出                     │   │
    │   │  ...                                                          │   │
    │   └─────────────────────────────────────────────────────────────┘   │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## 5. 组件交互机制

### 5.1 服务层交互

```java
// 典型的决策执行调用链
DmnEngine dmnEngine = DmnEngines.getDefaultDmnEngine();

// 1. 获取决策服务
DmnDecisionService decisionService = dmnEngine.getDmnDecisionService();

// 2. 创建执行构建器
ExecuteDecisionBuilder builder = decisionService.createExecuteDecisionBuilder()
    .decisionKey("loanApproval")
    .tenantId("finance")
    .variable("income", 50000)
    .variable("creditScore", 750);

// 3. 执行决策
List<Map<String, Object>> results = builder.executeDecision();
```

### 5.2 命令模式交互

所有操作都通过命令模式执行：

```java
// 命令执行流程
commandExecutor.execute(new ExecuteDecisionCmd(builder));

// 命令接口
public interface Command<T> {
    T execute(CommandContext commandContext);
}

// 命令调用器
public class DmnCommandInvoker extends AbstractCommandInterceptor {
    @Override
    public <T> T execute(CommandConfig config, Command<T> command) {
        CommandContext commandContext = Context.getCommandContext();
        
        // 获取 Agenda
        DmnEngineAgenda agenda = getAgenda(commandContext);
        
        // 执行命令（通常会规划一个或多个操作到 Agenda）
        T result = command.execute(commandContext);
        
        // 执行 Agenda 中的所有操作
        while (!agenda.isEmpty()) {
            DmnOperation operation = agenda.getNextOperation();
            operation.run();
        }
        
        return result;
    }
}
```

### 5.3 表达式执行机制

```java
// 表达式执行上下文
public class ELExecutionContext {
    protected Map<String, Object> inputVariables;      // 输入变量
    protected Map<String, Object> stackVariables;      // 栈变量（输出）
    protected Map<Integer, Map<String, Object>> ruleResults;  // 规则结果
    protected DecisionExecutionAuditContainer auditContainer; // 审计容器
}

// 表达式执行器
public class ELExpressionExecutor {
    public static Boolean executeInputExpression(
            InputClause inputClause, 
            LiteralExpression inputEntry,
            ExpressionManager expressionManager,
            ELExecutionContext executionContext) {
        
        // 1. 获取输入表达式（如：age）
        String inputExpression = inputClause.getInputExpression().getText();
        
        // 2. 获取条件表达式（如：> 60）
        String conditionExpression = inputEntry.getText();
        
        // 3. 组合完整表达式：age > 60
        String fullExpression = inputExpression + " " + conditionExpression;
        
        // 4. 使用 ExpressionManager 执行表达式
        Expression expression = expressionManager.createExpression(fullExpression);
        Object result = expression.getValue(executionContext);
        
        return (Boolean) result;
    }
}
```

---

## 6. 可扩展性设计

### 6.1 自定义 HitPolicy

```java
// 自定义 HitPolicy 示例
public class HitPolicyCustom extends AbstractHitPolicy {
    
    @Override
    public String getHitPolicyName() {
        return "CUSTOM";
    }
    
    @Override
    public boolean shouldContinueEvaluating(boolean ruleResult) {
        // 自定义是否继续评估逻辑
        return true;
    }
    
    @Override
    public void evaluateRuleValidity(int ruleNumber, ELExecutionContext executionContext) {
        // 自定义规则有效性验证
    }
}

// 注册自定义 HitPolicy
DmnEngineConfiguration configuration = new StandaloneDmnEngineConfiguration();
Map<String, AbstractHitPolicy> customHitPolicies = new HashMap<>();
customHitPolicies.put("CUSTOM", new HitPolicyCustom());
configuration.setCustomHitPolicyBehaviors(customHitPolicies);
```

### 6.2 自定义函数委托

```java
// 自定义函数委托
public class CustomFunctionDelegate implements FlowableFunctionDelegate {
    
    @Override
    public String getFunctionName() {
        return "calculateRisk";
    }
    
    @Override
    public Class<?> getFunctionClass() {
        return this.getClass();
    }
    
    @Override
    public Method getFunctionMethod() {
        return ReflectUtil.getMethod(this.getClass(), "calculateRisk", Number.class, Number.class);
    }
    
    // 自定义函数实现
    public static String calculateRisk(Number income, Number debt) {
        double ratio = debt.doubleValue() / income.doubleValue();
        if (ratio < 0.3) return "LOW";
        if (ratio < 0.6) return "MEDIUM";
        return "HIGH";
    }
}

// 注册自定义函数
List<FlowableFunctionDelegate> customDelegates = new ArrayList<>();
customDelegates.add(new CustomFunctionDelegate());
configuration.setCustomFlowableFunctionDelegates(customDelegates);
```

### 6.3 自定义表达式解析器

```java
// 添加自定义 EL Resolver
configuration.addPreDefaultELResolver(new CustomELResolver());
configuration.addPostDefaultELResolver(new AnotherCustomELResolver());
```

---

## 7. 可维护性设计

### 7.1 日志记录

```java
// 使用 SLF4J 日志框架
private static final Logger LOGGER = LoggerFactory.getLogger(RuleEngineExecutorImpl.class);

// 关键操作日志
LOGGER.debug("Start table evaluation: {}", decisionTable.getId());
LOGGER.debug("input entry {} ( {} {} ): {}", inputEntryId, ...);
LOGGER.error("decision table execution failed", ade);
```

### 7.2 审计追踪

```java
// 完整的审计追踪
public class DecisionExecutionAuditContainer {
    protected String decisionId;
    protected String decisionName;
    protected Date startTime;
    protected Date endTime;
    protected boolean isFailed;
    protected String exceptionMessage;
    protected Map<Integer, RuleExecutionAuditContainer> ruleExecutions;
    protected List<Map<String, Object>> decisionResult;
    protected boolean multipleResults;
}

// 规则级审计
public class RuleExecutionAuditContainer {
    protected int ruleNumber;
    protected boolean isValid;
    protected Map<String, ExpressionExecution> inputExecutions;
    protected Map<String, ExpressionExecution> outputExecutions;
    protected String exceptionMessage;
    protected String validationMessage;
}
```

### 7.3 异常处理

```java
// 统一异常处理
try {
    evaluateDecisionTable(currentDecisionTable, executionContext);
} catch (FlowableException fe) {
    LOGGER.error("decision table execution sanity check failed", fe);
    executionContext.getAuditContainer().setFailed();
    executionContext.getAuditContainer().setExceptionMessage(getExceptionMessage(fe));
}
```

---

## 8. 性能优化设计

### 8.1 决策缓存

```java
// 决策定义缓存
protected DeploymentCache<DecisionCacheEntry> definitionCache;

// 缓存配置
configuration.setDecisionCacheLimit(1000);  // 缓存1000个决策定义
```

### 8.2 数据库优化

```sql
-- 唯一索引确保决策版本唯一性
CREATE UNIQUE INDEX ACT_IDX_DMN_DEC_UNIQ ON ACT_DMN_DECISION(KEY_, VERSION_, TENANT_ID_);

-- 实例ID索引加速历史查询
CREATE INDEX ACT_IDX_DMN_INSTANCE_ID ON ACT_DMN_HI_DECISION_EXECUTION(INSTANCE_ID_);
```

### 8.3 批量操作

```java
// 批量删除历史执行记录
public class BulkDeleteHistoricDecisionExecutionsByInstanceIdsAndScopeTypeCmd implements Command<Void> {
    protected Collection<String> instanceIds;
    protected String scopeType;
    
    @Override
    public Void execute(CommandContext commandContext) {
        // 批量删除优化
    }
}
```

---

## 9. 数据库表设计

### 9.1 表结构概览

| 表名 | 描述 | 主要字段 |
|------|------|----------|
| ACT_DMN_DEPLOYMENT | 部署记录 | ID_, NAME_, CATEGORY_, TENANT_ID_, DEPLOY_TIME_ |
| ACT_DMN_DEPLOYMENT_RESOURCE | 部署资源 | ID_, NAME_, DEPLOYMENT_ID_, RESOURCE_BYTES_ |
| ACT_DMN_DECISION | 决策定义 | ID_, KEY_, NAME_, VERSION_, DECISION_TYPE_, DEPLOYMENT_ID_ |
| ACT_DMN_HI_DECISION_EXECUTION | 历史执行 | ID_, DECISION_DEFINITION_ID_, INSTANCE_ID_, EXECUTION_JSON_ |

### 9.2 实体关系图

```
┌──────────────────────┐       ┌──────────────────────────┐
│  ACT_DMN_DEPLOYMENT  │       │ ACT_DMN_DEPLOYMENT_RESOURCE│
│──────────────────────│       │──────────────────────────│
│  ID_ (PK)            │◄──────│  DEPLOYMENT_ID_ (FK)      │
│  NAME_               │       │  ID_ (PK)                 │
│  CATEGORY_           │       │  NAME_                    │
│  TENANT_ID_          │       │  RESOURCE_BYTES_          │
│  DEPLOY_TIME_        │       └──────────────────────────┘
│  PARENT_DEPLOYMENT_ID│
└──────────┬───────────┘
           │
           │ 1:N
           ▼
┌──────────────────────┐       ┌───────────────────────────────┐
│   ACT_DMN_DECISION   │       │ACT_DMN_HI_DECISION_EXECUTION  │
│──────────────────────│       │───────────────────────────────│
│  ID_ (PK)            │◄──────│  DECISION_DEFINITION_ID_      │
│  KEY_                │       │  ID_ (PK)                     │
│  NAME_               │       │  DEPLOYMENT_ID_               │
│  VERSION_            │       │  INSTANCE_ID_                 │
│  DECISION_TYPE_      │       │  EXECUTION_ID_                │
│  DEPLOYMENT_ID_ (FK) │       │  ACTIVITY_ID_                 │
│  TENANT_ID_          │       │  START_TIME_                  │
│  RESOURCE_NAME_      │       │  END_TIME_                    │
│  DESCRIPTION_        │       │  FAILED_                      │
└──────────────────────┘       │  EXECUTION_JSON_              │
                               │  TENANT_ID_                   │
                               └───────────────────────────────┘
```

---

## 10. 总结

Flowable DMN 引擎采用了清晰的分层架构设计：

1. **API 层**：提供简洁的服务接口（DmnDecisionService、DmnRepositoryService 等）
2. **命令层**：使用命令模式封装所有操作，支持拦截器链
3. **执行层**：通过 Agenda 机制调度操作执行
4. **核心层**：RuleEngineExecutor 实现决策表执行算法
5. **持久层**：使用 MyBatis 实现数据访问，支持多种数据库

这种架构设计使得 DMN 引擎具有高度的可扩展性、可维护性和性能优化空间。
