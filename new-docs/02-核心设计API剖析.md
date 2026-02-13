# Flowable Engine 核心设计API剖析

## 1. 公共API分类

### 1.1 API分类体系

Flowable Engine的API按照功能领域进行分类，形成了一个清晰的API层次结构：

```
公共API层 (Common API)
    ├── Engine API (引擎API)
    ├── Service API (服务API)
    ├── Entity API (实体API)
    ├── Query API (查询API)
    └── Event API (事件API)
```

### 1.2 核心API模块

| API模块 | 包路径 | 职责描述 |
|---------|--------|---------|
| `flowable-engine-common-api` | `org.flowable.common.engine.api` | 公共引擎API定义 |
| `flowable-app-engine-api` | `org.flowable.app.api` | 应用引擎API |
| `flowable-dmn-api` | `org.flowable.dmn.api` | DMN引擎API |
| `flowable-cmmn-api` | `org.flowable.cmmn.api` | CMMN引擎API |
| `flowable-idm-api` | `org.flowable.idm.api` | 身份管理API |
| `flowable-task-api` | `org.flowable.task.api` | 任务管理API |
| `flowable-variable-api` | `org.flowable.variable.api` | 变量管理API |
| `flowable-event-registry-api` | `org.flowable.eventregistry.api` | 事件注册API |

## 2. 核心类定义与继承关系

### 2.1 引擎接口层次

#### 2.1.1 Engine接口

```java
package org.flowable.common.engine.api;

/**
 * 所有引擎的基础接口
 */
public interface Engine {
    
    /**
     * 获取引擎名称
     */
    String getName();
    
    /**
     * 关闭引擎，释放资源
     */
    void close();
}
```

#### 2.1.2 ProcessEngine接口

```java
package org.flowable.engine;

import org.flowable.common.engine.api.Engine;

/**
 * 流程引擎接口，提供BPM和工作流操作的所有服务访问
 */
public interface ProcessEngine extends Engine {
    
    /** Flowable库的版本 */
    String VERSION = FlowableVersions.CURRENT_VERSION;
    
    /**
     * 启动执行器（异步和异步历史），如果配置为自动激活
     */
    void startExecutors();
    
    // 核心服务接口
    RepositoryService getRepositoryService();
    RuntimeService getRuntimeService();
    FormService getFormService();
    TaskService getTaskService();
    HistoryService getHistoryService();
    IdentityService getIdentityService();
    ManagementService getManagementService();
    DynamicBpmnService getDynamicBpmnService();
    ProcessMigrationService getProcessMigrationService();
    
    ProcessEngineConfiguration getProcessEngineConfiguration();
}
```

#### 2.1.3 AppEngine接口

```java
package org.flowable.app.engine;

import org.flowable.common.engine.api.Engine;
import org.flowable.app.api.AppManagementService;
import org.flowable.app.api.AppRepositoryService;

/**
 * 应用引擎接口，提供应用管理操作的所有服务访问
 */
public interface AppEngine extends Engine {
    
    /** Flowable应用引擎的版本 */
    String VERSION = FlowableVersions.CURRENT_VERSION;
    
    AppManagementService getAppManagementService();
    AppRepositoryService getAppRepositoryService();
    AppEngineConfiguration getAppEngineConfiguration();
}
```

#### 2.1.4 引擎接口继承关系

```
Engine (基础引擎接口)
    ├── ProcessEngine (流程引擎)
    │   ├── RepositoryService
    │   ├── RuntimeService
    │   ├── TaskService
    │   ├── HistoryService
    │   ├── IdentityService
    │   ├── ManagementService
    │   ├── FormService
    │   ├── DynamicBpmnService
    │   └── ProcessMigrationService
    │
    ├── AppEngine (应用引擎)
    │   ├── AppManagementService
    │   └── AppRepositoryService
    │
    ├── DmnEngine (决策引擎)
    │   ├── DmnRepositoryService
    │   ├── DmnRuleService
    │   └── DmnHistoryService
    │
    ├── CmmnEngine (案例引擎)
    │   ├── CmmnRepositoryService
    │   ├── CmmnRuntimeService
    │   └── CmmnTaskService
    │
    └── IdmEngine (身份引擎)
        ├── IdmIdentityService
        ├── IdmGroupService
        └── IdmPrivilegeService
```

### 2.2 服务接口层次

#### 2.2.1 RepositoryService

```java
package org.flowable.engine;

import java.io.InputStream;
import java.util.Date;
import java.util.List;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.engine.repository.*;

/**
 * 提供流程定义和部署仓库访问的服务
 */
public interface RepositoryService {
    
    // ========== 部署管理 ==========
    
    /**
     * 开始创建新部署
     * @return DeploymentBuilder 用于构建部署
     */
    DeploymentBuilder createDeployment();
    
    /**
     * 删除给定部署
     * @param deploymentId 部署ID，不能为null
     * @throws RuntimeException 如果仍有运行时或历史流程实例或作业
     */
    void deleteDeployment(String deploymentId);
    
    /**
     * 删除给定部署并级联删除流程实例、历史流程实例和作业
     * @param deploymentId 部署ID，不能为null
     * @param cascade 是否级联删除
     */
    void deleteDeployment(String deploymentId, boolean cascade);
    
    /**
     * 设置部署的分类
     * @param deploymentId 部署ID
     * @param category 分类名称
     */
    void setDeploymentCategory(String deploymentId, String category);
    
    /**
     * 设置部署的键
     * @param deploymentId 部署ID
     * @param key 键值
     */
    void setDeploymentKey(String deploymentId, String key);
    
    /**
     * 获取给定部署的资源列表，按字母顺序排列
     * @param deploymentId 部署ID
     * @return 资源名称列表
     */
    List<String> getDeploymentResourceNames(String deploymentId);
    
    /**
     * 通过字节流访问部署资源
     * @param deploymentId 部署ID
     * @param resourceName 资源名称
     * @return 资源输入流
     */
    InputStream getResourceAsStream(String deploymentId, String resourceName);
    
    // ========== 流程定义管理 ==========
    
    /**
     * 查询流程定义
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery createProcessDefinitionQuery();
    
    /**
     * 获取流程定义
     * @param processDefinitionId 流程定义ID
     * @return ProcessDefinition 流程定义对象
     */
    ProcessDefinition getProcessDefinition(String processDefinitionId);
    
    /**
     * 获取BPMN模型
     * @param processDefinitionId 流程定义ID
     * @return BpmnModel BPMN模型对象
     */
    BpmnModel getBpmnModel(String processDefinitionId);
    
    /**
     * 获取流程模型（BPMN XML文件）
     * @param processDefinitionId 流程定义ID
     * @return 流程模型输入流
     */
    InputStream getProcessModel(String processDefinitionId);
    
    /**
     * 获取流程图（PNG图片）
     * @param processDefinitionId 流程定义ID
     * @return 流程图输入流
     */
    InputStream getProcessDiagram(String processDefinitionId);
    
    // ========== 流程定义状态管理 ==========
    
    /**
     * 暂停给定ID的流程定义
     * @param processDefinitionId 流程定义ID
     */
    void suspendProcessDefinitionById(String processDefinitionId);
    
    /**
     * 暂停给定ID的流程定义
     * @param processDefinitionId 流程定义ID
     * @param suspendProcessInstances 是否同时暂停流程实例
     * @param suspensionDate 暂停日期，null表示立即暂停
     */
    void suspendProcessDefinitionById(String processDefinitionId, 
                                    boolean suspendProcessInstances, 
                                    Date suspensionDate);
    
    /**
     * 暂停给定键的所有流程定义
     * @param processDefinitionKey 流程定义键
     */
    void suspendProcessDefinitionByKey(String processDefinitionKey);
    
    /**
     * 暂停给定键的所有流程定义
     * @param processDefinitionKey 流程定义键
     * @param suspendProcessInstances 是否同时暂停流程实例
     * @param suspensionDate 暂停日期，null表示立即暂停
     */
    void suspendProcessDefinitionByKey(String processDefinitionKey, 
                                     boolean suspendProcessInstances, 
                                     Date suspensionDate);
    
    /**
     * 激活给定ID的流程定义
     * @param processDefinitionId 流程定义ID
     */
    void activateProcessDefinitionById(String processDefinitionId);
    
    /**
     * 激活给定ID的流程定义
     * @param processDefinitionId 流程定义ID
     * @param activateProcessInstances 是否同时激活流程实例
     * @param activationDate 激活日期，null表示立即激活
     */
    void activateProcessDefinitionById(String processDefinitionId, 
                                     boolean activateProcessInstances, 
                                     Date activationDate);
    
    /**
     * 激活给定键的所有流程定义
     * @param processDefinitionKey 流程定义键
     */
    void activateProcessDefinitionByKey(String processDefinitionKey);
    
    /**
     * 激活给定键的所有流程定义
     * @param processDefinitionKey 流程定义键
     * @param activateProcessInstances 是否同时激活流程实例
     * @param activationDate 激活日期，null表示立即激活
     */
    void activateProcessDefinitionByKey(String processDefinitionKey, 
                                      boolean activateProcessInstances, 
                                      Date activationDate);
    
    // ========== 候选人管理 ==========
    
    /**
     * 为流程定义授权候选用户
     * @param processDefinitionId 流程定义ID
     * @param userId 用户ID
     */
    void addCandidateStarterUser(String processDefinitionId, String userId);
    
    /**
     * 为流程定义授权候选组
     * @param processDefinitionId 流程定义ID
     * @param groupId 组ID
     */
    void addCandidateStarterGroup(String processDefinitionId, String groupId);
    
    /**
     * 移除流程定义的候选用户授权
     * @param processDefinitionId 流程定义ID
     * @param userId 用户ID
     */
    void deleteCandidateStarterUser(String processDefinitionId, String userId);
    
    /**
     * 移除流程定义的候选组授权
     * @param processDefinitionId 流程定义ID
     * @param groupId 组ID
     */
    void deleteCandidateStarterGroup(String processDefinitionId, String groupId);
    
    /**
     * 获取流程定义的身份链接
     * @param processDefinitionId 流程定义ID
     * @return 身份链接列表
     */
    List<IdentityLink> getIdentityLinksForProcessDefinition(String processDefinitionId);
    
    // ========== 模型管理 ==========
    
    /**
     * 创建新模型
     * @return Model 模型对象
     */
    Model newModel();
    
    /**
     * 保存模型
     * @param model 模型对象
     */
    void saveModel(Model model);
    
    /**
     * 删除模型
     * @param modelId 模型ID
     */
    void deleteModel(String modelId);
    
    /**
     * 查询模型
     * @return ModelQuery 查询对象
     */
    ModelQuery createModelQuery();
    
    /**
     * 获取模型
     * @param modelId 模型ID
     * @return Model 模型对象
     */
    Model getModel(String modelId);
    
    // ========== 验证 ==========
    
    /**
     * 验证给定的流程定义
     * @param bpmnModel BPMN模型
     * @return 验证错误列表
     */
    List<ValidationError> validateProcess(BpmnModel bpmnModel);
}
```

#### 2.2.2 RuntimeService

```java
package org.flowable.engine;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.flowable.engine.runtime.*;
import org.flowable.task.api.Task;
import org.flowable.variable.api.persistence.entity.VariableInstance;

/**
 * 运行时服务，提供流程实例运行时操作
 */
public interface RuntimeService {
    
    // ========== 流程实例启动 ==========
    
    /**
     * 创建流程实例构建器
     * @return ProcessInstanceBuilder 构建器
     */
    ProcessInstanceBuilder createProcessInstanceBuilder();
    
    /**
     * 使用给定键的最新版本流程定义启动新流程实例
     * @param processDefinitionKey 流程定义键
     * @return ProcessInstance 流程实例
     */
    ProcessInstance startProcessInstanceByKey(String processDefinitionKey);
    
    /**
     * 使用给定键的最新版本流程定义启动新流程实例
     * @param processDefinitionKey 流程定义键
     * @param businessKey 业务键
     * @return ProcessInstance 流程实例
     */
    ProcessInstance startProcessInstanceByKey(String processDefinitionKey, 
                                            String businessKey);
    
    /**
     * 使用给定键的最新版本流程定义启动新流程实例
     * @param processDefinitionKey 流程定义键
     * @param variables 流程变量
     * @return ProcessInstance 流程实例
     */
    ProcessInstance startProcessInstanceByKey(String processDefinitionKey, 
                                            Map<String, Object> variables);
    
    /**
     * 使用给定键的最新版本流程定义启动新流程实例
     * @param processDefinitionKey 流程定义键
     * @param businessKey 业务键
     * @param variables 流程变量
     * @return ProcessInstance 流程实例
     */
    ProcessInstance startProcessInstanceByKey(String processDefinitionKey, 
                                            String businessKey, 
                                            Map<String, Object> variables);
    
    /**
     * 使用给定ID的流程定义启动新流程实例
     * @param processDefinitionId 流程定义ID
     * @return ProcessInstance 流程实例
     */
    ProcessInstance startProcessInstanceById(String processDefinitionId);
    
    /**
     * 使用给定ID的流程定义启动新流程实例
     * @param processDefinitionId 流程定义ID
     * @param businessKey 业务键
     * @return ProcessInstance 流程实例
     */
    ProcessInstance startProcessInstanceById(String processDefinitionId, 
                                           String businessKey);
    
    /**
     * 使用给定ID的流程定义启动新流程实例
     * @param processDefinitionId 流程定义ID
     * @param variables 流程变量
     * @return ProcessInstance 流程实例
     */
    ProcessInstance startProcessInstanceById(String processDefinitionId, 
                                           Map<String, Object> variables);
    
    /**
     * 使用给定ID的流程定义启动新流程实例
     * @param processDefinitionId 流程定义ID
     * @param businessKey 业务键
     * @param variables 流程变量
     * @return ProcessInstance 流程实例
     */
    ProcessInstance startProcessInstanceById(String processDefinitionId, 
                                           String businessKey, 
                                           Map<String, Object> variables);
    
    /**
     * 通过消息启动新流程实例
     * @param messageName 消息名称
     * @return ProcessInstance 流程实例
     */
    ProcessInstance startProcessInstanceByMessage(String messageName);
    
    /**
     * 通过消息启动新流程实例
     * @param messageName 消息名称
     * @param businessKey 业务键
     * @return ProcessInstance 流程实例
     */
    ProcessInstance startProcessInstanceByMessage(String messageName, 
                                                String businessKey);
    
    /**
     * 通过消息启动新流程实例
     * @param messageName 消息名称
     * @param processVariables 流程变量
     * @return ProcessInstance 流程实例
     */
    ProcessInstance startProcessByMessage(String messageName, 
                                        Map<String, Object> processVariables);
    
    // ========== 流程实例管理 ==========
    
    /**
     * 删除运行时流程实例
     * @param processInstanceId 流程实例ID
     * @param deleteReason 删除原因
     */
    void deleteProcessInstance(String processInstanceId, String deleteReason);
    
    /**
     * 批量删除运行时流程实例
     * @param processInstanceIds 流程实例ID集合
     * @param deleteReason 删除原因
     */
    void bulkDeleteProcessInstances(Collection<String> processInstanceIds, 
                                  String deleteReason);
    
    /**
     * 获取执行的活动ID列表
     * @param executionId 执行ID
     * @return 活动ID列表
     */
    List<String> getActiveActivityIds(String executionId);
    
    /**
     * 发送外部触发信号到等待的执行
     * @param executionId 执行ID
     */
    void trigger(String executionId);
    
    /**
     * 异步发送外部触发信号到等待的执行
     * @param executionId 执行ID
     */
    void triggerAsync(String executionId);
    
    /**
     * 发送外部触发信号到等待的执行
     * @param executionId 执行ID
     * @param processVariables 流程变量
     */
    void trigger(String executionId, Map<String, Object> processVariables);
    
    /**
     * 异步发送外部触发信号到等待的执行
     * @param executionId 执行ID
     * @param processVariables 流程变量
     */
    void triggerAsync(String executionId, Map<String, Object> processVariables);
    
    // ========== 变量管理 ==========
    
    /**
     * 获取执行的所有变量（包括父作用域）
     * @param executionId 执行ID
     * @return 变量Map
     */
    Map<String, Object> getVariables(String executionId);
    
    /**
     * 获取执行的所有变量实例（包括父作用域）
     * @param executionId 执行ID
     * @return 变量实例Map
     */
    Map<String, VariableInstance> getVariableInstances(String executionId);
    
    /**
     * 获取执行的本地变量（不包括父作用域）
     * @param executionId 执行ID
     * @return 变量Map
     */
    Map<String, Object> getVariablesLocal(String executionId);
    
    /**
     * 获取执行的本地变量实例（不包括父作用域）
     * @param executionId 执行ID
     * @return 变量实例Map
     */
    Map<String, VariableInstance> getVariableInstancesLocal(String executionId);
    
    /**
     * 获取指定名称的变量值
     * @param executionId 执行ID
     * @param variableName 变量名
     * @return 变量值
     */
    Object getVariable(String executionId, String variableName);
    
    /**
     * 获取指定名称的变量实例
     * @param executionId 执行ID
     * @param variableName 变量名
     * @return 变量实例
     */
    VariableInstance getVariableInstance(String executionId, String variableName);
    
    /**
     * 获取指定名称的变量值（带类型转换）
     * @param executionId 执行ID
     * @param variableName 变量名
     * @param variableClass 变量类型
     * @return 变量值
     */
    <T> T getVariable(String executionId, String variableName, Class<T> variableClass);
    
    /**
     * 检查是否存在指定变量
     * @param executionId 执行ID
     * @param variableName 变量名
     * @return 是否存在
     */
    boolean hasVariable(String executionId, String variableName);
    
    /**
     * 设置变量值
     * @param executionId 执行ID
     * @param variableName 变量名
     * @param value 变量值
     */
    void setVariable(String executionId, String variableName, Object value);
    
    /**
     * 设置本地变量值
     * @param executionId 执行ID
     * @param variableName 变量名
     * @param value 变量值
     */
    void setVariableLocal(String executionId, String variableName, Object value);
    
    /**
     * 批量设置变量值
     * @param executionId 执行ID
     * @param variables 变量Map
     */
    void setVariables(String executionId, Map<String, ? extends Object> variables);
    
    /**
     * 批量设置本地变量值
     * @param executionId 执行ID
     * @param variables 变量Map
     */
    void setVariablesLocal(String executionId, Map<String, ? extends Object> variables);
    
    /**
     * 删除变量
     * @param executionId 执行ID
     * @param variableName 变量名
     */
    void removeVariable(String executionId, String variableName);
    
    /**
     * 删除本地变量
     * @param executionId 执行ID
     * @param variableName 变量名
     */
    void removeVariableLocal(String executionId, String variableName);
    
    /**
     * 批量删除变量
     * @param executionId 执行ID
     * @param variableNames 变量名集合
     */
    void removeVariables(String executionId, Collection<String> variableNames);
    
    /**
     * 批量删除本地变量
     * @param executionId 执行ID
     * @param variableNames 变量名集合
     */
    void removeVariablesLocal(String executionId, Collection<String> variableNames);
    
    // ========== 查询 ==========
    
    /**
     * 创建执行查询
     * @return ExecutionQuery 查询对象
     */
    ExecutionQuery createExecutionQuery();
    
    /**
     * 创建流程实例查询
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery createProcessInstanceQuery();
    
    /**
     * 创建活动实例查询
     * @return ActivityInstanceQuery 查询对象
     */
    ActivityInstanceQuery createActivityInstanceQuery();
    
    /**
     * 创建变量实例查询
     * @return VariableInstanceQuery 查询对象
     */
    VariableInstanceQuery createVariableInstanceQuery();
    
    // ========== 事件处理 ==========
    
    /**
     * 发送信号事件
     * @param signalName 信号名称
     */
    void signalEventReceived(String signalName);
    
    /**
     * 异步发送信号事件
     * @param signalName 信号名称
     */
    void signalEventReceivedAsync(String signalName);
    
    /**
     * 发送信号事件到指定执行
     * @param signalName 信号名称
     * @param executionId 执行ID
     */
    void signalEventReceived(String signalName, String executionId);
    
    /**
     * 发送信号事件到指定执行
     * @param signalName 信号名称
     * @param executionId 执行ID
     * @param processVariables 流程变量
     */
    void signalEventReceived(String signalName, String executionId, 
                           Map<String, Object> processVariables);
    
    /**
     * 发送消息事件
     * @param messageName 消息名称
     * @param executionId 执行ID
     */
    void messageEventReceived(String messageName, String executionId);
    
    /**
     * 发送消息事件
     * @param messageName 消息名称
     * @param executionId 执行ID
     * @param processVariables 流程变量
     */
    void messageEventReceived(String messageName, String executionId, 
                             Map<String, Object> processVariables);
}
```

## 3. 接口方法详细说明

### 3.1 RepositoryService方法参数规范

#### 3.1.1 DeploymentBuilder

```java
package org.flowable.engine.repository;

/**
 * 部署构建器，用于构建流程部署
 */
public interface DeploymentBuilder {
    
    /**
     * 添加资源
     * @param resourceName 资源名称
     * @param inputStream 资源输入流
     * @return DeploymentBuilder 构建器
     */
    DeploymentBuilder addInputStream(String resourceName, InputStream inputStream);
    
    /**
     * 添加类路径资源
     * @param resourceName 资源名称
     * @return DeploymentBuilder 构建器
     */
    DeploymentBuilder addClasspathResource(String resourceName);
    
    /**
     * 添加字符串资源
     * @param resourceName 资源名称
     * @param text 资源文本
     * @return DeploymentBuilder 构建器
     */
    DeploymentBuilder addString(String resourceName, String text);
    
    /**
     * 添加字节数组资源
     * @param resourceName 资源名称
     * @param bytes 资源字节数组
     * @return DeploymentBuilder 构建器
     */
    DeploymentBuilder addBytes(String resourceName, byte[] bytes);
    
    /**
     * 添加ZIP文件
     * @param zipFile ZIP文件
     * @return DeploymentBuilder 构建器
     */
    DeploymentBuilder addZipInputStream(InputStream zipFile);
    
    /**
     * 设置部署名称
     * @param name 部署名称
     * @return DeploymentBuilder 构建器
     */
    DeploymentBuilder name(String name);
    
    /**
     * 设置部署分类
     * @param category 部署分类
     * @return DeploymentBuilder 构建器
     */
    DeploymentBuilder category(String category);
    
    /**
     * 设置部署键
     * @param key 部署键
     * @return DeploymentBuilder 构建器
     */
    DeploymentBuilder key(String key);
    
    /**
     * 设置租户ID
     * @param tenantId 租户ID
     * @return DeploymentBuilder 构建器
     */
    DeploymentBuilder tenantId(String tenantId);
    
    /**
     * 部署
     * @return Deployment 部署对象
     */
    Deployment deploy();
}
```

#### 3.1.2 ProcessDefinitionQuery

```java
package org.flowable.engine.repository;

/**
 * 流程定义查询接口
 */
public interface ProcessDefinitionQuery extends Query<ProcessDefinition, ProcessDefinitionQuery> {
    
    /**
     * 按流程定义ID查询
     * @param processDefinitionId 流程定义ID
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery processDefinitionId(String processDefinitionId);
    
    /**
     * 按流程定义键查询
     * @param processDefinitionKey 流程定义键
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery processDefinitionKey(String processDefinitionKey);
    
    /**
     * 按流程定义名称查询
     * @param name 流程定义名称
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery processDefinitionName(String name);
    
    /**
     * 按流程定义名称模糊查询
     * @param name 流程定义名称（支持%通配符）
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery processDefinitionNameLike(String name);
    
    /**
     * 按版本查询
     * @param version 版本号
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery processDefinitionVersion(Integer version);
    
    /**
     * 按分类查询
     * @param category 分类
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery processDefinitionCategory(String category);
    
    /**
     * 按分类模糊查询
     * @param category 分类（支持%通配符）
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery processDefinitionCategoryLike(String category);
    
    /**
     * 按部署ID查询
     * @param deploymentId 部署ID
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery deploymentId(String deploymentId);
    
    /**
     * 按键查询最新版本
     * @param processDefinitionKey 流程定义键
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery latestVersion();
    
    /**
     * 按租户ID查询
     * @param tenantId 租户ID
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery processDefinitionTenantId(String tenantId);
    
    /**
     * 查询不带租户ID的流程定义
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery withoutTenantId();
    
    /**
     * 按是否暂停查询
     * @param suspended 是否暂停
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery suspended(boolean suspended);
    
    /**
     * 按是否开始事件查询
     * @param startable 是否可启动
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery startableByUser();
    
    /**
     * 按是否可启动查询
     * @param userId 用户ID
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery startableByUser(String userId);
    
    /**
     * 按资源名称查询
     * @param resourceName 资源名称
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery resourceName(String resourceName);
    
    /**
     * 按资源名称模糊查询
     * @param resourceName 资源名称（支持%通配符）
     * @return ProcessDefinitionQuery 查询对象
     */
    ProcessDefinitionQuery resourceNameLike(String resourceName);
}
```

### 3.2 RuntimeService方法参数规范

#### 3.2.1 ProcessInstanceBuilder

```java
package org.flowable.engine.runtime;

/**
 * 流程实例构建器
 */
public interface ProcessInstanceBuilder {
    
    /**
     * 设置流程定义键
     * @param processDefinitionKey 流程定义键
     * @return ProcessInstanceBuilder 构建器
     */
    ProcessInstanceBuilder processDefinitionKey(String processDefinitionKey);
    
    /**
     * 设置流程定义ID
     * @param processDefinitionId 流程定义ID
     * @return ProcessInstanceBuilder 构建器
     */
    ProcessInstanceBuilder processDefinitionId(String processDefinitionId);
    
    /**
     * 设置业务键
     * @param businessKey 业务键
     * @return ProcessInstanceBuilder 构建器
     */
    ProcessInstanceBuilder businessKey(String businessKey);
    
    /**
     * 设置流程实例名称
     * @param processInstanceName 流程实例名称
     * @return ProcessInstanceBuilder 构建器
     */
    ProcessInstanceBuilder processInstanceName(String processInstanceName);
    
    /**
     * 设置变量
     * @param variableName 变量名
     * @param value 变量值
     * @return ProcessInstanceBuilder 构建器
     */
    ProcessInstanceBuilder variable(String variableName, Object value);
    
    /**
     * 批量设置变量
     * @param variables 变量Map
     * @return ProcessInstanceBuilder 构建器
     */
    ProcessInstanceBuilder variables(Map<String, Object> variables);
    
    /**
     * 设置租户ID
     * @param tenantId 租户ID
     * @return ProcessInstanceBuilder 构建器
     */
    ProcessInstanceBuilder tenantId(String tenantId);
    
    /**
     * 启动流程实例
     * @return ProcessInstance 流程实例
     */
    ProcessInstance start();
}
```

#### 3.2.2 ProcessInstanceQuery

```java
package org.flowable.engine.runtime;

/**
 * 流程实例查询接口
 */
public interface ProcessInstanceQuery extends Query<ProcessInstance, ProcessInstanceQuery> {
    
    /**
     * 按流程实例ID查询
     * @param processInstanceId 流程实例ID
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery processInstanceId(String processInstanceId);
    
    /**
     * 按流程定义ID查询
     * @param processDefinitionId 流程定义ID
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery processDefinitionId(String processDefinitionId);
    
    /**
     * 按流程定义键查询
     * @param processDefinitionKey 流程定义键
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery processDefinitionKey(String processDefinitionKey);
    
    /**
     * 按业务键查询
     * @param businessKey 业务键
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery processInstanceBusinessKey(String businessKey);
    
    /**
     * 按业务键模糊查询
     * @param businessKey 业务键（支持%通配符）
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery processInstanceBusinessKeyLike(String businessKey);
    
    /**
     * 按流程实例名称查询
     * @param name 流程实例名称
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery processInstanceName(String name);
    
    /**
     * 按流程实例名称模糊查询
     * @param name 流程实例名称（支持%通配符）
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery processInstanceNameLike(String name);
    
    /**
     * 按租户ID查询
     * @param tenantId 租户ID
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery processInstanceTenantId(String tenantId);
    
    /**
     * 查询不带租户ID的流程实例
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery withoutTenantId();
    
    /**
     * 按是否暂停查询
     * @param suspended 是否暂停
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery suspended(boolean suspended);
    
    /**
     * 按是否活跃查询
     * @param active 是否活跃
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery active(boolean active);
    
    /**
     * 按变量查询
     * @param variableName 变量名
     * @param variableValue 变量值
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery variableValueEquals(String variableName, Object variableValue);
    
    /**
     * 按变量模糊查询
     * @param variableName 变量名
     * @param variableValue 变量值（支持%通配符）
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery variableValueLike(String variableName, String variableValue);
    
    /**
     * 按变量存在查询
     * @param variableName 变量名
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery variableValueExists(String variableName);
    
    /**
     * 按发起人查询
     * @param startedBy 发起人ID
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery startedBy(String startedBy);
    
    /**
     * 按开始时间查询
     * @param startedAfter 开始时间之后
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery startedAfter(Date startedAfter);
    
    /**
     * 按开始时间查询
     * @param startedBefore 开始时间之前
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery startedBefore(Date startedBefore);
    
    /**
     * 按子流程实例ID查询
     * @param superProcessInstanceId 父流程实例ID
     * @return ProcessInstanceQuery 查询对象
     */
    ProcessInstanceQuery superProcessInstanceId(String superProcessInstanceId);
}
```

## 4. API设计一致性

### 4.1 命名规范

#### 4.1.1 方法命名

| 操作类型 | 命名模式 | 示例 |
|---------|---------|------|
| 查询 | `get` + 实体名 | `getProcessDefinition()` |
| 创建 | `create` + 实体名 | `createDeployment()` |
| 删除 | `delete` + 实体名 | `deleteDeployment()` |
| 更新 | `update` + 实体名 | `updateProcessDefinition()` |
| 设置 | `set` + 属性名 | `setDeploymentCategory()` |
| 启动 | `start` + 实体名 | `startProcessInstance()` |
| 暂停 | `suspend` + 实体名 | `suspendProcessDefinition()` |
| 激活 | `activate` + 实体名 | `activateProcessDefinition()` |

#### 4.1.2 查询接口命名

| 查询类型 | 接口命名 | 示例 |
|---------|---------|------|
| 创建查询 | `create` + 实体名 + `Query` | `createProcessDefinitionQuery()` |
| 原生查询 | `createNative` + 实体名 + `Query` | `createNativeProcessDefinitionQuery()` |

### 4.2 参数类型规范

#### 4.2.1 基础类型

| 参数类型 | 用途 | 示例 |
|---------|------|------|
| `String` | ID、名称、键等 | `processDefinitionId`, `businessKey` |
| `Integer` | 版本号 | `version` |
| `Boolean` | 标志位 | `suspended`, `active` |
| `Date` | 时间戳 | `startedAfter`, `startedBefore` |
| `Map<String, Object>` | 变量集合 | `variables` |
| `Collection<String>` | ID集合 | `processInstanceIds` |
| `InputStream` | 资源流 | `inputStream` |

#### 4.2.2 集合类型

| 集合类型 | 用途 | 示例 |
|---------|------|------|
| `List<T>` | 结果列表 | `List<ProcessDefinition>` |
| `Map<K, V>` | 键值对 | `Map<String, Object>` |
| `Set<T>` | 唯一集合 | `Set<String>` |

### 4.3 返回值规范

#### 4.3.1 实体类型

| 返回类型 | 用途 | 示例 |
|---------|------|------|
| `T` | 单个实体 | `ProcessDefinition` |
| `List<T>` | 实体列表 | `List<ProcessDefinition>` |
| `Map<K, V>` | 键值对 | `Map<String, Object>` |
| `InputStream` | 资源流 | `getProcessDiagram()` |
| `void` | 无返回值 | `deleteDeployment()` |

#### 4.3.2 查询类型

| 返回类型 | 用途 | 示例 |
|---------|------|------|
| `Query<T, Q>` | 查询接口 | `ProcessDefinitionQuery` |
| `NativeQuery<T>` | 原生查询接口 | `NativeProcessDefinitionQuery` |

## 5. API版本兼容性策略

### 5.1 版本管理

#### 5.1.1 版本号规则

Flowable采用语义化版本号（Semantic Versioning）：

```
MAJOR.MINOR.PATCH
```

- **MAJOR**：不兼容的API修改
- **MINOR**：向后兼容的功能新增
- **PATCH**：向后兼容的问题修复

#### 5.1.2 版本常量

```java
public interface ProcessEngine extends Engine {
    /** Flowable库的版本 */
    String VERSION = FlowableVersions.CURRENT_VERSION;
}
```

### 5.2 废弃API管理

#### 5.2.1 废弃标记

```java
/**
 * @deprecated 使用 {@link #getCleanInstancesEndedAfter()} 代替
 */
@Deprecated
public int getCleanInstancesEndedAfterNumberOfDays() {
    return (int) cleanInstancesEndedAfter.toDays();
}
```

#### 5.2.2 废弃策略

1. **标记@Deprecated**：使用@Deprecated注解标记
2. **提供替代方案**：在Javadoc中说明替代方法
3. **保持向后兼容**：废弃API继续工作，但建议迁移
4. **文档说明**：在迁移指南中详细说明

### 5.3 API演进路线

#### 5.3.1 演进阶段

```
当前版本 (Current)
    ↓
废弃警告 (Deprecated)
    ↓
移除 (Removed)
```

#### 5.3.2 演进时间表

| 阶段 | 时间 | 说明 |
|-----|------|------|
| 当前版本 | 发布时 | API可用 |
| 废弃警告 | 发布后1个主版本 | 标记@Deprecated |
| 移除 | 废弃后2个主版本 | 完全移除 |

## 6. API设计评估

### 6.1 一致性评估

| 维度 | 评分 | 说明 |
|-----|------|------|
| 命名一致性 | ⭐⭐⭐⭐⭐ | 统一的命名规范 |
| 参数一致性 | ⭐⭐⭐⭐⭐ | 统一的参数类型 |
| 返回值一致性 | ⭐⭐⭐⭐⭐ | 统一的返回值类型 |
| 文档一致性 | ⭐⭐⭐⭐ | 完善的Javadoc |

### 6.2 易用性评估

| 维度 | 评分 | 说明 |
|-----|------|------|
| 学习曲线 | ⭐⭐⭐ | 需要一定的学习成本 |
| API直观性 | ⭐⭐⭐⭐ | API设计直观易懂 |
| 错误处理 | ⭐⭐⭐⭐ | 完善的异常体系 |
| 示例代码 | ⭐⭐⭐⭐ | 丰富的示例 |

### 6.3 版本兼容性评估

| 维度 | 评分 | 说明 |
|-----|------|------|
| 向后兼容 | ⭐⭐⭐⭐⭐ | 强烈的向后兼容承诺 |
| 废弃管理 | ⭐⭐⭐⭐ | 清晰的废弃策略 |
| 迁移支持 | ⭐⭐⭐⭐ | 完善的迁移指南 |
| 版本稳定性 | ⭐⭐⭐⭐ | 稳定的版本发布 |

## 7. 总结

Flowable Engine的API设计体现了以下特点：

1. **清晰的层次结构**：引擎、服务、实体、查询四层API结构清晰
2. **统一的命名规范**：一致的命名模式，易于理解和使用
3. **完善的参数规范**：统一的参数类型和返回值类型
4. **强大的查询能力**：灵活的查询接口，支持复杂查询
5. **良好的版本兼容性**：清晰的废弃策略和迁移路径

API设计的核心优势在于：
- 高度一致性，降低学习成本
- 强大的查询能力，满足复杂业务需求
- 良好的向后兼容性，保护现有投资
- 完善的文档和示例，便于快速上手

面临的挑战主要包括API数量庞大、学习曲线陡峭等，但通过良好的文档和社区支持，这些挑战都可以得到有效克服。
