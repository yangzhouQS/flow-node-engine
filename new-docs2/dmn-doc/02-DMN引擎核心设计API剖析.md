# DMN 决策引擎核心设计 API 剖析

## 1. API 概览

### 1.1 服务接口层次结构

```
┌─────────────────────────────────────────────────────────────────────┐
│                           DmnEngine                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      服务接口层                                │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │  │
│  │  │DmnDecisionService│  │DmnRepositoryService│  │DmnHistoryService│ │  │
│  │  │  决策执行服务    │  │  仓库管理服务    │  │  历史服务      │ │  │
│  │  └─────────────────┘  └─────────────────┘  └────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │              DmnManagementService                        │  │  │
│  │  │                 管理服务                                  │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. DmnEngine 接口

### 2.1 接口定义

```java
public interface DmnEngine extends Engine {
    /**
     * Flowable DMN 库版本号
     */
    String VERSION = FlowableVersions.CURRENT_VERSION;

    /**
     * 获取管理服务
     */
    DmnManagementService getDmnManagementService();

    /**
     * 获取仓库服务
     */
    DmnRepositoryService getDmnRepositoryService();

    /**
     * 获取决策服务
     */
    DmnDecisionService getDmnDecisionService();

    /**
     * 获取历史服务
     */
    DmnHistoryService getDmnHistoryService();

    /**
     * 获取引擎配置
     */
    DmnEngineConfiguration getDmnEngineConfiguration();
}
```

### 2.2 实现类

```java
public class DmnEngineImpl implements DmnEngine {
    protected String name;
    protected DmnEngineConfiguration engineConfiguration;
    
    // 服务实例
    protected DmnManagementService managementService;
    protected DmnRepositoryService repositoryService;
    protected DmnDecisionService decisionService;
    protected DmnHistoryService historyService;
    
    public DmnEngineImpl(DmnEngineConfiguration engineConfiguration) {
        this.engineConfiguration = engineConfiguration;
        this.name = engineConfiguration.getEngineName();
        
        // 初始化服务
        this.managementService = engineConfiguration.getDmnManagementService();
        this.repositoryService = engineConfiguration.getDmnRepositoryService();
        this.decisionService = engineConfiguration.getDmnDecisionService();
        this.historyService = engineConfiguration.getDmnHistoryService();
    }
    
    @Override
    public void close() {
        DmnEngines.unregister(this);
    }
    
    @Override
    public String getName() {
        return name;
    }
}
```

---

## 3. DmnDecisionService 接口

### 3.1 接口定义

```java
/**
 * DMN 决策执行服务
 * 提供决策表和决策服务的执行能力
 */
public interface DmnDecisionService {

    /**
     * 创建决策执行构建器
     */
    ExecuteDecisionBuilder createExecuteDecisionBuilder();

    /**
     * 执行决策（单结果模式）
     * @throws FlowableException 当命中多条规则时抛出异常
     */
    Map<String, Object> executeWithSingleResult(ExecuteDecisionBuilder builder);

    /**
     * 执行决策（审计追踪模式）
     */
    DecisionExecutionAuditContainer executeWithAuditTrail(ExecuteDecisionBuilder builder);

    /**
     * 执行单个决策表
     * @return 决策结果列表（每条匹配规则一个结果）
     */
    List<Map<String, Object>> executeDecision(ExecuteDecisionBuilder builder);

    /**
     * 执行决策服务（DRD）
     * @return 按输出决策分组的结果 Map
     */
    Map<String, List<Map<String, Object>>> executeDecisionService(ExecuteDecisionBuilder builder);

    /**
     * 执行单个决策表（单结果模式）
     */
    Map<String, Object> executeDecisionWithSingleResult(ExecuteDecisionBuilder builder);

    /**
     * 执行决策服务（单结果模式）
     */
    Map<String, Object> executeDecisionServiceWithSingleResult(ExecuteDecisionBuilder builder);

    /**
     * 执行单个决策表（审计追踪模式）
     */
    DecisionExecutionAuditContainer executeDecisionWithAuditTrail(ExecuteDecisionBuilder builder);

    /**
     * 执行决策服务（审计追踪模式）
     */
    DecisionServiceExecutionAuditContainer executeDecisionServiceWithAuditTrail(ExecuteDecisionBuilder builder);
}
```

### 3.2 实现类

```java
public class DmnDecisionServiceImpl implements DmnDecisionService {
    
    protected DmnEngineConfiguration engineConfiguration;
    
    public DmnDecisionServiceImpl(DmnEngineConfiguration engineConfiguration) {
        this.engineConfiguration = engineConfiguration;
    }
    
    @Override
    public ExecuteDecisionBuilder createExecuteDecisionBuilder() {
        return new ExecuteDecisionBuilderImpl(engineConfiguration);
    }
    
    @Override
    public List<Map<String, Object>> executeDecision(ExecuteDecisionBuilder builder) {
        return engineConfiguration.getCommandExecutor()
            .execute(new ExecuteDecisionCmd(builder));
    }
    
    @Override
    public Map<String, Object> executeDecisionWithSingleResult(ExecuteDecisionBuilder builder) {
        List<Map<String, Object>> results = executeDecision(builder);
        if (results.size() > 1) {
            throw new FlowableException("Multiple results found, but single result expected");
        }
        return results.isEmpty() ? Collections.emptyMap() : results.get(0);
    }
    
    @Override
    public DecisionExecutionAuditContainer executeDecisionWithAuditTrail(ExecuteDecisionBuilder builder) {
        return engineConfiguration.getCommandExecutor()
            .execute(new ExecuteDecisionWithAuditTrailCmd(builder));
    }
}
```

---

## 4. ExecuteDecisionBuilder 接口

### 4.1 接口定义

```java
/**
 * 决策执行构建器
 * 使用 Builder 模式配置决策执行参数
 */
public interface ExecuteDecisionBuilder {

    // ========== 配置方法 ==========
    
    ExecuteDecisionBuilder decisionKey(String decisionKey);
    ExecuteDecisionBuilder parentDeploymentId(String parentDeploymentId);
    ExecuteDecisionBuilder instanceId(String instanceId);
    ExecuteDecisionBuilder executionId(String executionId);
    ExecuteDecisionBuilder activityId(String activityId);
    ExecuteDecisionBuilder scopeType(String scopeType);
    ExecuteDecisionBuilder tenantId(String tenantId);
    ExecuteDecisionBuilder fallbackToDefaultTenant();
    ExecuteDecisionBuilder variables(Map<String, Object> variables);
    ExecuteDecisionBuilder variable(String variableName, Object value);
    ExecuteDecisionBuilder disableHistory();

    // ========== 执行方法 ==========

    /**
     * @deprecated 使用 executeDecision() 替代
     */
    @Deprecated
    List<Map<String, Object>> execute();

    Map<String, Object> executeWithSingleResult();
    DecisionExecutionAuditContainer executeWithAuditTrail();
    List<Map<String, Object>> executeDecision();
    Map<String, List<Map<String, Object>>> executeDecisionService();
    Map<String, Object> executeDecisionWithSingleResult();
    Map<String, Object> executeDecisionServiceWithSingleResult();
    DecisionExecutionAuditContainer executeDecisionWithAuditTrail();
    DecisionServiceExecutionAuditContainer executeDecisionServiceWithAuditTrail();
    ExecuteDecisionContext buildExecuteDecisionContext();
}
```

### 4.2 实现类

```java
public class ExecuteDecisionBuilderImpl implements ExecuteDecisionBuilder {
    
    protected DmnEngineConfiguration engineConfiguration;
    protected String decisionKey;
    protected String parentDeploymentId;
    protected String instanceId;
    protected String executionId;
    protected String activityId;
    protected String scopeType;
    protected String tenantId;
    protected boolean fallbackToDefaultTenant;
    protected boolean historyEnabled = true;
    protected Map<String, Object> variables = new HashMap<>();
    
    @Override
    public ExecuteDecisionBuilder decisionKey(String decisionKey) {
        this.decisionKey = decisionKey;
        return this;
    }
    
    @Override
    public ExecuteDecisionBuilder variable(String variableName, Object value) {
        this.variables.put(variableName, value);
        return this;
    }
    
    @Override
    public List<Map<String, Object>> executeDecision() {
        return engineConfiguration.getDmnDecisionService().executeDecision(this);
    }
}
```

---

## 5. DmnRepositoryService 接口

### 5.1 接口定义

```java
/**
 * DMN 仓库服务
 * 管理决策定义的部署和查询
 */
public interface DmnRepositoryService {

    DmnDeploymentBuilder createDeployment();
    void deleteDeployment(String deploymentId);
    DmnDecisionQuery createDecisionQuery();
    NativeDecisionQuery createNativeDecisionQuery();
    
    void setDeploymentCategory(String deploymentId, String category);
    void setDeploymentTenantId(String deploymentId, String newTenantId);
    void changeDeploymentParentDeploymentId(String deploymentId, String newParentDeploymentId);
    
    List<String> getDeploymentResourceNames(String deploymentId);
    InputStream getResourceAsStream(String deploymentId, String resourceName);
    
    DmnDeploymentQuery createDeploymentQuery();
    NativeDmnDeploymentQuery createNativeDeploymentQuery();
    
    DmnDecision getDecision(String decisionId);
    InputStream getDmnResource(String decisionId);
    void setDecisionCategory(String decisionId, String category);
    DmnDefinition getDmnDefinition(String decisionId);
    InputStream getDecisionRequirementsDiagram(String decisionId);
}
```

### 5.2 部署构建器

```java
public interface DmnDeploymentBuilder {

    DmnDeploymentBuilder category(String category);
    DmnDeploymentBuilder name(String name);
    DmnDeploymentBuilder addInputStream(String resourceName, InputStream inputStream);
    DmnDeploymentBuilder addClasspathResource(String resource);
    DmnDeploymentBuilder addString(String resourceName, String text);
    DmnDeploymentBuilder addBytes(String resourceName, byte[] bytes);
    DmnDeploymentBuilder tenantId(String tenantId);
    DmnDeploymentBuilder parentDeploymentId(String parentDeploymentId);
    
    DmnDeployment deploy();
}
```

---

## 6. DmnHistoryService 接口

```java
/**
 * DMN 历史服务
 */
public interface DmnHistoryService {

    DmnHistoricDecisionExecutionQuery createHistoricDecisionExecutionQuery();
    void deleteHistoricDecisionExecutionsByQuery(DmnHistoricDecisionExecutionQuery query);
    void bulkDeleteHistoricDecisionExecutionsByInstanceIds(Collection<String> instanceIds, String scopeType);
}
```

---

## 7. DmnManagementService 接口

```java
/**
 * DMN 管理服务
 */
public interface DmnManagementService {

    String getTableName(Class<?> entityClass);
    Object executeCustomSql(String sqlCommandType, String sql);
    DmnEngineConfigurationApi getDmnEngineConfiguration();
}
```

---

## 8. 查询 API

### 8.1 DmnDecisionQuery

```java
public interface DmnDecisionQuery {

    // 查询条件
    DmnDecisionQuery decisionId(String decisionId);
    DmnDecisionQuery decisionKey(String decisionKey);
    DmnDecisionQuery decisionKeys(Set<String> decisionKeys);
    DmnDecisionQuery decisionName(String decisionName);
    DmnDecisionQuery decisionNameLike(String decisionNameLike);
    DmnDecisionQuery decisionType(String decisionType);
    DmnDecisionQuery version(Integer version);
    DmnDecisionQuery latestVersion();
    DmnDecisionQuery deploymentId(String deploymentId);
    DmnDecisionQuery parentDeploymentId(String parentDeploymentId);
    DmnDecisionQuery category(String category);
    DmnDecisionQuery tenantId(String tenantId);
    DmnDecisionQuery decisionWithoutTenantId();

    // 排序
    DmnDecisionQuery orderByDecisionKey();
    DmnDecisionQuery orderByDecisionName();
    DmnDecisionQuery orderByVersion();

    // 结果
    DmnDecision singleResult();
    List<DmnDecision> list();
    List<DmnDecision> listPage(int firstResult, int maxResults);
    long count();
}
```

### 8.2 DmnDeploymentQuery

```java
public interface DmnDeploymentQuery {

    DmnDeploymentQuery deploymentId(String deploymentId);
    DmnDeploymentQuery name(String name);
    DmnDeploymentQuery nameLike(String nameLike);
    DmnDeploymentQuery category(String category);
    DmnDeploymentQuery tenantId(String tenantId);
    
    DmnDeploymentQuery orderByDeploymentId();
    DmnDeploymentQuery orderByDeploymentName();
    DmnDeploymentQuery orderByDeploymentTime();
    
    DmnDeployment singleResult();
    List<DmnDeployment> list();
    long count();
}
```

---

## 9. 审计追踪 API

### 9.1 DecisionExecutionAuditContainer

```java
/**
 * 决策执行审计容器
 */
public class DecisionExecutionAuditContainer {
    
    protected String decisionId;
    protected String decisionName;
    protected String decisionKey;
    protected Date startTime;
    protected Date endTime;
    protected boolean isFailed;
    protected String exceptionMessage;
    protected List<Map<String, Object>> decisionResult;
    protected Map<Integer, RuleExecutionAuditContainer> ruleExecutions;
    
    public void startAudit(Date startTime);
    public void stopAudit(Date endTime);
    public void setFailed();
    public void addRuleEntry(DecisionRule rule);
    public void markRuleValid(int ruleNumber);
}
```

### 9.2 RuleExecutionAuditContainer

```java
/**
 * 规则执行审计容器
 */
public class RuleExecutionAuditContainer {
    
    protected int ruleNumber;
    protected boolean isValid;
    protected String exceptionMessage;
    protected Map<String, ExpressionExecution> inputExecutions;
    protected Map<String, ExpressionExecution> outputExecutions;
}
```

---

## 10. HitPolicy API

### 10.1 HitPolicyBehavior 接口

```java
public interface HitPolicyBehavior {

    String getHitPolicyName();
    boolean shouldContinueEvaluating(boolean ruleResult);
    void evaluateRuleValidity(int ruleNumber, ELExecutionContext executionContext);
    void composeOutput(String outputVariableId, Object executionVariable, ELExecutionContext executionContext);
}
```

### 10.2 行为标记接口

```java
public interface ContinueEvaluatingBehavior {
    boolean shouldContinueEvaluating(boolean ruleResult);
}

public interface EvaluateRuleValidityBehavior {
    void evaluateRuleValidity(int ruleNumber, ELExecutionContext executionContext);
}

public interface ComposeRuleResultBehavior {
    void composeRuleResult(int ruleNumber, String outputName, Object outputValue, ELExecutionContext executionContext);
}

public interface ComposeDecisionResultBehavior {
    void composeDecisionResults(ELExecutionContext executionContext);
}
```

---

## 11. 表达式执行 API

### 11.1 ELExecutionContext

```java
public class ELExecutionContext {
    
    protected Map<String, Object> inputVariables;
    protected Map<String, Object> stackVariables;
    protected Map<Integer, Map<String, Object>> ruleResults;
    protected DecisionExecutionAuditContainer auditContainer;
    
    public void addRuleResult(int ruleNumber, String outputName, Object outputValue);
    public Object getVariable(String variableName);
}
```

### 11.2 ELExpressionExecutor

```java
public class ELExpressionExecutor {

    public static Boolean executeInputExpression(
            InputClause inputClause,
            LiteralExpression inputEntry,
            ExpressionManager expressionManager,
            ELExecutionContext executionContext);
            
    public static Object executeOutputExpression(
            OutputClause outputClause,
            LiteralExpression outputEntry,
            ExpressionManager expressionManager,
            ELExecutionContext executionContext);
}
```

---

## 12. API 一致性分析

### 12.1 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 服务接口 | Dmn + 名词 + Service | DmnDecisionService |
| 查询接口 | Dmn + 实体 + Query | DmnDecisionQuery |
| 构建器接口 | 动作 + Builder | ExecuteDecisionBuilder |
| 命令类 | 动作 + Cmd | ExecuteDecisionCmd |
| 实体接口 | Dmn + 实体名 | DmnDecision |

### 12.2 方法返回值约定

| 场景 | 返回类型 | 说明 |
|------|----------|------|
| 单条查询 | Entity 或 null | singleResult() |
| 列表查询 | List\<Entity\> | list() |
| 分页查询 | List\<Entity\> | listPage(first, max) |
| 计数查询 | long | count() |
| 构建器方法 | Builder 自身 | 链式调用 |

---

## 13. 总结

Flowable DMN API 设计遵循以下原则：

1. **接口分离**：每个服务职责单一，接口清晰
2. **Builder 模式**：复杂操作使用构建器模式，提供流畅 API
3. **查询对象模式**：灵活的查询条件组合
4. **命令模式**：所有操作封装为命令，支持拦截器
5. **审计追踪**：完整的执行过程记录
6. **可扩展性**：支持自定义 HitPolicy、函数委托等
