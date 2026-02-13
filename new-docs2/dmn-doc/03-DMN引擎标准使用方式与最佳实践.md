# DMN 决策引擎标准使用方式与最佳实践

## 1. 引擎初始化配置

### 1.1 基础配置示例

```java
// 方式一：使用默认配置文件
DmnEngine dmnEngine = DmnEngines.getDefaultDmnEngine();

// 方式二：从指定配置文件创建
DmnEngineConfiguration configuration = DmnEngineConfiguration
    .createDmnEngineConfigurationFromResource("custom.dmn.cfg.xml");
DmnEngine dmnEngine = configuration.buildDmnEngine();

// 方式三：编程式配置（推荐用于生产环境）
DmnEngineConfiguration configuration = new StandaloneDmnEngineConfiguration()
    .setJdbcUrl("jdbc:mysql://localhost:3306/flowable_dmn")
    .setJdbcDriver("com.mysql.cj.jdbc.Driver")
    .setJdbcUsername("root")
    .setJdbcPassword("password")
    .setDatabaseSchemaUpdate("true")
    .setHistoryEnabled(true)
    .setStrictMode(true);

DmnEngine dmnEngine = configuration.buildDmnEngine();
```

### 1.2 完整配置示例

```java
// 完整的生产环境配置
DmnEngineConfiguration configuration = new StandaloneDmnEngineConfiguration();

// 数据源配置
configuration.setJdbcUrl("jdbc:mysql://localhost:3306/flowable_dmn?useSSL=false&serverTimezone=UTC");
configuration.setJdbcDriver("com.mysql.cj.jdbc.Driver");
configuration.setJdbcUsername("flowable");
configuration.setJdbcPassword("secure_password");
configuration.setDatabaseType("mysql");
configuration.setDatabaseSchemaUpdate("true");

// 连接池配置
configuration.setJdbcMaxActiveConnections(30);
configuration.setJdbcMaxIdleConnections(10);
configuration.setJdbcMaxCheckoutTime(30000);
configuration.setJdbcMaxWaitTime(10000);
configuration.setJdbcPingEnabled(true);
configuration.setJdbcPingConnectionNotUsedFor(3600000);

// 历史记录配置
configuration.setHistoryEnabled(true);

// 决策缓存配置
configuration.setDecisionCacheLimit(500);

// 严格模式（生产环境建议开启）
configuration.setStrictMode(true);

// 安全配置
configuration.setEnableSafeDmnXml(true);

// 构建引擎
DmnEngine dmnEngine = configuration.buildDmnEngine();
```

### 1.3 使用 HikariCP 连接池

```java
// 使用 HikariCP 连接池（推荐）
HikariConfig hikariConfig = new HikariConfig();
hikariConfig.setJdbcUrl("jdbc:mysql://localhost:3306/flowable_dmn");
hikariConfig.setUsername("flowable");
hikariConfig.setPassword("secure_password");
hikariConfig.setMaximumPoolSize(20);
hikariConfig.setMinimumIdle(5);
hikariConfig.setIdleTimeout(300000);
hikariConfig.setConnectionTimeout(20000);

HikariDataSource dataSource = new HikariDataSource(hikariConfig);

DmnEngineConfiguration configuration = new StandaloneDmnEngineConfiguration()
    .setDataSource(dataSource)
    .setDatabaseSchemaUpdate("true")
    .setHistoryEnabled(true);

DmnEngine dmnEngine = configuration.buildDmnEngine();
```

### 1.4 多租户配置

```java
// 多租户配置示例
DmnEngineConfiguration configuration = new StandaloneDmnEngineConfiguration()
    .setDataSource(dataSource)
    .setHistoryEnabled(true);

// 默认租户
configuration.setDmnEngineName("default");

DmnEngine dmnEngine = configuration.buildDmnEngine();

// 使用租户 ID 执行决策
dmnEngine.getDmnDecisionService()
    .createExecuteDecisionBuilder()
    .decisionKey("loanApproval")
    .tenantId("tenant_001")
    .variable("income", 50000)
    .executeDecision();
```

---

## 2. 部署决策表

### 2.1 从文件部署

```java
DmnRepositoryService repositoryService = dmnEngine.getDmnRepositoryService();

// 从类路径部署
DmnDeployment deployment = repositoryService.createDeployment()
    .name("贷款审批规则")
    .category("finance")
    .addClasspathResource("dmn/loan-approval.dmn")
    .tenantId("finance_dept")
    .deploy();

System.out.println("部署成功，ID: " + deployment.getId());
```

### 2.2 从输入流部署

```java
// 从输入流部署（适用于动态生成或从数据库读取）
InputStream dmnStream = new FileInputStream("/path/to/decision.dmn");

DmnDeployment deployment = repositoryService.createDeployment()
    .name("动态决策表")
    .addInputStream("dynamic-decision.dmn", dmnStream)
    .deploy();

dmnStream.close();
```

### 2.3 从字符串部署

```java
// 从 XML 字符串部署
String dmnXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
    "<definitions xmlns=\"http://www.omg.org/spec/DMN/20151101/dmn.xsd\">" +
    // ... DMN XML 内容
    "</definitions>";

DmnDeployment deployment = repositoryService.createDeployment()
    .name("字符串决策表")
    .addString("string-decision.dmn", dmnXml)
    .deploy();
```

### 2.4 批量部署

```java
// 批量部署多个决策表
DmnDeployment deployment = repositoryService.createDeployment()
    .name("金融规则包")
    .category("finance")
    .addClasspathResource("dmn/loan-approval.dmn")
    .addClasspathResource("dmn/risk-assessment.dmn")
    .addClasspathResource("dmn/credit-score.dmn")
    .tenantId("finance_dept")
    .deploy();
```

---

## 3. 执行决策

### 3.1 基础执行

```java
DmnDecisionService decisionService = dmnEngine.getDmnDecisionService();

// 准备输入变量
Map<String, Object> variables = new HashMap<>();
variables.put("age", 35);
variables.put("income", 50000);
variables.put("creditScore", 720);

// 执行决策
List<Map<String, Object>> results = decisionService.createExecuteDecisionBuilder()
    .decisionKey("loanApproval")
    .variables(variables)
    .executeDecision();

// 处理结果
for (Map<String, Object> result : results) {
    System.out.println("审批结果: " + result.get("approvalStatus"));
    System.out.println("额度: " + result.get("creditLimit"));
}
```

### 3.2 链式调用

```java
// 使用链式调用（推荐）
List<Map<String, Object>> results = decisionService.createExecuteDecisionBuilder()
    .decisionKey("loanApproval")
    .tenantId("finance_dept")
    .variable("age", 35)
    .variable("income", 50000)
    .variable("creditScore", 720)
    .variable("employmentYears", 5)
    .executeDecision();
```

### 3.3 单结果模式

```java
// 期望只有一个结果（适用于 HitPolicy = UNIQUE）
try {
    Map<String, Object> result = decisionService.createExecuteDecisionBuilder()
        .decisionKey("uniqueDecision")
        .variable("input", 100)
        .executeDecisionWithSingleResult();
    
    System.out.println("结果: " + result);
    
} catch (FlowableException e) {
    // 多条规则匹配时抛出异常
    System.err.println("决策结果不唯一: " + e.getMessage());
}
```

### 3.4 审计追踪模式

```java
// 获取完整的审计追踪信息
DecisionExecutionAuditContainer audit = decisionService.createExecuteDecisionBuilder()
    .decisionKey("loanApproval")
    .variable("age", 35)
    .variable("income", 50000)
    .executeDecisionWithAuditTrail();

// 检查执行状态
if (audit.isFailed()) {
    System.err.println("决策执行失败: " + audit.getExceptionMessage());
} else {
    System.out.println("决策名称: " + audit.getDecisionName());
    System.out.println("执行时间: " + (audit.getEndTime().getTime() - audit.getStartTime().getTime()) + "ms");
    System.out.println("结果数量: " + audit.getDecisionResult().size());
    
    // 查看每条规则的执行情况
    for (Map.Entry<Integer, RuleExecutionAuditContainer> entry : audit.getRuleExecutions().entrySet()) {
        RuleExecutionAuditContainer ruleAudit = entry.getValue();
        System.out.println("规则 " + entry.getKey() + ": " + (ruleAudit.isValid() ? "匹配" : "不匹配"));
    }
}
```

### 3.5 禁用历史记录

```java
// 对于高频调用场景，可以禁用历史记录以提升性能
List<Map<String, Object>> results = decisionService.createExecuteDecisionBuilder()
    .decisionKey("highFrequencyDecision")
    .variable("input", value)
    .disableHistory()
    .executeDecision();
```

---

## 4. 查询决策定义

### 4.1 查询最新版本

```java
DmnRepositoryService repositoryService = dmnEngine.getDmnRepositoryService();

// 查询最新版本的决策定义
DmnDecision decision = repositoryService.createDecisionQuery()
    .decisionKey("loanApproval")
    .latestVersion()
    .singleResult();

System.out.println("决策名称: " + decision.getName());
System.out.println("版本: " + decision.getVersion());
```

### 4.2 按条件查询

```java
// 按租户查询
List<DmnDecision> decisions = repositoryService.createDecisionQuery()
    .decisionKey("loanApproval")
    .tenantId("finance_dept")
    .list();

// 按部署查询
List<DmnDecision> decisions = repositoryService.createDecisionQuery()
    .deploymentId("deployment_001")
    .orderByVersion()
    .desc()
    .list();

// 按分类查询
List<DmnDecision> decisions = repositoryService.createDecisionQuery()
    .category("finance")
    .list();
```

### 4.3 分页查询

```java
// 分页查询
List<DmnDecision> decisions = repositoryService.createDecisionQuery()
    .decisionNameLike("%审批%")
    .orderByDecisionName()
    .asc()
    .listPage(0, 10);

long total = repositoryService.createDecisionQuery()
    .decisionNameLike("%审批%")
    .count();
```

---

## 5. 历史记录管理

### 5.1 查询历史执行记录

```java
DmnHistoryService historyService = dmnEngine.getDmnHistoryService();

// 查询指定决策的执行历史
List<DmnHistoricDecisionExecution> executions = historyService
    .createHistoricDecisionExecutionQuery()
    .decisionDefinitionKey("loanApproval")
    .orderByStartTime()
    .desc()
    .list();

for (DmnHistoricDecisionExecution execution : executions) {
    System.out.println("执行时间: " + execution.getStartTime());
    System.out.println("是否失败: " + execution.isFailed());
}
```

### 5.2 查询失败的执行

```java
// 查询失败的执行记录
List<DmnHistoricDecisionExecution> failedExecutions = historyService
    .createHistoricDecisionExecutionQuery()
    .failed(true)
    .list();
```

### 5.3 删除历史记录

```java
// 按查询条件删除
historyService.deleteHistoricDecisionExecutionsByQuery(
    historyService.createHistoricDecisionExecutionQuery()
        .decisionDefinitionKey("oldDecision")
);

// 批量删除（按实例 ID）
List<String> instanceIds = Arrays.asList("instance_1", "instance_2", "instance_3");
historyService.bulkDeleteHistoricDecisionExecutionsByInstanceIds(instanceIds, "BPMN");
```

---

## 6. 最佳实践

### 6.1 决策表设计原则

```
┌─────────────────────────────────────────────────────────────────────┐
│                      决策表设计最佳实践                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. 单一职责原则                                                     │
│     - 每个决策表只负责一个业务决策                                   │
│     - 避免在一个决策表中处理多个不相关的业务逻辑                     │
│                                                                      │
│  2. 输入变量命名规范                                                 │
│     - 使用有意义的变量名（如：customerAge 而非 a1）                  │
│     - 保持命名风格一致（驼峰命名）                                   │
│                                                                      │
│  3. 规则顺序优化                                                     │
│     - 将最可能匹配的规则放在前面                                     │
│     - 对于 FIRST HitPolicy，规则顺序尤为重要                         │
│                                                                      │
│  4. 合理选择 HitPolicy                                               │
│     - UNIQUE: 确保只有一个结果（如等级判定）                         │
│     - FIRST: 按优先级返回第一个匹配（如风险等级）                    │
│     - COLLECT: 收集所有匹配结果（如标签匹配）                        │
│                                                                      │
│  5. 使用注释                                                         │
│     - 为决策表添加描述性名称                                         │
│     - 为规则添加注释说明业务含义                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 性能优化建议

```java
// 1. 使用缓存（默认开启）
// 确保决策定义缓存配置合理
configuration.setDecisionCacheLimit(500);

// 2. 批量操作使用批量 API
// 避免在循环中单独调用
List<Map<String, Object>> allResults = new ArrayList<>();
Map<String, Object> batchVariables = prepareVariables();

// 3. 高频调用禁用历史
decisionService.createExecuteDecisionBuilder()
    .decisionKey("highFrequency")
    .disableHistory()
    .executeDecision();

// 4. 使用连接池
// 配置合理的连接池大小
configuration.setJdbcMaxActiveConnections(30);

// 5. 定期清理历史数据
// 建议定期执行清理任务
@Scheduled(cron = "0 0 2 * * ?")  // 每天凌晨2点执行
public void cleanupHistory() {
    Date cutoffDate = DateUtils.addMonths(new Date(), -3);  // 保留3个月
    historyService.deleteHistoricDecisionExecutionsByQuery(
        historyService.createHistoricDecisionExecutionQuery()
            .endTimeBefore(cutoffDate)
    );
}
```

### 6.3 异常处理

```java
public class DecisionService {
    
    private static final Logger LOGGER = LoggerFactory.getLogger(DecisionService.class);
    
    public Map<String, Object> executeDecisionSafely(String decisionKey, Map<String, Object> variables) {
        try {
            List<Map<String, Object>> results = dmnEngine.getDmnDecisionService()
                .createExecuteDecisionBuilder()
                .decisionKey(decisionKey)
                .variables(variables)
                .executeDecision();
            
            if (results.isEmpty()) {
                LOGGER.warn("决策 {} 没有匹配任何规则", decisionKey);
                return Collections.emptyMap();
            }
            
            return results.get(0);
            
        } catch (FlowableException e) {
            LOGGER.error("决策执行失败: key={}, error={}", decisionKey, e.getMessage());
            throw new BusinessException("决策执行失败: " + e.getMessage(), e);
            
        } catch (Exception e) {
            LOGGER.error("决策执行异常: key={}", decisionKey, e);
            throw new BusinessException("系统异常", e);
        }
    }
}
```

### 6.4 测试策略

```java
/**
 * 决策表单元测试示例
 */
public class LoanApprovalDecisionTest {
    
    private static DmnEngine dmnEngine;
    private static DmnDecisionService decisionService;
    
    @BeforeAll
    static void setup() {
        // 使用内存数据库进行测试
        DmnEngineConfiguration configuration = new StandaloneInMemDmnEngineConfiguration();
        dmnEngine = configuration.buildDmnEngine();
        decisionService = dmnEngine.getDmnDecisionService();
        
        // 部署测试决策表
        dmnEngine.getDmnRepositoryService().createDeployment()
            .addClasspathResource("dmn/loan-approval.dmn")
            .deploy();
    }
    
    @Test
    @DisplayName("高收入客户应获得批准")
    void testHighIncomeApproval() {
        Map<String, Object> result = decisionService.createExecuteDecisionBuilder()
            .decisionKey("loanApproval")
            .variable("income", 100000)
            .variable("creditScore", 750)
            .executeDecisionWithSingleResult();
        
        assertEquals("APPROVED", result.get("status"));
        assertTrue((Double) result.get("creditLimit") >= 50000);
    }
    
    @Test
    @DisplayName("低信用分应被拒绝")
    void testLowCreditScoreRejection() {
        Map<String, Object> result = decisionService.createExecuteDecisionBuilder()
            .decisionKey("loanApproval")
            .variable("income", 50000)
            .variable("creditScore", 500)
            .executeDecisionWithSingleResult();
        
        assertEquals("REJECTED", result.get("status"));
    }
    
    @Test
    @DisplayName("边界条件测试")
    void testBoundaryConditions() {
        // 测试边界值
        Map<String, Object> result = decisionService.createExecuteDecisionBuilder()
            .decisionKey("loanApproval")
            .variable("income", 50000)  // 边界值
            .variable("creditScore", 600)  // 边界值
            .executeDecisionWithSingleResult();
        
        assertNotNull(result);
    }
}
```

---

## 7. 典型业务场景

### 7.1 贷款审批场景

```java
/**
 * 贷款审批决策服务
 */
@Service
public class LoanApprovalService {
    
    private final DmnDecisionService decisionService;
    
    public LoanApprovalResult evaluateLoan(LoanApplication application) {
        // 准备输入变量
        Map<String, Object> variables = new HashMap<>();
        variables.put("income", application.getAnnualIncome());
        variables.put("creditScore", application.getCreditScore());
        variables.put("debtRatio", application.getDebtRatio());
        variables.put("employmentYears", application.getEmploymentYears());
        variables.put("loanAmount", application.getRequestedAmount());
        
        // 执行决策（带审计）
        DecisionExecutionAuditContainer audit = decisionService
            .createExecuteDecisionBuilder()
            .decisionKey("loanApproval")
            .tenantId(application.getBranchCode())
            .instanceId(application.getId())
            .variables(variables)
            .executeDecisionWithAuditTrail();
        
        // 处理结果
        LoanApprovalResult result = new LoanApprovalResult();
        if (audit.isFailed()) {
            result.setStatus("ERROR");
            result.setMessage(audit.getExceptionMessage());
        } else {
            Map<String, Object> decisionResult = audit.getDecisionResult().get(0);
            result.setStatus((String) decisionResult.get("status"));
            result.setCreditLimit((Double) decisionResult.get("creditLimit"));
            result.setInterestRate((Double) decisionResult.get("interestRate"));
            result.setAuditTrail(audit);
        }
        
        return result;
    }
}
```

### 7.2 动态定价场景

```java
/**
 * 动态定价决策服务
 */
@Service
public class DynamicPricingService {
    
    /**
     * 计算产品价格
     * 高频调用，禁用历史记录
     */
    public BigDecimal calculatePrice(Product product, Customer customer, MarketCondition market) {
        Map<String, Object> result = decisionService.createExecuteDecisionBuilder()
            .decisionKey("dynamicPricing")
            .variable("basePrice", product.getBasePrice())
            .variable("customerLevel", customer.getLevel())
            .variable("inventoryLevel", product.getInventoryLevel())
            .variable("competitorPrice", market.getCompetitorPrice())
            .variable("demandFactor", market.getDemandFactor())
            .disableHistory()  // 高频调用禁用历史
            .executeDecisionWithSingleResult();
        
        return new BigDecimal(result.get("finalPrice").toString());
    }
}
```

### 7.3 风险评估场景

```java
/**
 * 风险评估决策服务
 */
@Service
public class RiskAssessmentService {
    
    /**
     * 评估交易风险
     * 使用审计追踪记录完整评估过程
     */
    public RiskAssessmentResult assessRisk(Transaction transaction) {
        DecisionExecutionAuditContainer audit = decisionService
            .createExecuteDecisionBuilder()
            .decisionKey("riskAssessment")
            .variable("amount", transaction.getAmount())
            .variable("transactionType", transaction.getType())
            .variable("customerRiskLevel", transaction.getCustomerRiskLevel())
            .variable("location", transaction.getLocation())
            .variable("timeOfDay", LocalTime.now().getHour())
            .executeDecisionWithAuditTrail();
        
        RiskAssessmentResult result = new RiskAssessmentResult();
        result.setAuditId(audit.getDecisionId());
        
        if (!audit.isFailed() && !audit.getDecisionResult().isEmpty()) {
            Map<String, Object> decision = audit.getDecisionResult().get(0);
            result.setRiskLevel((String) decision.get("riskLevel"));
            result.setRiskScore((Integer) decision.get("riskScore"));
            result.setRequiresReview((Boolean) decision.get("requiresReview"));
            result.setMatchedRules(extractMatchedRules(audit));
        }
        
        return result;
    }
    
    private List<Integer> extractMatchedRules(DecisionExecutionAuditContainer audit) {
        return audit.getRuleExecutions().entrySet().stream()
            .filter(e -> e.getValue().isValid())
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
    }
}
```

---

## 8. 集成模式

### 8.1 Spring Boot 集成

```java
@Configuration
public class DmnEngineConfiguration {
    
    @Bean
    public DmnEngine dmnEngine(DataSource dataSource) {
        return new StandaloneDmnEngineConfiguration()
            .setDataSource(dataSource)
            .setDatabaseSchemaUpdate("true")
            .setHistoryEnabled(true)
            .setStrictMode(true)
            .buildDmnEngine();
    }
    
    @Bean
    public DmnDecisionService dmnDecisionService(DmnEngine dmnEngine) {
        return dmnEngine.getDmnDecisionService();
    }
    
    @Bean
    public DmnRepositoryService dmnRepositoryService(DmnEngine dmnEngine) {
        return dmnEngine.getDmnRepositoryService();
    }
}
```

### 8.2 与 BPMN 流程集成

```java
/**
 * 在流程中调用决策引擎
 * BusinessRuleTask 会自动调用 DMN 决策
 */
@Service
public class ProcessDecisionService {
    
    @Autowired
    private RuntimeService runtimeService;
    
    public void startProcessWithDecision(String processDefinitionKey, Map<String, Object> variables) {
        // 启动流程，流程中的 BusinessRuleTask 会自动执行 DMN 决策
        ProcessInstance instance = runtimeService.startProcessInstanceByKey(
            processDefinitionKey, 
            variables
        );
        
        // 决策结果会自动存储到流程变量中
        Map<String, Object> processVariables = runtimeService.getVariables(instance.getId());
        Object decisionResult = processVariables.get("decisionResult");
    }
}
```

---

## 9. 监控与运维

### 9.1 健康检查

```java
@Component
public class DmnEngineHealthIndicator implements HealthIndicator {
    
    private final DmnEngine dmnEngine;
    
    @Override
    public Health health() {
        try {
            // 检查引擎状态
            DmnManagementService managementService = dmnEngine.getDmnManagementService();
            
            // 执行简单查询验证数据库连接
            long decisionCount = dmnEngine.getDmnRepositoryService()
                .createDecisionQuery()
                .count();
            
            return Health.up()
                .withDetail("engineName", dmnEngine.getName())
                .withDetail("decisionCount", decisionCount)
                .build();
                
        } catch (Exception e) {
            return Health.down()
                .withException(e)
                .build();
        }
    }
}
```

### 9.2 性能监控

```java
@Aspect
@Component
public class DmnPerformanceMonitor {
    
    private static final Logger LOGGER = LoggerFactory.getLogger(DmnPerformanceMonitor.class);
    
    @Around("execution(* org.flowable.dmn.api.DmnDecisionService.execute*(..))")
    public Object monitorDecisionExecution(ProceedingJoinPoint pjp) throws Throwable {
        long startTime = System.currentTimeMillis();
        
        try {
            Object result = pjp.proceed();
            long duration = System.currentTimeMillis() - startTime;
            
            LOGGER.info("决策执行完成: method={}, duration={}ms", 
                pjp.getSignature().getName(), duration);
            
            // 记录到监控系统
            Metrics.timer("dmn.execution.time")
                .record(duration, TimeUnit.MILLISECONDS);
            
            return result;
            
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            LOGGER.error("决策执行失败: method={}, duration={}ms, error={}", 
                pjp.getSignature().getName(), duration, e.getMessage());
            throw e;
        }
    }
}
```

---

## 10. 总结

### 10.1 推荐使用模式

| 场景 | 推荐模式 | 说明 |
|------|----------|------|
| 普通业务决策 | executeDecision() | 返回所有匹配结果 |
| 唯一结果场景 | executeDecisionWithSingleResult() | 自动校验唯一性 |
| 需要审计追踪 | executeDecisionWithAuditTrail() | 完整执行过程记录 |
| 高频调用 | disableHistory() | 禁用历史提升性能 |
| 多租户环境 | tenantId() | 隔离不同租户数据 |

### 10.2 关键注意事项

1. **资源管理**：确保 DmnEngine 在应用关闭时正确关闭
2. **异常处理**：捕获并处理 FlowableException
3. **历史清理**：定期清理历史数据避免表膨胀
4. **性能优化**：合理配置缓存和连接池
5. **测试覆盖**：为关键决策表编写单元测试
