# DMN 与 BPMN 流程引擎深度集成设计

## 1. 集成架构概述

### 1.1 设计目标

DMN 决策引擎需要支持以下集成特性：

1. **独立运行**：DMN 引擎可完全独立运行，不依赖 BPMN 引擎
2. **独立数据源**：支持单独的数据源和数据表
3. **独立服务**：提供独立的 DecisionService
4. **流程集成**：支持 BPMN 流程中的 BusinessRuleTask 调用
5. **数据流转**：流程变量与 DMN 输入/输出的无缝转换

### 1.2 集成架构图

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              DMN + BPMN 集成架构                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    应用层                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐│
│  │                              业务应用                                                ││
│  │    ┌─────────────────────┐              ┌─────────────────────┐                      ││
│  │    │   流程驱动应用       │              │   决策服务应用       │                      ││
│  │    │ (使用 BPMN + DMN)   │              │  (仅使用 DMN)       │                      ││
│  │    └──────────┬──────────┘              └──────────┬──────────┘                      ││
│  └───────────────│────────────────────────────────────│─────────────────────────────────┘│
│                  │                                    │                                  │
└──────────────────│────────────────────────────────────│──────────────────────────────────┘
                   │                                    │
                   ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   引擎层                                                 │
│  ┌───────────────────────────────────────┐  ┌───────────────────────────────────────┐  │
│  │           Process Engine              │  │            DMN Engine                  │  │
│  │  ┌─────────────────────────────────┐  │  │  ┌─────────────────────────────────┐  │  │
│  │  │      RuntimeService             │  │  │  │      DmnDecisionService         │  │  │
│  │  │      RepositoryService          │  │  │  │      DmnRepositoryService       │  │  │
│  │  │      TaskService                │  │  │  │      DmnHistoryService          │  │  │
│  │  │      HistoryService             │  │  │  └─────────────────────────────────┘  │  │
│  │  └─────────────────────────────────┘  │  │                                       │  │
│  │                                       │  │  ┌─────────────────────────────────┐  │  │
│  │  ┌─────────────────────────────────┐  │  │  │      RuleEngineExecutor         │  │  │
│  │  │    BusinessRuleTaskActivity     │◀─┼──┼──│      HitPolicyBehaviors         │  │  │
│  │  │    (调用 DMN 决策)               │  │  │  │      ExpressionManager          │  │  │
│  │  └─────────────────────────────────┘  │  │  └─────────────────────────────────┘  │  │
│  │                                       │  │                                       │  │
│  └───────────────────────────────────────┘  └───────────────────────────────────────┘  │
│                  │                                    │                                  │
│                  │  共享/独立数据源                    │                                  │
│                  ▼                                    ▼                                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   数据层                                                 │
│  ┌───────────────────────────────────────┐  ┌───────────────────────────────────────┐  │
│  │         Process Database              │  │           DMN Database                 │  │
│  │  ┌─────────────────────────────────┐  │  │  ┌─────────────────────────────────┐  │  │
│  │  │ ACT_RE_* (仓库表)               │  │  │  │ ACT_DMN_DEPLOYMENT              │  │  │
│  │  │ ACT_RU_* (运行时表)             │  │  │  │ ACT_DMN_DECISION                │  │  │
│  │  │ ACT_HI_* (历史表)               │  │  │  │ ACT_DMN_DEPLOYMENT_RESOURCE     │  │  │
│  │  │ ACT_GE_* (通用表)               │  │  │  │ ACT_DMN_HI_DECISION_EXECUTION   │  │  │
│  │  └─────────────────────────────────┘  │  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. DMN 独立运行设计

### 2.1 独立数据源配置

```typescript
// NestJS 模块配置 - DMN 独立数据源
@Module({
  imports: [
    // DMN 专用数据源
    TypeOrmModule.forRootAsync({
      name: 'dmnDataSource',
      useFactory: () => ({
        type: 'mysql',
        host: process.env.DMN_DB_HOST || 'localhost',
        port: parseInt(process.env.DMN_DB_PORT) || 3306,
        username: process.env.DMN_DB_USERNAME || 'root',
        password: process.env.DMN_DB_PASSWORD || '',
        database: process.env.DMN_DB_DATABASE || 'flowable_dmn',
        entities: [__dirname + '/dmn/**/*.entity{.ts,.js}'],
        synchronize: false,
      }),
    }),
    
    // BPMN 数据源（可选，用于集成）
    TypeOrmModule.forRootAsync({
      name: 'bpmnDataSource',
      useFactory: () => ({
        type: 'mysql',
        host: process.env.BPMN_DB_HOST || 'localhost',
        port: parseInt(process.env.BPMN_DB_PORT) || 3306,
        username: process.env.BPMN_DB_USERNAME || 'root',
        password: process.env.BPMN_DB_PASSWORD || '',
        database: process.env.BPMN_DB_DATABASE || 'flowable_bpmn',
        entities: [__dirname + '/bpmn/**/*.entity{.ts,.js}'],
        synchronize: false,
      }),
    }),
  ],
})
export class DmnEngineModule {}
```

### 2.2 独立 DMN 引擎配置

```typescript
// DMN 引擎配置类
@Injectable()
export class DmnEngineConfiguration {
  
  // 独立数据源
  private dmnDataSource: DataSource;
  
  // 服务实例
  private decisionService: DmnDecisionService;
  private repositoryService: DmnRepositoryService;
  private historyService: DmnHistoryService;
  private managementService: DmnManagementService;
  
  // 核心组件
  private ruleEngineExecutor: RuleEngineExecutor;
  private expressionManager: ExpressionManager;
  private hitPolicyBehaviors: Map<string, HitPolicyBehavior>;
  
  // 缓存配置
  private decisionCacheLimit: number = 500;
  private definitionCache: DeploymentCache<DecisionCacheEntry>;
  
  // 功能开关
  private historyEnabled: boolean = true;
  private strictMode: boolean = true;
  
  async initialize(): Promise<void> {
    // 初始化数据管理器
    this.initDataManagers();
    
    // 初始化实体管理器
    this.initEntityManagers();
    
    // 初始化 HitPolicy
    this.initHitPolicyBehaviors();
    
    // 初始化表达式管理器
    this.initExpressionManager();
    
    // 初始化规则执行器
    this.initRuleEngineExecutor();
    
    // 初始化服务
    this.initServices();
    
    // 初始化缓存
    this.initDefinitionCache();
  }
  
  private initHitPolicyBehaviors(): void {
    this.hitPolicyBehaviors = new Map([
      ['UNIQUE', new HitPolicyUnique()],
      ['FIRST', new HitPolicyFirst()],
      ['ANY', new HitPolicyAny()],
      ['PRIORITY', new HitPolicyPriority()],
      ['RULE ORDER', new HitPolicyRuleOrder()],
      ['OUTPUT ORDER', new HitPolicyOutputOrder()],
      ['COLLECT', new HitPolicyCollect()],
    ]);
    
    // 支持自定义 HitPolicy
    if (this.customHitPolicyBehaviors) {
      this.customHitPolicyBehaviors.forEach((behavior, name) => {
        this.hitPolicyBehaviors.set(name, behavior);
      });
    }
  }
}
```

### 2.3 独立 DecisionService

```typescript
/**
 * 独立的 DMN 决策服务
 * 可独立使用，不依赖 BPMN 引擎
 */
@Injectable()
export class DmnDecisionService {
  
  constructor(
    private readonly engineConfig: DmnEngineConfiguration,
    private readonly commandExecutor: CommandExecutor,
  ) {}
  
  /**
   * 创建决策执行构建器
   */
  createExecuteDecisionBuilder(): ExecuteDecisionBuilder {
    return new ExecuteDecisionBuilderImpl(this.engineConfig);
  }
  
  /**
   * 执行决策表
   */
  async executeDecision(builder: ExecuteDecisionBuilder): Promise<List<Map<string, any>>> {
    return this.commandExecutor.execute(
      new ExecuteDecisionCmd(builder)
    );
  }
  
  /**
   * 执行决策（单结果模式）
   */
  async executeDecisionWithSingleResult(builder: ExecuteDecisionBuilder): Promise<Map<string, any>> {
    const results = await this.executeDecision(builder);
    if (results.length > 1) {
      throw new FlowableException('Multiple results found, but single result expected');
    }
    return results.length > 0 ? results[0] : new Map();
  }
  
  /**
   * 执行决策（审计追踪模式）
   */
  async executeDecisionWithAuditTrail(builder: ExecuteDecisionBuilder): Promise<DecisionExecutionAuditContainer> {
    return this.commandExecutor.execute(
      new ExecuteDecisionWithAuditTrailCmd(builder)
    );
  }
}
```

---

## 3. BPMN 流程集成设计

### 3.1 BusinessRuleTask 定义

```xml
<!-- BPMN 流程中的 BusinessRuleTask -->
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:flowable="http://flowable.org/bpmn">
  
  <process id="loanApprovalProcess" name="贷款审批流程">
    
    <!-- 业务规则任务：调用 DMN 决策 -->
    <businessRuleTask id="evaluateRisk" 
                      name="风险评估"
                      flowable:decisionTableReferenceKey="riskAssessment"
                      flowable:resultVariable="riskResult">
      <!-- 输入变量映射 -->
      <extensionElements>
        <flowable:inputParameter name="income">${applicant.income}</flowable:inputParameter>
        <flowable:inputParameter name="creditScore">${applicant.creditScore}</flowable:inputParameter>
        <flowable:inputParameter name="debtRatio">${applicant.debtRatio}</flowable:inputParameter>
      </extensionElements>
    </businessRuleTask>
    
    <!-- 根据决策结果走不同分支 -->
    <exclusiveGateway id="riskGateway" name="风险判断">
      <sequenceFlow id="highRisk" sourceRef="riskGateway" targetRef="manualReview">
        <conditionExpression>${riskResult.riskLevel == 'HIGH'}</conditionExpression>
      </sequenceFlow>
      <sequenceFlow id="lowRisk" sourceRef="riskGateway" targetRef="autoApprove">
        <conditionExpression>${riskResult.riskLevel == 'LOW'}</conditionExpression>
      </sequenceFlow>
    </exclusiveGateway>
    
  </process>
</definitions>
```

### 3.2 BusinessRuleTask 执行器

```typescript
/**
 * BusinessRuleTask 活动执行器
 * 在 BPMN 流程中调用 DMN 决策引擎
 */
@Injectable()
export class BusinessRuleTaskActivityBehavior implements ActivityBehavior {
  
  constructor(
    private readonly dmnDecisionService: DmnDecisionService,
    private readonly dmnRepositoryService: DmnRepositoryService,
  ) {}
  
  /**
   * 执行业务规则任务
   */
  async execute(execution: DelegateExecution): Promise<void> {
    const activity = execution.getCurrentActivity() as BusinessRuleTask;
    
    // 1. 获取决策定义 Key
    const decisionKey = activity.getDecisionTableReferenceKey();
    if (!decisionKey) {
      throw new FlowableException('No decision table reference key specified');
    }
    
    // 2. 构建输入变量
    const inputVariables = this.buildInputVariables(execution, activity);
    
    // 3. 执行决策
    const builder = this.dmnDecisionService.createExecuteDecisionBuilder()
      .decisionKey(decisionKey)
      .tenantId(execution.getTenantId())
      .instanceId(execution.getProcessInstanceId())
      .executionId(execution.getId())
      .activityId(execution.getCurrentActivityId())
      .variables(inputVariables);
    
    // 4. 获取决策结果
    const decisionResults = await this.dmnDecisionService.executeDecision(builder);
    
    // 5. 处理结果并设置到流程变量
    const resultVariable = activity.getResultVariable() || 'decisionResult';
    if (decisionResults.length > 0) {
      // 如果只有一个结果，直接设置
      if (decisionResults.length === 1) {
        execution.setVariable(resultVariable, decisionResults[0]);
      } else {
        // 多个结果设置为列表
        execution.setVariable(resultVariable, decisionResults);
      }
    }
    
    // 6. 继续流程
    execution.leave();
  }
  
  /**
   * 构建输入变量
   */
  private buildInputVariables(execution: DelegateExecution, activity: BusinessRuleTask): Map<string, any> {
    const inputVariables = new Map<string, any>();
    
    // 从扩展元素获取输入参数映射
    const inputParameters = activity.getInputParameters();
    for (const param of inputParameters) {
      // 解析表达式并获取值
      const value = this.expressionManager.evaluate(param.getExpression(), execution);
      inputVariables.set(param.getName(), value);
    }
    
    // 也可以直接使用流程变量
    const includeAllVariables = activity.isIncludeAllVariables();
    if (includeAllVariables) {
      const processVariables = execution.getVariables();
      for (const [key, value] of Object.entries(processVariables)) {
        if (!inputVariables.has(key)) {
          inputVariables.set(key, value);
        }
      }
    }
    
    return inputVariables;
  }
}
```

### 3.3 决策服务调用（DRD）

```xml
<!-- 使用决策服务（Decision Service）而非单个决策表 -->
<businessRuleTask id="evaluateLoan" 
                  name="贷款评估"
                  flowable:decisionServiceReferenceKey="loanEvaluationService"
                  flowable:resultVariable="loanDecision">
</businessRuleTask>
```

```typescript
/**
 * 决策服务执行器
 * 支持调用包含多个决策表的决策服务（DRD）
 */
@Injectable()
export class DecisionServiceActivityBehavior implements ActivityBehavior {
  
  constructor(
    private readonly dmnDecisionService: DmnDecisionService,
  ) {}
  
  async execute(execution: DelegateExecution): Promise<void> {
    const activity = execution.getCurrentActivity() as BusinessRuleTask;
    const decisionServiceKey = activity.getDecisionServiceReferenceKey();
    
    if (!decisionServiceKey) {
      throw new FlowableException('No decision service reference key specified');
    }
    
    // 构建输入变量
    const inputVariables = this.buildInputVariables(execution, activity);
    
    // 执行决策服务
    const builder = this.dmnDecisionService.createExecuteDecisionBuilder()
      .decisionKey(decisionServiceKey)
      .tenantId(execution.getTenantId())
      .variables(inputVariables);
    
    // 执行并获取结果
    const results = await this.dmnDecisionService.executeDecisionService(builder);
    
    // 设置结果到流程变量
    const resultVariable = activity.getResultVariable() || 'decisionServiceResult';
    execution.setVariable(resultVariable, results);
    
    // 继续流程
    execution.leave();
  }
}
```

---

## 4. 数据流转设计

### 4.1 流程变量 → DMN 输入

```typescript
/**
 * 变量映射处理器
 * 将流程变量映射为 DMN 输入
 */
@Injectable()
export class VariableMapper {
  
  /**
   * 流程变量映射到 DMN 输入
   */
  mapToDmnInput(execution: DelegateExecution, mapping: VariableMapping[]): Map<string, any> {
    const dmnInput = new Map<string, any>();
    
    for (const map of mapping) {
      const sourceValue = this.getSourceValue(execution, map.source);
      const targetValue = this.transformValue(sourceValue, map.transformation);
      dmnInput.set(map.target, targetValue);
    }
    
    return dmnInput;
  }
  
  /**
   * 获取源变量值
   */
  private getSourceValue(execution: DelegateExecution, source: string): any {
    // 支持点号分隔的嵌套属性访问
    if (source.includes('.')) {
      const parts = source.split('.');
      let value = execution.getVariable(parts[0]);
      for (let i = 1; i < parts.length; i++) {
        if (value == null) return null;
        value = value[parts[i]];
      }
      return value;
    }
    return execution.getVariable(source);
  }
  
  /**
   * 值转换
   */
  private transformValue(value: any, transformation?: string): any {
    if (!transformation) return value;
    
    switch (transformation) {
      case 'number':
        return Number(value);
      case 'string':
        return String(value);
      case 'boolean':
        return Boolean(value);
      case 'date':
        return new Date(value);
      default:
        return value;
    }
  }
}
```

### 4.2 DMN 输出 → 流程变量

```typescript
/**
 * DMN 结果处理器
 * 将 DMN 输出设置到流程变量
 */
@Injectable()
export class DmnResultProcessor {
  
  /**
   * 处理 DMN 结果并设置到流程变量
   */
  processResult(execution: DelegateExecution, dmnResult: Map<string, any>, mapping: ResultMapping[]): void {
    for (const map of mapping) {
      const sourceValue = dmnResult.get(map.source);
      const targetValue = this.transformValue(sourceValue, map.transformation);
      
      // 设置到流程变量
      if (map.target.includes('.')) {
        // 嵌套属性设置
        this.setNestedProperty(execution, map.target, targetValue);
      } else {
        execution.setVariable(map.target, targetValue);
      }
    }
  }
  
  /**
   * 设置嵌套属性
   */
  private setNestedProperty(execution: DelegateExecution, path: string, value: any): void {
    const parts = path.split('.');
    const rootVar = parts[0];
    
    let obj = execution.getVariable(rootVar);
    if (!obj) {
      obj = {};
      execution.setVariable(rootVar, obj);
    }
    
    for (let i = 1; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) {
        obj[parts[i]] = {};
      }
      obj = obj[parts[i]];
    }
    
    obj[parts[parts.length - 1]] = value;
  }
}
```

### 4.3 完整数据流示例

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              数据流转完整流程                                             │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              BPMN 流程变量                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐│
│  │  applicant: {                                                                       ││
│  │    name: "张三",                                                                    ││
│  │    income: 50000,                                                                   ││
│  │    creditScore: 720,                                                                ││
│  │    debtRatio: 0.3                                                                   ││
│  │  }                                                                                  ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           │ 变量映射
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              DMN 输入变量                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐│
│  │  income: 50000                                                                      ││
│  │  creditScore: 720                                                                   ││
│  │  debtRatio: 0.3                                                                     ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           │ 规则执行
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              DMN 决策表执行                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐│
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐   ││
│  │  │  Input Clauses              │  Output Clauses                                │   ││
│  │  │  ┌─────────┬─────────┐      │  ┌─────────────┬─────────────┐                │   ││
│  │  │  │ income  │creditScore│    │  │ riskLevel   │ creditLimit │                │   ││
│  │  │  ├─────────┼─────────┤      │  ├─────────────┼─────────────┤                │   ││
│  │  │  │ > 100000│ > 700   │      │  │ LOW         │ 500000      │ Rule 1        │   ││
│  │  │  │ > 50000 │ > 650   │      │  │ LOW         │ 300000      │ Rule 2 ✓      │   ││
│  │  │  │ > 30000 │ > 600   │      │  │ MEDIUM      │ 100000      │ Rule 3        │   ││
│  │  │  │ -       │ -       │      │  │ HIGH        │ 0           │ Rule 4        │   ││
│  │  │  └─────────┴─────────┘      │  └─────────────┴─────────────┘                │   ││
│  │  └─────────────────────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           │ 结果输出
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              DMN 输出结果                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐│
│  │  riskLevel: "LOW"                                                                   ││
│  │  creditLimit: 300000                                                                ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           │ 结果映射
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              BPMN 流程变量（更新后）                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐│
│  │  applicant: { ... },                                                                ││
│  │  riskResult: {                                                                      ││
│  │    riskLevel: "LOW",                                                                ││
│  │    creditLimit: 300000                                                              ││
│  │  }                                                                                  ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           │ 网关判断
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              排他网关路由                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐│
│  │                                                                                      ││
│  │       ┌─────────────────┐                                                          ││
│  │       │   Risk Gateway  │                                                          ││
│  │       └────────┬────────┘                                                          ││
│  │                │                                                                    ││
│  │     ┌──────────┼──────────┐                                                        ││
│  │     │          │          │                                                        ││
│  │     ▼          ▼          ▼                                                        ││
│  │ ┌────────┐ ┌────────┐ ┌────────┐                                                   ││
│  │ │ LOW    │ │ MEDIUM │ │ HIGH   │                                                   ││
│  │ │自动审批 │ │人工审核 │ │ 拒绝   │                                                   ││
│  │ └────────┘ └────────┘ └────────┘                                                   ││
│  │     ✓                                                                            ││
│  │                                                                                      ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 网关与决策结果集成

### 5.1 条件表达式使用决策结果

```xml
<!-- 排他网关使用 DMN 决策结果 -->
<exclusiveGateway id="riskGateway" name="风险判断网关">
  
  <!-- 低风险：自动审批 -->
  <sequenceFlow id="lowRiskFlow" sourceRef="riskGateway" targetRef="autoApprove">
    <conditionExpression xsi:type="tFormalExpression">
      ${riskResult.riskLevel == 'LOW'}
    </conditionExpression>
  </sequenceFlow>
  
  <!-- 中等风险：人工审核 -->
  <sequenceFlow id="mediumRiskFlow" sourceRef="riskGateway" targetRef="manualReview">
    <conditionExpression xsi:type="tFormalExpression">
      ${riskResult.riskLevel == 'MEDIUM'}
    </conditionExpression>
  </sequenceFlow>
  
  <!-- 高风险：拒绝 -->
  <sequenceFlow id="highRiskFlow" sourceRef="riskGateway" targetRef="reject">
    <conditionExpression xsi:type="tFormalExpression">
      ${riskResult.riskLevel == 'HIGH' || riskResult.riskLevel == 'CRITICAL'}
    </conditionExpression>
  </sequenceFlow>
  
</exclusiveGateway>
```

### 5.2 复杂条件表达式

```xml
<!-- 使用多个决策结果字段 -->
<sequenceFlow id="specialApproval" sourceRef="gateway" targetRef="specialApprovalTask">
  <conditionExpression xsi:type="tFormalExpression">
    ${riskResult.riskLevel == 'LOW' && riskResult.creditLimit > 500000}
  </conditionExpression>
</sequenceFlow>

<!-- 使用决策结果的数值比较 -->
<sequenceFlow id="smallLoan" sourceRef="gateway" targetRef="quickApproval">
  <conditionExpression xsi:type="tFormalExpression">
    ${riskResult.creditLimit <= 100000}
  </conditionExpression>
</sequenceFlow>
```

---

## 6. 数据库表设计

### 6.1 DMN 独立表结构

```sql
-- DMN 部署表
CREATE TABLE ACT_DMN_DEPLOYMENT (
    ID_ VARCHAR(64) NOT NULL,
    NAME_ VARCHAR(255),
    CATEGORY_ VARCHAR(255),
    TENANT_ID_ VARCHAR(255),
    DEPLOY_TIME_ DATETIME(3),
    PARENT_DEPLOYMENT_ID_ VARCHAR(64),
    PRIMARY KEY (ID_)
);

-- DMN 决策定义表
CREATE TABLE ACT_DMN_DECISION (
    ID_ VARCHAR(64) NOT NULL,
    NAME_ VARCHAR(255),
    KEY_ VARCHAR(255) NOT NULL,
    VERSION_ INT NOT NULL,
    CATEGORY_ VARCHAR(255),
    DECISION_TYPE_ VARCHAR(255),  -- DECISION_TABLE 或 DECISION_SERVICE
    DEPLOYMENT_ID_ VARCHAR(64),
    TENANT_ID_ VARCHAR(255),
    RESOURCE_NAME_ VARCHAR(255),
    DESCRIPTION_ VARCHAR(1024),
    PRIMARY KEY (ID_),
    UNIQUE KEY ACT_IDX_DMN_DEC_UNIQ (KEY_, VERSION_, TENANT_ID_)
);

-- DMN 历史执行表
CREATE TABLE ACT_DMN_HI_DECISION_EXECUTION (
    ID_ VARCHAR(64) NOT NULL,
    DECISION_DEFINITION_ID_ VARCHAR(64),
    DECISION_KEY_ VARCHAR(255),
    DEPLOYMENT_ID_ VARCHAR(64),
    START_TIME_ DATETIME(3),
    END_TIME_ DATETIME(3),
    INSTANCE_ID_ VARCHAR(64),      -- 关联流程实例 ID
    EXECUTION_ID_ VARCHAR(64),     -- 关联执行 ID
    ACTIVITY_ID_ VARCHAR(255),     -- 关联活动 ID (BusinessRuleTask ID)
    SCOPE_TYPE_ VARCHAR(255),      -- 作用域类型 (BPMN/DMN/CMMN)
    FAILED_ TINYINT DEFAULT 0,
    TENANT_ID_ VARCHAR(255),
    EXECUTION_JSON_ LONGTEXT,      -- 完整的执行审计 JSON
    PRIMARY KEY (ID_),
    INDEX ACT_IDX_DMN_INSTANCE_ID (INSTANCE_ID_),
    INDEX ACT_IDX_DMN_DEC_KEY (DECISION_KEY_)
);
```

### 6.2 与 BPMN 表的关联

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              表关联关系                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────┘

ACT_DMN_HI_DECISION_EXECUTION          ACT_HI_PROCINST
┌─────────────────────────────┐       ┌─────────────────────────────┐
│ ID_                         │       │ ID_                         │
│ DECISION_DEFINITION_ID_     │       │ PROC_DEF_ID_                │
│ DECISION_KEY_               │       │ START_TIME_                 │
│ INSTANCE_ID_  ─────────────────────▶│ END_TIME_                   │
│ EXECUTION_ID_               │       │ ...                         │
│ ACTIVITY_ID_                │       └─────────────────────────────┘
│ ...                         │
└─────────────────────────────┘
         │
         │ INSTANCE_ID_ = ACT_HI_PROCINST.ID_
         │
         └───────────────────────────────────────────────────────────────▶

ACT_RU_EXECUTION
┌─────────────────────────────┐
│ ID_                         │
│ PROC_INST_ID_               │
│ ACT_ID_  ◀────────────────────────── ACTIVITY_ID_ (BusinessRuleTask ID)
│ ...                         │
└─────────────────────────────┘
```

---

## 7. API 设计

### 7.1 独立 DMN API

```typescript
// 独立使用 DMN 引擎的 API
@Controller('dmn')
export class DmnController {
  
  constructor(private readonly dmnDecisionService: DmnDecisionService) {}
  
  /**
   * 执行决策
   */
  @Post('execute')
  async executeDecision(@Body() request: ExecuteDecisionRequest): Promise<ExecuteDecisionResponse> {
    const builder = this.dmnDecisionService.createExecuteDecisionBuilder()
      .decisionKey(request.decisionKey)
      .tenantId(request.tenantId)
      .variables(request.variables);
    
    const results = await this.dmnDecisionService.executeDecision(builder);
    
    return {
      success: true,
      results: results,
    };
  }
  
  /**
   * 执行决策（带审计）
   */
  @Post('execute-with-audit')
  async executeWithAudit(@Body() request: ExecuteDecisionRequest): Promise<ExecuteDecisionWithAuditResponse> {
    const builder = this.dmnDecisionService.createExecuteDecisionBuilder()
      .decisionKey(request.decisionKey)
      .tenantId(request.tenantId)
      .variables(request.variables);
    
    const audit = await this.dmnDecisionService.executeDecisionWithAuditTrail(builder);
    
    return {
      success: !audit.isFailed(),
      decisionName: audit.getDecisionName(),
      results: audit.getDecisionResult(),
      audit: audit,
      duration: audit.getEndTime().getTime() - audit.getStartTime().getTime(),
    };
  }
}
```

### 7.2 流程集成 API

```typescript
// 流程中使用 DMN 的 API
@Controller('process')
export class ProcessController {
  
  constructor(
    private readonly runtimeService: RuntimeService,
    private readonly dmnDecisionService: DmnDecisionService,
  ) {}
  
  /**
   * 启动流程（带决策预览）
   */
  @Post('start-with-decision-preview')
  async startWithDecisionPreview(@Body() request: StartProcessRequest): Promise<StartProcessResponse> {
    // 1. 预览决策结果
    const decisionPreview = await this.dmnDecisionService.createExecuteDecisionBuilder()
      .decisionKey(request.decisionKey)
      .variables(request.variables)
      .executeDecisionWithSingleResult();
    
    // 2. 启动流程（带决策结果作为变量）
    const processInstance = await this.runtimeService.startProcessInstanceByKey(
      request.processDefinitionKey,
      {
        ...request.variables,
        decisionPreview: decisionPreview,
      }
    );
    
    return {
      processInstanceId: processInstance.getId(),
      decisionPreview: decisionPreview,
    };
  }
}
```

---

## 8. 配置示例

### 8.1 完整集成配置

```yaml
# application.yml
flowable:
  # BPMN 引擎配置
  process:
    enabled: true
    database-schema-update: true
    history-level: full
    async-executor-activate: true
    
  # DMN 引擎配置
  dmn:
    enabled: true
    database-schema-update: true
    history-enabled: true
    strict-mode: true
    decision-cache-limit: 500
    
  # 数据源配置
  datasource:
    # BPMN 数据源
    bpmn:
      url: jdbc:mysql://localhost:3306/flowable_bpmn
      username: root
      password: password
      driver-class-name: com.mysql.cj.jdbc.Driver
      
    # DMN 数据源（独立）
    dmn:
      url: jdbc:mysql://localhost:3306/flowable_dmn
      username: root
      password: password
      driver-class-name: com.mysql.cj.jdbc.Driver
```

### 8.2 NestJS 模块配置

```typescript
@Module({
  imports: [
    // DMN 引擎模块（独立）
    DmnEngineModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        database: {
          host: configService.get('DMN_DB_HOST'),
          port: configService.get('DMN_DB_PORT'),
          username: configService.get('DMN_DB_USERNAME'),
          password: configService.get('DMN_DB_PASSWORD'),
          database: configService.get('DMN_DB_DATABASE'),
        },
        historyEnabled: true,
        strictMode: true,
        decisionCacheLimit: 500,
      }),
      inject: [ConfigService],
    }),
    
    // BPMN 引擎模块
    ProcessEngineModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        database: {
          host: configService.get('BPMN_DB_HOST'),
          port: configService.get('BPMN_DB_PORT'),
          username: configService.get('BPMN_DB_USERNAME'),
          password: configService.get('BPMN_DB_PASSWORD'),
          database: configService.get('BPMN_DB_DATABASE'),
        },
        // 注入 DMN 服务用于 BusinessRuleTask
        dmnIntegration: {
          enabled: true,
          decisionService: 'DmnDecisionService',
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

---

## 9. 总结

### 9.1 集成特性总结

| 特性 | 描述 | 状态 |
|------|------|------|
| DMN 独立运行 | DMN 引擎可完全独立运行 | ✓ |
| 独立数据源 | 支持单独的数据源和数据表 | ✓ |
| 独立 DecisionService | 提供独立的决策服务 | ✓ |
| BusinessRuleTask | BPMN 流程中调用决策表 | ✓ |
| decisionRef | 通过决策 Key 引用决策表 | ✓ |
| decisionServiceRef | 通过决策服务 Key 引用 DRD | ✓ |
| 变量映射 | 流程变量 ↔ DMN 输入/输出 | ✓ |
| 网关集成 | 根据决策结果走分支 | ✓ |
| 审计追踪 | 完整的执行过程记录 | ✓ |
| 多租户支持 | 租户隔离的决策执行 | ✓ |

### 9.2 使用场景

1. **纯决策服务**：独立使用 DMN 引擎进行业务规则计算
2. **流程驱动决策**：在 BPMN 流程中通过 BusinessRuleTask 调用决策
3. **混合模式**：流程外预览决策结果，流程中使用决策驱动路由
4. **决策服务编排**：通过 DRD 组合多个决策表形成复杂决策逻辑
