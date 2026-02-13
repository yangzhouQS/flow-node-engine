/**
 * 测试数据 Fixtures
 * 提供常用的测试数据
 */

/**
 * 测试用户数据
 */
export const testUsers = {
  admin: {
    id: 'admin-001',
    username: 'admin',
    email: 'admin@test.com',
    password: 'Admin@123',
    firstName: 'Admin',
    lastName: 'User',
    roles: ['admin'],
  },
  user1: {
    id: 'user-001',
    username: 'testuser1',
    email: 'testuser1@test.com',
    password: 'Test@123',
    firstName: 'Test',
    lastName: 'User1',
    roles: ['user'],
  },
  user2: {
    id: 'user-002',
    username: 'testuser2',
    email: 'testuser2@test.com',
    password: 'Test@123',
    firstName: 'Test',
    lastName: 'User2',
    roles: ['user'],
  },
  manager: {
    id: 'manager-001',
    username: 'manager',
    email: 'manager@test.com',
    password: 'Manager@123',
    firstName: 'Manager',
    lastName: 'User',
    roles: ['manager'],
  },
};

/**
 * 测试流程定义数据
 */
export const testProcessDefinitions = {
  simpleApproval: {
    id: 'simple-approval-001',
    key: 'simple_approval_process',
    name: '简单审批流程',
    version: 1,
    category: '审批流程',
    deploymentId: 'deployment-001',
    resourceName: 'simple_approval.bpmn20.xml',
    suspended: false,
  },
  multiStepApproval: {
    id: 'multi-step-approval-001',
    key: 'multi_step_approval_process',
    name: '多级审批流程',
    version: 1,
    category: '审批流程',
    deploymentId: 'deployment-002',
    resourceName: 'multi_step_approval.bpmn20.xml',
    suspended: false,
  },
  parallelApproval: {
    id: 'parallel-approval-001',
    key: 'parallel_approval_process',
    name: '并行审批流程',
    version: 1,
    category: '审批流程',
    deploymentId: 'deployment-003',
    resourceName: 'parallel_approval.bpmn20.xml',
    suspended: false,
  },
};

/**
 * 测试流程实例数据
 */
export const testProcessInstances = {
  running: {
    id: 'process-instance-001',
    processDefinitionId: 'simple-approval-001',
    processDefinitionKey: 'simple_approval_process',
    processDefinitionName: '简单审批流程',
    businessKey: 'biz-001',
    startTime: new Date('2024-01-01T10:00:00Z'),
    suspended: false,
  },
  completed: {
    id: 'process-instance-002',
    processDefinitionId: 'simple-approval-001',
    processDefinitionKey: 'simple_approval_process',
    processDefinitionName: '简单审批流程',
    businessKey: 'biz-002',
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T12:00:00Z'),
    suspended: false,
  },
};

/**
 * 测试任务数据
 */
export const testTasks = {
  pendingApproval: {
    id: 'task-001',
    name: '待审批',
    description: '等待审批的任务',
    assignee: 'user-001',
    owner: null,
    processInstanceId: 'process-instance-001',
    processDefinitionId: 'simple-approval-001',
    taskDefinitionKey: 'approval_task',
    createTime: new Date('2024-01-01T10:30:00Z'),
    priority: 50,
    dueDate: null,
    category: '审批任务',
    formKey: 'approval_form',
    parentTaskId: null,
    suspended: false,
  },
  completedTask: {
    id: 'task-002',
    name: '已完成的任务',
    description: '这是一个已完成的任务',
    assignee: 'user-001',
    owner: null,
    processInstanceId: 'process-instance-002',
    processDefinitionId: 'simple-approval-001',
    taskDefinitionKey: 'submit_task',
    createTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T10:30:00Z'),
    priority: 50,
    dueDate: null,
    category: '提交任务',
    formKey: 'submit_form',
    parentTaskId: null,
    suspended: false,
  },
};

/**
 * 测试 BPMN XML 示例
 */
export const testBpmnXml = {
  simpleProcess: `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             targetNamespace="http://flowable.org/test">
  <process id="simple_process" name="简单流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <userTask id="task1" name="用户任务" flowable:assignee="\${assignee}"/>
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`,

  approvalProcess: `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             targetNamespace="http://flowable.org/test">
  <process id="approval_process" name="审批流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="submitTask"/>
    <userTask id="submitTask" name="提交申请" flowable:assignee="\${submitter}"/>
    <sequenceFlow id="flow2" sourceRef="submitTask" targetRef="approveTask"/>
    <userTask id="approveTask" name="审批" flowable:candidateGroups="managers"/>
    <sequenceFlow id="flow3" sourceRef="approveTask" targetRef="gateway"/>
    <exclusiveGateway id="gateway" name="审批结果"/>
    <sequenceFlow id="flow4" sourceRef="gateway" targetRef="endApproved">
      <conditionExpression xsi:type="tFormalExpression">\${approved == true}</conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow5" sourceRef="gateway" targetRef="endRejected">
      <conditionExpression xsi:type="tFormalExpression">\${approved == false}</conditionExpression>
    </sequenceFlow>
    <endEvent id="endApproved" name="审批通过"/>
    <endEvent id="endRejected" name="审批拒绝"/>
  </process>
</definitions>`,
};

/**
 * 测试变量数据
 */
export const testVariables = {
  simple: {
    stringVar: 'test string value',
    numberVar: 123,
    booleanVar: true,
    dateVar: new Date('2024-01-01'),
  },
  processVariables: {
    applicant: 'user-001',
    amount: 10000,
    reason: '测试申请',
    approved: null,
  },
};

/**
 * 测试组织结构数据
 */
export const testGroups = {
  managers: {
    id: 'group-managers',
    name: 'Managers',
    type: 'assignment',
  },
  developers: {
    id: 'group-developers',
    name: 'Developers',
    type: 'assignment',
  },
  hr: {
    id: 'group-hr',
    name: 'HR',
    type: 'assignment',
  },
};
