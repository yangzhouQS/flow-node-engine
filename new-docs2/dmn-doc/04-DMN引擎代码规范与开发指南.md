# DMN 决策引擎代码规范与开发指南

## 1. 命名规范

### 1.1 包命名规范

```
org.flowable.dmn.engine          # 引擎核心包
org.flowable.dmn.api             # API 接口包
org.flowable.dmn.engine.impl     # 实现包
org.flowable.dmn.engine.impl.cmd # 命令实现
org.flowable.dmn.engine.impl.hitpolicy # 命中策略实现
org.flowable.dmn.engine.impl.el  # 表达式语言实现
org.flowable.dmn.engine.impl.persistence.entity # 持久化实体
```

### 1.2 类命名规范

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 引擎接口 | Dmn + 名词 + Engine | DmnEngine |
| 服务接口 | Dmn + 名词 + Service | DmnDecisionService |
| 服务实现 | 服务接口名 + Impl | DmnDecisionServiceImpl |
| 查询接口 | Dmn + 实体 + Query | DmnDecisionQuery |
| 查询实现 | 查询接口名 + Impl | DmnDecisionQueryImpl |
| 构建器 | 动作 + Builder | ExecuteDecisionBuilder |
| 命令类 | 动作 + Cmd | ExecuteDecisionCmd |
| 实体接口 | Dmn + 实体名 | DmnDecision |
| 实体实现 | 实体接口名 + Impl | DmnDecisionImpl |
| 数据管理器 | 实体 + DataManager | DecisionDataManager |
| 数据管理器实现 | Mybatis + 实体 + DataManager | MybatisDecisionDataManager |
| HitPolicy | HitPolicy + 策略名 | HitPolicyUnique |
| 异常类 | Flowable + Dmn + 异常类型 | FlowableDmnExpressionException |

### 1.3 方法命名规范

| 操作类型 | 前缀 | 示例 |
|----------|------|------|
| 查询单个 | get | getDecision() |
| 查询列表 | find/query | createDecisionQuery() |
| 创建 | create | createDeployment() |
| 删除 | delete | deleteDeployment() |
| 更新 | update/set | setDecisionCategory() |
| 执行 | execute | executeDecision() |
| 构建 | build | buildDmnEngine() |
| 初始化 | init | initHitPolicyBehaviors() |
| 验证 | validate/evaluate | evaluateRuleValidity() |

### 1.4 变量命名规范

```java
// 常量：全大写，下划线分隔
public static final String DEFAULT_MYBATIS_MAPPING_FILE = "org/flowable/dmn/db/mapping/mappings.xml";
public static final String NAME_DEFAULT = "default";

// 成员变量：驼峰命名
protected DmnDecisionService decisionService;
protected Map<String, AbstractHitPolicy> hitPolicyBehaviors;

// 局部变量：驼峰命名，简洁明了
String decisionKey = builder.getDecisionKey();
List<Map<String, Object>> results = new ArrayList<>();

// 布尔变量：使用 is/has/can 前缀
boolean isFailed = auditContainer.isFailed();
boolean hasResults = !results.isEmpty();
boolean canContinue = hitPolicy.shouldContinueEvaluating(ruleResult);
```

---

## 2. 注释规范

### 2.1 类注释

```java
/**
 * DMN 决策执行服务
 * 
 * <p>提供决策表和决策服务的执行能力。支持多种执行模式：
 * <ul>
 *   <li>普通执行模式：返回所有匹配规则的结果</li>
 *   <li>单结果模式：确保只有一个结果</li>
 *   <li>审计追踪模式：返回完整的执行过程记录</li>
 * </ul>
 *
 * @author Tijs Rademakers
 * @author Yvo Swillens
 * @since 6.0.0
 * @see ExecuteDecisionBuilder
 * @see DecisionExecutionAuditContainer
 */
public interface DmnDecisionService {
    // ...
}
```

### 2.2 方法注释

```java
/**
 * 执行决策表并返回结果列表
 *
 * <p>根据提供的决策 Key 和输入变量执行决策表，
 * 返回所有匹配规则的输出结果。
 *
 * @param builder 决策执行构建器，包含决策 Key 和输入变量
 * @return 决策结果列表，每条匹配规则对应一个 Map；
 *         如果没有规则匹配，返回空列表
 * @throws FlowableException 当决策执行过程中发生错误时抛出
 * @throws IllegalArgumentException 当决策 Key 为空时抛出
 */
List<Map<String, Object>> executeDecision(ExecuteDecisionBuilder builder);
```

### 2.3 代码块注释

```java
// 1. 创建执行上下文和审计追踪
ELExecutionContext executionContext = ELExecutionContextBuilder.build(decision, executeDecisionInfo);

try {
    // 2. 健全性检查：验证决策表结构
    sanityCheckDecisionTable(currentDecisionTable);

    // 3. 执行决策表评估
    evaluateDecisionTable(currentDecisionTable, executionContext);

} catch (FlowableException fe) {
    // 4. 处理执行异常
    LOGGER.error("decision table execution sanity check failed", fe);
    executionContext.getAuditContainer().setFailed();
    executionContext.getAuditContainer().setExceptionMessage(getExceptionMessage(fe));

} finally {
    // 5. 结束审计追踪
    executionContext.getAuditContainer().stopAudit(dmnEngineConfiguration.getClock().getCurrentTime());
}
```

### 2.4 TODO 注释

```java
// TODO: 优化性能 - 考虑使用缓存
// TODO: 待实现 - 支持自定义聚合函数
// FIXME: 修复边界条件处理问题
// XXX: 这里的逻辑可能有问题，需要进一步验证
```

---

## 3. 文件组织原则

### 3.1 类文件结构

```java
/**
 * 文件头注释（类注释）
 */
package org.flowable.dmn.engine.impl;

// 1. Java 标准库导入
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// 2. 第三方库导入
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

// 3. Flowable 公共库导入
import org.flowable.common.engine.api.FlowableException;
import org.flowable.common.engine.impl.el.ExpressionManager;

// 4. Flowable DMN 模块导入
import org.flowable.dmn.api.DecisionExecutionAuditContainer;
import org.flowable.dmn.engine.DmnEngineConfiguration;

/**
 * 类定义
 */
public class RuleEngineExecutorImpl implements RuleEngineExecutor {

    // 1. 静态常量
    private static final Logger LOGGER = LoggerFactory.getLogger(RuleEngineExecutorImpl.class);
    
    // 2. 实例变量
    protected Map<String, AbstractHitPolicy> hitPolicyBehaviors;
    protected ExpressionManager expressionManager;
    
    // 3. 构造方法
    public RuleEngineExecutorImpl(Map<String, AbstractHitPolicy> hitPolicyBehaviors,
                                  ExpressionManager expressionManager) {
        this.hitPolicyBehaviors = hitPolicyBehaviors;
        this.expressionManager = expressionManager;
    }
    
    // 4. 公共方法
    @Override
    public DecisionExecutionAuditContainer execute(Decision decision, ExecuteDecisionContext context) {
        // ...
    }
    
    // 5. 保护方法
    protected void evaluateDecisionTable(DecisionTable decisionTable, ELExecutionContext context) {
        // ...
    }
    
    // 6. 私有方法
    private String getExceptionMessage(Exception exception) {
        // ...
    }
    
    // 7. Getter/Setter
    public Map<String, AbstractHitPolicy> getHitPolicyBehaviors() {
        return hitPolicyBehaviors;
    }
}
```

### 3.2 模块目录结构

```
modules/flowable-dmn-engine/
├── src/main/java/
│   └── org/flowable/dmn/
│       ├── api/                    # API 接口定义
│       │   ├── DmnDecisionService.java
│       │   ├── DmnRepositoryService.java
│       │   └── ...
│       │
│       └── engine/
│           ├── DmnEngine.java      # 核心接口
│           ├── DmnEngineConfiguration.java
│           └── impl/               # 实现层
│               ├── cmd/            # 命令实现
│               ├── hitpolicy/      # 命中策略
│               ├── el/             # 表达式语言
│               └── persistence/    # 持久化
│
├── src/main/resources/
│   └── org/flowable/dmn/db/
│       ├── create/                 # 建表脚本
│       ├── mapping/                # MyBatis 映射
│       └── upgrade/                # 升级脚本
│
└── src/test/
    ├── java/                       # 测试代码
    └── resources/                  # 测试资源
```

---

## 4. 代码质量保证

### 4.1 单元测试规范

```java
/**
 * 决策服务单元测试
 */
@DisplayName("决策服务测试")
class DmnDecisionServiceTest {

    private static DmnEngine dmnEngine;
    private DmnDecisionService decisionService;

    @BeforeAll
    static void initEngine() {
        // 使用内存数据库初始化引擎
        dmnEngine = new StandaloneInMemDmnEngineConfiguration()
            .buildDmnEngine();
    }

    @BeforeEach
    void setup() {
        decisionService = dmnEngine.getDmnDecisionService();
        // 部署测试决策表
        deployTestDecision();
    }

    @Test
    @DisplayName("执行决策 - 正常情况")
    void executeDecision_normalCase_shouldReturnResults() {
        // Given
        Map<String, Object> variables = Map.of(
            "age", 30,
            "income", 50000
        );

        // When
        List<Map<String, Object>> results = decisionService
            .createExecuteDecisionBuilder()
            .decisionKey("testDecision")
            .variables(variables)
            .executeDecision();

        // Then
        assertThat(results).isNotEmpty();
        assertThat(results.get(0)).containsKey("result");
    }

    @Test
    @DisplayName("执行决策 - 无匹配规则")
    void executeDecision_noMatch_shouldReturnEmptyList() {
        // Given
        Map<String, Object> variables = Map.of(
            "age", 0,  // 不匹配任何规则
            "income", 0
        );

        // When
        List<Map<String, Object>> results = decisionService
            .createExecuteDecisionBuilder()
            .decisionKey("testDecision")
            .variables(variables)
            .executeDecision();

        // Then
        assertThat(results).isEmpty();
    }

    @Test
    @DisplayName("执行决策 - 无效决策Key")
    void executeDecision_invalidKey_shouldThrowException() {
        // Given
        String invalidKey = "nonExistentDecision";

        // When & Then
        assertThatThrownBy(() -> decisionService
            .createExecuteDecisionBuilder()
            .decisionKey(invalidKey)
            .executeDecision())
            .isInstanceOf(FlowableException.class)
            .hasMessageContaining("no decision deployed with key");
    }

    @AfterEach
    void cleanup() {
        // 清理测试数据
        cleanupTestDeployments();
    }

    @AfterAll
    static void closeEngine() {
        dmnEngine.close();
    }
}
```

### 4.2 集成测试规范

```java
/**
 * 决策引擎集成测试
 */
@SpringBootTest
@TestPropertySource(locations = "classpath:application-test.properties")
class DmnEngineIntegrationTest {

    @Autowired
    private DmnEngine dmnEngine;

    @Autowired
    private DataSource dataSource;

    @Test
    @DisplayName("数据库连接验证")
    void databaseConnection_shouldBeValid() throws SQLException {
        try (Connection connection = dataSource.getConnection()) {
            assertThat(connection.isValid(5)).isTrue();
        }
    }

    @Test
    @DisplayName("完整决策流程")
    void fullDecisionFlow_shouldWork() {
        // 1. 部署
        DmnDeployment deployment = dmnEngine.getDmnRepositoryService()
            .createDeployment()
            .addClasspathResource("dmn/integration-test.dmn")
            .deploy();
        
        assertThat(deployment).isNotNull();

        // 2. 查询
        DmnDecision decision = dmnEngine.getDmnRepositoryService()
            .createDecisionQuery()
            .deploymentId(deployment.getId())
            .singleResult();
        
        assertThat(decision).isNotNull();

        // 3. 执行
        List<Map<String, Object>> results = dmnEngine.getDmnDecisionService()
            .createExecuteDecisionBuilder()
            .decisionKey(decision.getKey())
            .variable("input", 100)
            .executeDecision();
        
        assertThat(results).isNotEmpty();

        // 4. 清理
        dmnEngine.getDmnRepositoryService().deleteDeployment(deployment.getId());
    }
}
```

### 4.3 代码检查规则

```xml
<!-- Checkstyle 配置示例 -->
<module name="Checker">
    <module name="TreeWalker">
        <!-- 命名规范 -->
        <module name="ConstantName"/>
        <module name="LocalFinalVariableName"/>
        <module name="LocalVariableName"/>
        <module name="MemberName"/>
        <module name="MethodName"/>
        <module name="PackageName"/>
        <module name="ParameterName"/>
        <module name="StaticVariableName"/>
        <module name="TypeName"/>
        
        <!-- 代码风格 -->
        <module name="AvoidStarImport"/>
        <module name="IllegalImport"/>
        <module name="RedundantImport"/>
        <module name="LineLength">
            <property name="max" value="120"/>
        </module>
        
        <!-- 代码质量 -->
        <module name="EmptyBlock"/>
        <module name="LeftCurly"/>
        <module name="NeedBraces"/>
        <module name="RightCurly"/>
        <module name="EmptyStatement"/>
        <module name="EqualsHashCode"/>
        <module name="IllegalInstantiation"/>
        <module name="InnerAssignment"/>
        <module name="MissingSwitchDefault"/>
        <module name="SimplifyBooleanExpression"/>
        <module name="SimplifyBooleanReturn"/>
    </module>
</module>
```

---

## 5. Git 提交规范

### 5.1 分支管理策略

```
main                # 主分支，稳定版本
  ├── develop       # 开发分支
  │   ├── feature/dmn-engine      # 功能分支
  │   ├── feature/hit-policy      # 功能分支
  │   └── bugfix/expression-fix   # 修复分支
  │
  └── release/7.0.0 # 发布分支
```

### 5.2 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型：**
- `feat`: 新功能
- `fix`: 修复 Bug
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例：**

```
feat(hitpolicy): 添加自定义 HitPolicy 支持

- 添加 HitPolicyBehavior 接口
- 实现 AbstractHitPolicy 基类
- 支持 UNIQUE、FIRST、COLLECT 等策略
- 添加自定义 HitPolicy 注册机制

Closes #123
```

```
fix(expression): 修复表达式解析空指针异常

当输入变量为 null 时，表达式解析会抛出 NPE。
添加 null 检查并返回默认值。

Fixes #456
```

### 5.3 代码审查清单

```
□ 代码是否符合命名规范
□ 是否有足够的注释
□ 是否有对应的单元测试
□ 测试覆盖率是否达标
□ 是否有性能问题
□ 是否有安全风险
□ 是否遵循设计模式
□ 是否有重复代码
□ 是否正确处理异常
□ 是否正确管理资源（关闭连接等）
```

---

## 6. 异常处理规范

### 6.1 异常类型

```java
// 业务异常 - 可预期的错误
public class FlowableException extends RuntimeException {
    // 用户可见的错误信息
}

// 参数校验异常
public class IllegalArgumentException extends RuntimeException {
    // 参数错误信息
}

// 表达式执行异常
public class FlowableDmnExpressionException extends FlowableException {
    // 表达式相关错误
}

// 乐观锁异常
public class ActivitiOptimisticLockingException extends FlowableException {
    // 并发冲突
}
```

### 6.2 异常处理模式

```java
// 正确的异常处理
public DecisionExecutionAuditContainer execute(Decision decision, ExecuteDecisionContext context) {
    // 参数校验
    if (decision == null) {
        throw new IllegalArgumentException("no decision provided");
    }

    if (decision.getExpression() == null) {
        throw new IllegalArgumentException("no decision table present in decision");
    }

    try {
        // 业务逻辑
        evaluateDecisionTable(currentDecisionTable, executionContext);
        
    } catch (FlowableException fe) {
        // 已知异常：记录日志并设置审计信息
        LOGGER.error("decision table execution failed", fe);
        executionContext.getAuditContainer().setFailed();
        executionContext.getAuditContainer().setExceptionMessage(getExceptionMessage(fe));
        
    } catch (Exception e) {
        // 未知异常：包装为业务异常
        throw new FlowableException("Unexpected error during decision execution", e);
        
    } finally {
        // 清理资源
        executionContext.getAuditContainer().stopAudit(clock.getCurrentTime());
    }

    return executionContext.getAuditContainer();
}
```

### 6.3 日志记录规范

```java
// 使用 SLF4J
private static final Logger LOGGER = LoggerFactory.getLogger(RuleEngineExecutorImpl.class);

// 不同级别的日志
LOGGER.trace("Detailed trace information for debugging");
LOGGER.debug("Start table evaluation: {}", decisionTable.getId());
LOGGER.info("Decision executed successfully: key={}, duration={}ms", decisionKey, duration);
LOGGER.warn("HitPolicy {} violated; multiple valid rules", hitPolicyName);
LOGGER.error("Decision table execution failed", exception);

// 避免字符串拼接
// 错误
LOGGER.debug("Processing rule " + ruleNumber + " with condition " + condition);
// 正确
LOGGER.debug("Processing rule {} with condition {}", ruleNumber, condition);

// 条件日志（性能敏感场景）
if (LOGGER.isDebugEnabled()) {
    LOGGER.debug("Detailed debug information: {}", expensiveOperation());
}
```

---

## 7. 性能优化指南

### 7.1 缓存使用

```java
// 决策定义缓存
protected DeploymentCache<DecisionCacheEntry> definitionCache;

// 配置缓存大小
configuration.setDecisionCacheLimit(500);

// 获取缓存的决策
public Decision getDecision(String decisionId) {
    DecisionCacheEntry cached = definitionCache.get(decisionId);
    if (cached != null) {
        return cached.getDecision();
    }
    // 从数据库加载并缓存
    Decision decision = loadDecisionFromDb(decisionId);
    definitionCache.add(decisionId, new DecisionCacheEntry(decision));
    return decision;
}
```

### 7.2 批量操作

```java
// 批量删除历史记录
public void bulkDeleteHistoricDecisionExecutions(Collection<String> instanceIds, String scopeType) {
    // 使用批量 SQL 而非循环单条删除
    String sql = "DELETE FROM ACT_DMN_HI_DECISION_EXECUTION WHERE INSTANCE_ID_ IN (:instanceIds) AND SCOPE_TYPE_ = :scopeType";
    
    Map<String, Object> parameters = new HashMap<>();
    parameters.put("instanceIds", instanceIds);
    parameters.put("scopeType", scopeType);
    
    commandExecutor.execute(new ExecuteCustomSqlCmd("DELETE", sql, parameters));
}
```

### 7.3 连接池配置

```java
// 生产环境连接池配置
configuration.setJdbcMaxActiveConnections(30);    // 最大活动连接
configuration.setJdbcMaxIdleConnections(10);      // 最大空闲连接
configuration.setJdbcMaxCheckoutTime(30000);      // 最大借用时间（毫秒）
configuration.setJdbcMaxWaitTime(10000);          // 最大等待时间（毫秒）
configuration.setJdbcPingEnabled(true);           // 启用连接检测
configuration.setJdbcPingConnectionNotUsedFor(3600000); // 检测间隔
```

---

## 8. 安全规范

### 8.1 输入验证

```java
// 验证决策 Key
public void validateDecisionKey(String decisionKey) {
    if (StringUtils.isEmpty(decisionKey)) {
        throw new IllegalArgumentException("decisionKey is required");
    }
    if (decisionKey.length() > 255) {
        throw new IllegalArgumentException("decisionKey too long");
    }
    if (!decisionKey.matches("^[a-zA-Z0-9_\\-\\.]+$")) {
        throw new IllegalArgumentException("decisionKey contains invalid characters");
    }
}
```

### 8.2 XML 安全

```java
// 启用安全的 XML 解析
configuration.setEnableSafeDmnXml(true);

// 防止 XXE 攻击
DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
```

### 8.3 租户隔离

```java
// 确保租户隔离
public Decision getDecision(String decisionKey, String tenantId) {
    DmnDecisionQuery query = repositoryService.createDecisionQuery()
        .decisionKey(decisionKey);
    
    if (StringUtils.isNotEmpty(tenantId)) {
        query.tenantId(tenantId);
    } else {
        query.decisionWithoutTenantId();
    }
    
    return query.singleResult();
}
```

---

## 9. 文档规范

### 9.1 README 结构

```markdown
# Flowable DMN Engine

## 简介
DMN 决策引擎模块的简要介绍。

## 快速开始
如何快速使用该模块。

## 安装
Maven 依赖配置。

## 配置
可配置项说明。

## API 文档
核心 API 使用说明。

## 示例
代码示例。

## 贡献指南
如何参与开发。

## 许可证
Apache License 2.0
```

### 9.2 Javadoc 规范

```java
/**
 * 执行决策表的核心执行器
 *
 * <h2>功能概述</h2>
 * <p>该类负责执行 DMN 决策表，包括：
 * <ul>
 *   <li>规则条件评估</li>
 *   <li>HitPolicy 处理</li>
 *   <li>结果组合</li>
 *   <li>审计追踪记录</li>
 * </ul>
 *
 * <h2>使用示例</h2>
 * <pre>{@code
 * RuleEngineExecutor executor = new RuleEngineExecutorImpl(
 *     hitPolicyBehaviors,
 *     expressionManager,
 *     objectMapper,
 *     engineConfiguration
 * );
 * 
 * DecisionExecutionAuditContainer result = executor.execute(decision, context);
 * }</pre>
 *
 * <h2>线程安全</h2>
 * <p>该类是线程安全的，可以在多线程环境中使用。
 *
 * @author Yvo Swillens
 * @since 6.0.0
 * @see HitPolicyBehavior
 * @see DecisionExecutionAuditContainer
 */
public class RuleEngineExecutorImpl implements RuleEngineExecutor {
    // ...
}
```

---

## 10. 总结

### 10.1 开发规范检查清单

```
□ 命名规范
  □ 类名使用驼峰命名，首字母大写
  □ 方法名使用驼峰命名，首字母小写
  □ 常量使用全大写，下划线分隔
  □ 包名使用小写

□ 注释规范
  □ 类有 Javadoc 注释
  □ 公共方法有 Javadoc 注释
  □ 复杂逻辑有行内注释

□ 代码组织
  □ 导入语句按规范分组
  □ 类成员按规范顺序排列
  □ 方法长度不超过 50 行

□ 异常处理
  □ 使用适当的异常类型
  □ 正确记录日志
  □ 资源正确释放

□ 测试覆盖
  □ 单元测试覆盖核心逻辑
  □ 边界条件有测试
  □ 异常情况有测试

□ 性能考虑
  □ 合理使用缓存
  □ 避免不必要的对象创建
  □ 使用批量操作

□ 安全考虑
  □ 输入验证
  □ 租户隔离
  □ XML 安全解析
```
