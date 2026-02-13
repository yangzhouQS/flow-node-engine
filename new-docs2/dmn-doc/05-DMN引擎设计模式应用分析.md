# DMN 决策引擎设计模式应用分析

## 1. 设计模式概览

Flowable DMN 引擎在设计中运用了多种经典设计模式，这些模式的应用使得系统具有良好的可扩展性、可维护性和灵活性。

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DMN 引擎设计模式应用概览                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  创建型模式          结构型模式          行为型模式                  │
│  ──────────          ──────────          ──────────                  │
│  • Builder           • 适配器            • 命令                      │
│  • 工厂方法          • 装饰器            • 策略                      │
│  • 单例              • 代理              • 模板方法                  │
│                                          • 责任链                    │
│                                          • 观察者                    │
│                                          • 迭代器                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 创建型模式

### 2.1 Builder 模式

**应用场景**：构建复杂的决策执行请求

**源码位置**：[`ExecuteDecisionBuilderImpl.java`](modules/flowable-dmn-engine/src/main/java/org/flowable/dmn/engine/impl/ExecuteDecisionBuilderImpl.java)

```java
/**
 * Builder 模式实现
 * 用于构建复杂的决策执行请求
 */
public class ExecuteDecisionBuilderImpl implements ExecuteDecisionBuilder {
    
    protected String decisionKey;
    protected String tenantId;
    protected Map<String, Object> variables = new HashMap<>();
    protected boolean historyEnabled = true;
    
    // 链式调用返回 Builder 自身
    @Override
    public ExecuteDecisionBuilder decisionKey(String decisionKey) {
        this.decisionKey = decisionKey;
        return this;
    }
    
    @Override
    public ExecuteDecisionBuilder variable(String name, Object value) {
        this.variables.put(name, value);
        return this;
    }
    
    @Override
    public ExecuteDecisionBuilder tenantId(String tenantId) {
        this.tenantId = tenantId;
        return this;
    }
    
    // 最终构建方法
    @Override
    public List<Map<String, Object>> executeDecision() {
        return engineConfiguration.getDmnDecisionService().executeDecision(this);
    }
}
```

**使用示例**：

```java
// 使用 Builder 模式构建请求
List<Map<String, Object>> results = decisionService.createExecuteDecisionBuilder()
    .decisionKey("loanApproval")
    .tenantId("finance")
    .variable("income", 50000)
    .variable("creditScore", 720)
    .disableHistory()
    .executeDecision();
```

**优点**：
- 分步构建复杂对象
- 链式调用，代码可读性好
- 参数可选，灵活配置

---

### 2.2 工厂方法模式

**应用场景**：创建不同类型的 HitPolicy 实例

**源码位置**：[`DmnEngineConfiguration.java`](modules/flowable-dmn-engine/src/main/java/org/flowable/dmn/engine/DmnEngineConfiguration.java)

```java
/**
 * 工厂方法模式
 * 创建默认的 HitPolicy 行为实例
 */
public Map<String, AbstractHitPolicy> getDefaultHitPolicyBehaviors() {
    Map<String, AbstractHitPolicy> behaviors = new HashMap<>();
    
    // 工厂方法创建各种 HitPolicy 实例
    behaviors.put("UNIQUE", new HitPolicyUnique());
    behaviors.put("ANY", new HitPolicyAny());
    behaviors.put("FIRST", new HitPolicyFirst());
    behaviors.put("RULE ORDER", new HitPolicyRuleOrder());
    behaviors.put("PRIORITY", new HitPolicyPriority());
    behaviors.put("OUTPUT ORDER", new HitPolicyOutputOrder());
    behaviors.put("COLLECT", new HitPolicyCollect());
    
    return behaviors;
}

// 支持自定义扩展
public void initHitPolicyBehaviors() {
    if (hitPolicyBehaviors == null) {
        hitPolicyBehaviors = getDefaultHitPolicyBehaviors();
    }
    
    // 添加自定义 HitPolicy
    if (customHitPolicyBehaviors != null) {
        hitPolicyBehaviors.putAll(customHitPolicyBehaviors);
    }
}
```

**优点**：
- 集中管理对象创建
- 支持自定义扩展
- 符合开闭原则

---

### 2.3 单例模式

**应用场景**：DMN 引擎实例管理

**源码位置**：[`DmnEngines.java`](modules/flowable-dmn-engine/src/main/java/org/flowable/dmn/engine/DmnEngines.java)

```java
/**
 * 单例模式
 * 管理全局 DMN 引擎实例
 */
public abstract class DmnEngines {

    // 静态实例映射
    protected static Map<String, DmnEngine> dmnEngines = new HashMap<>();
    protected static boolean isInitialized;
    
    // 获取默认引擎实例
    public static DmnEngine getDefaultDmnEngine() {
        return getDmnEngine(NAME_DEFAULT);
    }
    
    // 按名称获取引擎实例
    public static DmnEngine getDmnEngine(String dmnEngineName) {
        if (!isInitialized()) {
            init();
        }
        return dmnEngines.get(dmnEngineName);
    }
    
    // 注册引擎实例
    public static void registerDmnEngine(DmnEngine dmnEngine) {
        dmnEngines.put(dmnEngine.getName(), dmnEngine);
    }
    
    // 注销引擎实例
    public static void unregister(DmnEngine dmnEngine) {
        dmnEngines.remove(dmnEngine.getName());
    }
}
```

**优点**：
- 全局访问点
- 延迟初始化
- 支持多实例（按名称区分）

---

## 3. 结构型模式

### 3.1 适配器模式

**应用场景**：统一不同类型表达式的执行

**源码位置**：[`ELExpressionExecutor.java`](modules/flowable-dmn-engine/src/main/java/org/flowable/dmn/engine/impl/el/ELExpressionExecutor.java)

```java
/**
 * 适配器模式
 * 适配表达式执行器到统一接口
 */
public class ELExpressionExecutor {

    /**
     * 适配输入表达式执行
     * 将不同格式的条件表达式适配为统一的执行方式
     */
    public static Boolean executeInputExpression(
            InputClause inputClause,
            LiteralExpression inputEntry,
            ExpressionManager expressionManager,
            ELExecutionContext executionContext) {
        
        String inputExpression = inputClause.getInputExpression().getText();
        String condition = inputEntry.getText();
        
        // 适配不同类型的条件表达式
        String fullExpression = adaptExpression(inputExpression, condition);
        
        // 统一执行
        Expression expression = expressionManager.createExpression(fullExpression);
        return (Boolean) expression.getValue(executionContext);
    }
    
    /**
     * 适配表达式格式
     */
    private static String adaptExpression(String input, String condition) {
        // 适配比较运算符
        if (condition.startsWith(">") || condition.startsWith("<") || 
            condition.startsWith("==") || condition.startsWith("!=")) {
            return input + " " + condition;
        }
        
        // 适配集合运算符
        if (condition.startsWith("in ") || condition.startsWith("contains")) {
            return condition.replace("input", input);
        }
        
        return condition;
    }
}
```

**优点**：
- 统一接口
- 兼容多种格式
- 易于扩展新的表达式类型

---

### 3.2 装饰器模式

**应用场景**：命令拦截器链

**源码位置**：命令执行拦截器

```java
/**
 * 装饰器模式
 * 命令拦截器链增强命令执行
 */
public abstract class AbstractCommandInterceptor implements CommandInterceptor {
    
    protected CommandInterceptor next;
    
    @Override
    public CommandInterceptor getNext() {
        return next;
    }
    
    @Override
    public void setNext(CommandInterceptor next) {
        this.next = next;
    }
    
    // 子类实现具体的增强逻辑
    public abstract <T> T execute(CommandConfig config, Command<T> command);
}

// 日志拦截器 - 装饰器
public class LogInterceptor extends AbstractCommandInterceptor {
    
    @Override
    public <T> T execute(CommandConfig config, Command<T> command) {
        // 前置增强：记录开始日志
        LOGGER.debug("Executing command: {}", command.getClass().getSimpleName());
        
        try {
            // 执行下一个拦截器或实际命令
            return next.execute(config, command);
        } finally {
            // 后置增强：记录结束日志
            LOGGER.debug("Command executed: {}", command.getClass().getSimpleName());
        }
    }
}

// 事务拦截器 - 装饰器
public class TransactionInterceptor extends AbstractCommandInterceptor {
    
    @Override
    public <T> T execute(CommandConfig config, Command<T> command) {
        // 前置增强：开启事务
        TransactionContext transactionContext = startTransaction();
        
        try {
            T result = next.execute(config, command);
            // 后置增强：提交事务
            commitTransaction(transactionContext);
            return result;
        } catch (Exception e) {
            // 异常增强：回滚事务
            rollbackTransaction(transactionContext);
            throw e;
        }
    }
}
```

**拦截器链示意图**：

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Log      │───▶│ Transaction │───▶│   Schema    │───▶│    Dmn      │
│ Interceptor │    │ Interceptor │    │ Interceptor │    │ CmdInvoker  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
  记录日志           开启/提交事务       Schema 检查        执行命令
```

**优点**：
- 动态添加功能
- 职责分离
- 可配置的拦截器链

---

### 3.3 代理模式

**应用场景**：服务访问代理

```java
/**
 * 代理模式
 * 服务实现通过代理访问实际功能
 */
public class DmnRepositoryServiceImpl implements DmnRepositoryService {
    
    // 代理的配置对象
    protected DmnEngineConfiguration engineConfiguration;
    
    public DmnRepositoryServiceImpl() {
    }
    
    // 代理方法：将调用转发到命令执行器
    @Override
    public DmnDeploymentBuilder createDeployment() {
        return new DmnDeploymentBuilderImpl(engineConfiguration);
    }
    
    @Override
    public void deleteDeployment(String deploymentId) {
        // 通过命令执行器执行（代理）
        engineConfiguration.getCommandExecutor().execute(
            new DeleteDeploymentCmd(deploymentId)
        );
    }
    
    @Override
    public DmnDecisionQuery createDecisionQuery() {
        return new DecisionQueryImpl(engineConfiguration.getCommandExecutor());
    }
}
```

**优点**：
- 控制访问
- 添加额外处理（如事务、日志）
- 隐藏实现细节

---

## 4. 行为型模式

### 4.1 命令模式

**应用场景**：封装所有操作为命令对象

**源码位置**：[`cmd/`](modules/flowable-dmn-engine/src/main/java/org/flowable/dmn/engine/impl/cmd/)

```java
/**
 * 命令接口
 */
public interface Command<T> {
    T execute(CommandContext commandContext);
}

/**
 * 具体命令：执行决策命令
 */
public class ExecuteDecisionCmd extends AbstractExecuteDecisionCmd<List<Map<String, Object>>> {
    
    public ExecuteDecisionCmd(ExecuteDecisionBuilder builder) {
        super(builder);
    }
    
    @Override
    public List<Map<String, Object>> execute(CommandContext commandContext) {
        // 1. 获取决策定义
        Decision decision = getDecision(commandContext);
        
        // 2. 执行决策
        RuleEngineExecutor executor = getRuleEngineExecutor(commandContext);
        DecisionExecutionAuditContainer auditContainer = executor.execute(
            decision, 
            buildExecuteDecisionContext()
        );
        
        // 3. 持久化历史（如果启用）
        if (isHistoryEnabled()) {
            persistHistory(commandContext, auditContainer);
        }
        
        // 4. 返回结果
        return auditContainer.getDecisionResult();
    }
}

/**
 * 命令调用器
 */
public class DmnCommandInvoker extends AbstractCommandInterceptor {
    
    @Override
    public <T> T execute(CommandConfig config, Command<T> command) {
        CommandContext commandContext = Context.getCommandContext();
        
        // 获取 Agenda
        DmnEngineAgenda agenda = getAgenda(commandContext);
        
        // 执行命令
        T result = command.execute(commandContext);
        
        // 执行 Agenda 中的操作
        while (!agenda.isEmpty()) {
            DmnOperation operation = agenda.getNextOperation();
            operation.run();
        }
        
        return result;
    }
}
```

**命令类列表**：

| 命令类 | 功能 |
|--------|------|
| ExecuteDecisionCmd | 执行决策 |
| ExecuteDecisionWithAuditTrailCmd | 执行决策（带审计） |
| DeployCmd | 部署决策 |
| DeleteDeploymentCmd | 删除部署 |
| GetDeploymentDecisionCmd | 获取决策定义 |
| SetDecisionCategoryCmd | 设置分类 |

**优点**：
- 解耦调用者和执行者
- 支持撤销/重做
- 支持事务和拦截器

---

### 4.2 策略模式

**应用场景**：不同的 HitPolicy 执行策略

**源码位置**：[`hitpolicy/`](modules/flowable-dmn-engine/src/main/java/org/flowable/dmn/engine/impl/hitpolicy/)

```java
/**
 * 策略接口
 */
public interface HitPolicyBehavior {
    String getHitPolicyName();
    boolean shouldContinueEvaluating(boolean ruleResult);
    void evaluateRuleValidity(int ruleNumber, ELExecutionContext context);
    void composeOutput(String outputVariableId, Object value, ELExecutionContext context);
}

/**
 * 抽象策略基类
 */
public abstract class AbstractHitPolicy implements HitPolicyBehavior,
        ContinueEvaluatingBehavior, ComposeRuleResultBehavior, ComposeDecisionResultBehavior {
    
    protected boolean multipleResults = false;
    
    // 默认实现
    @Override
    public boolean shouldContinueEvaluating(boolean ruleResult) {
        return true;
    }
}

/**
 * 具体策略：UNIQUE
 */
public class HitPolicyUnique extends AbstractHitPolicy implements EvaluateRuleValidityBehavior {
    
    @Override
    public String getHitPolicyName() {
        return "UNIQUE";
    }
    
    @Override
    public void evaluateRuleValidity(int ruleNumber, ELExecutionContext context) {
        // 检查是否有多条规则匹配
        for (Map.Entry<Integer, RuleExecutionAuditContainer> entry : 
             context.getAuditContainer().getRuleExecutions().entrySet()) {
            if (!entry.getKey().equals(ruleNumber) && entry.getValue().isValid()) {
                throw new FlowableException("HitPolicy UNIQUE violated.");
            }
        }
    }
}

/**
 * 具体策略：FIRST
 */
public class HitPolicyFirst extends AbstractHitPolicy {
    
    @Override
    public String getHitPolicyName() {
        return "FIRST";
    }
    
    @Override
    public boolean shouldContinueEvaluating(boolean ruleResult) {
        // 找到第一个匹配后停止
        return !ruleResult;
    }
}

/**
 * 具体策略：COLLECT
 */
public class HitPolicyCollect extends AbstractHitPolicy {
    
    @Override
    public String getHitPolicyName() {
        return "COLLECT";
    }
    
    // 支持聚合函数
    @Override
    public void composeDecisionResults(ELExecutionContext context) {
        List<Map<String, Object>> results = new ArrayList<>(context.getRuleResults().values());
        
        // 应用聚合函数（SUM, COUNT, MIN, MAX, AVG）
        if (aggregation != null) {
            results = applyAggregation(results, aggregation);
        }
        
        context.getAuditContainer().setDecisionResult(results);
    }
}
```

**策略选择**：

```java
// 在规则执行器中选择策略
protected AbstractHitPolicy getHitPolicyBehavior(HitPolicy hitPolicy) {
    AbstractHitPolicy behavior = hitPolicyBehaviors.get(hitPolicy.getValue());
    
    if (behavior == null) {
        throw new FlowableException("HitPolicy behavior: " + hitPolicy.getValue() + " not configured");
    }
    
    return behavior;
}
```

**优点**：
- 算法可互换
- 易于扩展新策略
- 消除条件语句

---

### 4.3 模板方法模式

**应用场景**：规则执行流程

**源码位置**：[`RuleEngineExecutorImpl.java`](modules/flowable-dmn-engine/src/main/java/org/flowable/dmn/engine/impl/RuleEngineExecutorImpl.java)

```java
/**
 * 模板方法模式
 * 定义规则执行的骨架流程
 */
public class RuleEngineExecutorImpl implements RuleEngineExecutor {

    /**
     * 模板方法：定义执行流程骨架
     */
    @Override
    public DecisionExecutionAuditContainer execute(Decision decision, ExecuteDecisionContext context) {
        // 1. 参数校验
        validateInput(decision);
        
        // 2. 创建执行上下文
        ELExecutionContext executionContext = createExecutionContext(decision, context);
        
        try {
            // 3. 健全性检查（可由子类重写）
            sanityCheck(decision);
            
            // 4. 执行决策表（核心算法，可由子类重写）
            evaluateDecisionTable(decision.getDecisionTable(), executionContext);
            
        } catch (FlowableException fe) {
            // 5. 异常处理
            handleException(executionContext, fe);
        } finally {
            // 6. 清理资源
            cleanup(executionContext);
        }
        
        return executionContext.getAuditContainer();
    }
    
    /**
     * 钩子方法：子类可重写
     */
    protected void sanityCheck(Decision decision) {
        // 默认实现
        DecisionTable table = decision.getDecisionTable();
        if (table.getHitPolicy() == HitPolicy.COLLECT && table.getAggregation() != null) {
            if (table.getOutputs().size() > 1) {
                throw new FlowableException("COLLECT with aggregation supports only single output");
            }
        }
    }
    
    /**
     * 抽象方法：子类必须实现
     */
    protected abstract void evaluateDecisionTable(DecisionTable table, ELExecutionContext context);
}
```

**优点**：
- 复用算法骨架
- 控制扩展点
- 符合好莱坞原则

---

### 4.4 责任链模式

**应用场景**：命令拦截器链

```java
/**
 * 责任链模式
 * 命令拦截器形成处理链
 */
public interface CommandInterceptor {
    
    CommandInterceptor getNext();
    void setNext(CommandInterceptor next);
    
    <T> T execute(CommandConfig config, Command<T> command);
}

/**
 * 构建责任链
 */
public class CommandExecutorImpl implements CommandExecutor {
    
    protected CommandInterceptor first;
    
    public CommandExecutorImpl(CommandConfig config, 
                               List<CommandInterceptor> interceptors,
                               CommandInvoker invoker) {
        
        // 构建拦截器链
        CommandInterceptor previous = null;
        for (CommandInterceptor interceptor : interceptors) {
            if (previous != null) {
                previous.setNext(interceptor);
            } else {
                first = interceptor;
            }
            previous = interceptor;
        }
        
        // 最后连接到调用器
        if (previous != null) {
            previous.setNext(invoker);
        } else {
            first = invoker;
        }
    }
    
    @Override
    public <T> T execute(Command<T> command) {
        return first.execute(config, command);
    }
}
```

**责任链流程**：

```
请求 ──▶ LogInterceptor ──▶ TransactionInterceptor ──▶ DmnCommandInvoker ──▶ 结果
           │                        │                         │
           ▼                        ▼                         ▼
        记录日志               管理事务                   执行命令
```

**优点**：
- 解耦发送者和处理者
- 动态调整链
- 职责分离

---

### 4.5 观察者模式

**应用场景**：引擎生命周期事件

```java
/**
 * 观察者模式
 * 引擎生命周期监听
 */
public interface ProcessEngineLifecycleListener {
    void onEngineBuilt(ProcessEngine engine);
    void onEngineClosed(ProcessEngine engine);
}

/**
 * 被观察者：引擎配置
 */
public class DmnEngineConfiguration extends AbstractBuildableEngineConfiguration<DmnEngine> {
    
    protected List<ProcessEngineLifecycleListener> lifecycleListeners;
    
    @Override
    protected Consumer<DmnEngine> createPostEngineBuildConsumer() {
        return new DmnEnginePostEngineBuildConsumer(lifecycleListeners);
    }
}

/**
 * 消费者：触发事件
 */
public class DmnEnginePostEngineBuildConsumer implements Consumer<DmnEngine> {
    
    protected List<ProcessEngineLifecycleListener> listeners;
    
    @Override
    public void accept(DmnEngine engine) {
        if (listeners != null) {
            for (ProcessEngineLifecycleListener listener : listeners) {
                listener.onEngineBuilt(engine);
            }
        }
    }
}
```

**优点**：
- 解耦事件源和监听器
- 支持多个监听器
- 动态注册/注销

---

### 4.6 迭代器模式

**应用场景**：规则遍历

```java
/**
 * 迭代器模式
 * 遍历决策表中的规则
 */
protected void evaluateDecisionTable(DecisionTable decisionTable, ELExecutionContext context) {
    
    // 获取规则迭代器
    List<DecisionRule> rules = decisionTable.getRules();
    
    // 遍历规则
    for (DecisionRule rule : rules) {
        boolean ruleResult = executeRule(rule, context);
        
        if (ruleResult) {
            // 处理有效规则
            validRuleOutputEntries.put(rule.getRuleNumber(), rule.getOutputEntries());
        }
        
        // 检查是否继续迭代
        if (!getHitPolicyBehavior(decisionTable.getHitPolicy()).shouldContinueEvaluating(ruleResult)) {
            break;  // 提前终止迭代
        }
    }
}
```

**优点**：
- 统一遍历接口
- 隐藏内部结构
- 支持提前终止

---

## 5. 设计模式组合应用

### 5.1 命令模式 + 责任链模式 + 装饰器模式

```
┌─────────────────────────────────────────────────────────────────────┐
│                    命令执行架构                                      │
└─────────────────────────────────────────────────────────────────────┘

  Client                CommandExecutor              Command
    │                        │                          │
    │  execute(command)      │                          │
    ├───────────────────────▶│                          │
    │                        │                          │
    │                   ┌────┴────┐                     │
    │                   │ 责任链  │                     │
    │                   │ + 装饰器│                     │
    │                   └────┬────┘                     │
    │                        │                          │
    │                        ▼                          │
    │              ┌─────────────────┐                  │
    │              │ LogInterceptor  │ ◀── 装饰器1     │
    │              └────────┬────────┘                  │
    │                       │                           │
    │                       ▼                           │
    │              ┌─────────────────┐                  │
    │              │ TxInterceptor   │ ◀── 装饰器2     │
    │              └────────┬────────┘                  │
    │                       │                           │
    │                       ▼                           │
    │              ┌─────────────────┐                  │
    │              │ CommandInvoker  │                  │
    │              └────────┬────────┘                  │
    │                       │                           │
    │                       ▼                           │
    │              ┌─────────────────┐                  │
    │              │ Command.execute │ ◀── 命令模式    │
    │              └─────────────────┘                  │
    │                                                  │
    │◀─────────────────────────────────────────────────┤
    │                    Result                         │
```

### 5.2 策略模式 + 模板方法模式

```
┌─────────────────────────────────────────────────────────────────────┐
│                    规则执行架构                                      │
└─────────────────────────────────────────────────────────────────────┘

  RuleEngineExecutorImpl
           │
           │ 模板方法
           ▼
    ┌──────────────────────────────────────────┐
    │  execute() {                              │
    │    1. validateInput()                     │
    │    2. createExecutionContext()            │
    │    3. sanityCheck()                       │
    │    4. evaluateDecisionTable() ◀── 策略   │
    │    5. handleException()                   │
    │    6. cleanup()                           │
    │  }                                        │
    └──────────────────────────────────────────┘
                          │
                          │ 策略选择
                          ▼
    ┌──────────────────────────────────────────┐
    │          HitPolicyBehavior               │
    ├──────────────────────────────────────────┤
    │  ┌────────────┐  ┌────────────┐          │
    │  │  UNIQUE    │  │   FIRST    │  ...     │
    │  └────────────┘  └────────────┘          │
    └──────────────────────────────────────────┘
```

---

## 6. 设计模式优化建议

### 6.1 当前设计的优点

1. **高内聚低耦合**：各模块职责清晰，通过接口解耦
2. **良好的扩展性**：支持自定义 HitPolicy、拦截器、函数委托
3. **灵活的配置**：通过 Builder 模式提供灵活配置
4. **完整的事务支持**：通过命令模式和责任链实现

### 6.2 可优化点

#### 6.2.1 引入对象池模式

```java
/**
 * 优化建议：对象池模式
 * 复用执行上下文对象，减少 GC 压力
 */
public class ELExecutionContextPool {
    
    private final Queue<ELExecutionContext> pool = new ConcurrentLinkedQueue<>();
    
    public ELExecutionContext borrowObject() {
        ELExecutionContext context = pool.poll();
        if (context == null) {
            context = new ELExecutionContext();
        }
        return context;
    }
    
    public void returnObject(ELExecutionContext context) {
        context.reset();  // 清理状态
        pool.offer(context);
    }
}
```

#### 6.2.2 引入享元模式

```java
/**
 * 优化建议：享元模式
 * 共享不可变的表达式编译结果
 */
public class ExpressionFlyweight {
    
    private final Map<String, CompiledExpression> cache = new ConcurrentHashMap<>();
    
    public CompiledExpression getCompiledExpression(String expression) {
        return cache.computeIfAbsent(expression, this::compile);
    }
    
    private CompiledExpression compile(String expression) {
        // 编译表达式并缓存
        return new CompiledExpression(expression);
    }
}
```

#### 6.2.3 引入备忘录模式

```java
/**
 * 优化建议：备忘录模式
 * 支持决策执行的快照和恢复
 */
public class DecisionExecutionMemento {
    
    private final Map<String, Object> variablesSnapshot;
    private final List<Map<String, Object>> intermediateResults;
    
    public void save(ELExecutionContext context) {
        this.variablesSnapshot = new HashMap<>(context.getStackVariables());
        this.intermediateResults = new ArrayList<>(context.getRuleResults().values());
    }
    
    public void restore(ELExecutionContext context) {
        context.getStackVariables().clear();
        context.getStackVariables().putAll(variablesSnapshot);
    }
}
```

---

## 7. 总结

### 7.1 设计模式应用统计

| 模式类型 | 模式名称 | 应用场景 | 评价 |
|----------|----------|----------|------|
| 创建型 | Builder | 决策执行构建器 | ★★★★★ |
| 创建型 | 工厂方法 | HitPolicy 创建 | ★★★★★ |
| 创建型 | 单例 | 引擎实例管理 | ★★★★☆ |
| 结构型 | 适配器 | 表达式执行适配 | ★★★★☆ |
| 结构型 | 装饰器 | 命令拦截器 | ★★★★★ |
| 结构型 | 代理 | 服务访问代理 | ★★★★☆ |
| 行为型 | 命令 | 操作封装 | ★★★★★ |
| 行为型 | 策略 | HitPolicy 实现 | ★★★★★ |
| 行为型 | 模板方法 | 规则执行流程 | ★★★★★ |
| 行为型 | 责任链 | 拦截器链 | ★★★★★ |
| 行为型 | 观察者 | 生命周期事件 | ★★★★☆ |
| 行为型 | 迭代器 | 规则遍历 | ★★★★☆ |

### 7.2 设计原则遵循

- **单一职责原则 (SRP)**：每个类职责单一
- **开闭原则 (OCP)**：通过策略模式支持扩展
- **里氏替换原则 (LSP)**：接口实现可替换
- **接口隔离原则 (ISP)**：接口粒度合理
- **依赖倒置原则 (DIP)**：依赖抽象而非具体
