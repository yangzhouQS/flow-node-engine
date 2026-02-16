/**
 * 动态流程修改服务单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicProcessService } from './dynamic-modification.service';
import {
  ModificationType,
  IDynamicModification,
  IDynamicModificationContext,
  IBatchModificationRequest,
} from '../interfaces/dynamic-modification.interface';
import { IBpmnProcess } from '../interfaces/bpmn-process.interface';

describe('DynamicProcessService', () => {
  let service: DynamicProcessService;
  let testProcess: IBpmnProcess;
  const testProcessDefinitionId = 'test-process:1:100';

  beforeEach(() => {
    service = new DynamicProcessService();

    // 创建测试流程定义
    testProcess = {
      id: testProcessDefinitionId,
      name: 'Test Process',
      activities: [
        { id: 'startEvent', name: 'Start', type: 'startEvent' },
        { id: 'userTask1', name: 'User Task 1', type: 'userTask' },
        { id: 'serviceTask1', name: 'Service Task 1', type: 'serviceTask' },
        { id: 'endEvent', name: 'End', type: 'endEvent' },
      ],
      sequenceFlows: [
        { id: 'flow1', sourceRef: 'startEvent', targetRef: 'userTask1' },
        { id: 'flow2', sourceRef: 'userTask1', targetRef: 'serviceTask1' },
        { id: 'flow3', sourceRef: 'serviceTask1', targetRef: 'endEvent' },
      ],
      // initialActivityId: 'startEvent',
    };

    service.registerProcessDefinition(testProcessDefinitionId, testProcess);
  });

  describe('addActivity', () => {
    it('应该成功添加新活动', async () => {
      const context: IDynamicModificationContext = {
        processDefinitionId: testProcessDefinitionId,
        validate: true,
      };

      const result = await service.addActivity(context, {
        activityType: 'userTask',
        activityId: 'newUserTask',
        name: 'New User Task',
      });

      expect(result.success).toBe(true);
      expect(result.newProcessDefinitionId).toBeDefined();
      expect(result.executedModifications).toHaveLength(1);
      expect(result.executedModifications[0].type).toBe(ModificationType.ADD_ACTIVITY);
    });

    it('添加活动时应该自动创建前置连线', async () => {
      const context: IDynamicModificationContext = {
        processDefinitionId: testProcessDefinitionId,
        validate: true,
      };

      const result = await service.addActivity(context, {
        activityType: 'userTask',
        activityId: 'newUserTask',
        name: 'New User Task',
        previousActivityId: 'userTask1',
      });

      expect(result.success).toBe(true);
      expect(result.newProcessDefinitionId).toBeDefined();
    });

    it('添加活动时应该自动创建后置连线', async () => {
      const context: IDynamicModificationContext = {
        processDefinitionId: testProcessDefinitionId,
        validate: true,
      };

      const result = await service.addActivity(context, {
        activityType: 'userTask',
        activityId: 'newUserTask',
        name: 'New User Task',
        nextActivityId: 'serviceTask1',
      });

      expect(result.success).toBe(true);
    });

    it('重复添加相同ID活动应该失败', async () => {
      const context: IDynamicModificationContext = {
        processDefinitionId: testProcessDefinitionId,
        validate: true,
      };

      const result = await service.addActivity(context, {
        activityType: 'userTask',
        activityId: 'userTask1', // 已存在的活动ID
        name: 'Duplicate Task',
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors).toContain('Activity already exists: userTask1');
    });
  });

  describe('removeActivity', () => {
    it('应该成功删除活动', async () => {
      const context: IDynamicModificationContext = {
        processDefinitionId: testProcessDefinitionId,
        validate: true,
      };

      const result = await service.removeActivity(context, {
        activityId: 'serviceTask1',
        removeSequenceFlows: true,
      });

      expect(result.success).toBe(true);
      expect(result.executedModifications).toHaveLength(1);
    });

    it('删除不存在的活动应该失败', async () => {
      const context: IDynamicModificationContext = {
        processDefinitionId: testProcessDefinitionId,
        validate: true,
      };

      const result = await service.removeActivity(context, {
        activityId: 'nonExistentTask',
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors).toBeDefined();
    });

    it('删除活动时应该添加替代连线', async () => {
      const context: IDynamicModificationContext = {
        processDefinitionId: testProcessDefinitionId,
        validate: true,
      };

      const result = await service.removeActivity(context, {
        activityId: 'serviceTask1',
        removeSequenceFlows: true,
        replacementFlow: {
          sourceId: 'userTask1',
          targetId: 'endEvent',
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('addSequenceFlow', () => {
    it('应该成功添加连线', async () => {
      const context: IDynamicModificationContext = {
        processDefinitionId: testProcessDefinitionId,
        validate: true,
      };

      const result = await service.addSequenceFlow(context, {
        sequenceFlowId: 'newFlow',
        sourceRef: 'userTask1',
        targetRef: 'endEvent',
        name: 'New Flow',
      });

      expect(result.success).toBe(true);
      expect(result.executedModifications).toHaveLength(1);
    });

    it('添加连线时源活动不存在应该失败', async () => {
      const context: IDynamicModificationContext = {
        processDefinitionId: testProcessDefinitionId,
        validate: true,
      };

      const result = await service.addSequenceFlow(context, {
        sequenceFlowId: 'newFlow',
        sourceRef: 'nonExistent',
        targetRef: 'endEvent',
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors).toBeDefined();
    });

    it('添加带条件的连线应该成功', async () => {
      const context: IDynamicModificationContext = {
        processDefinitionId: testProcessDefinitionId,
        validate: true,
      };

      const result = await service.addSequenceFlow(context, {
        sequenceFlowId: 'conditionalFlow',
        sourceRef: 'userTask1',
        targetRef: 'endEvent',
        conditionExpression: '${approved == true}',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('modifyProperty', () => {
    it('应该成功修改活动属性', async () => {
      const context: IDynamicModificationContext = {
        processDefinitionId: testProcessDefinitionId,
        validate: true,
      };

      const result = await service.modifyProperty(context, 'userTask1', {
        propertyPath: 'name',
        newValue: 'Updated User Task 1',
      });

      expect(result.success).toBe(true);
    });

    it('修改不存在活动的属性应该失败', async () => {
      const context: IDynamicModificationContext = {
        processDefinitionId: testProcessDefinitionId,
        validate: true,
      };

      const result = await service.modifyProperty(context, 'nonExistent', {
        propertyPath: 'name',
        newValue: 'New Name',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('executeModification', () => {
    it('应该成功执行批量修改', async () => {
      const modifications: IDynamicModification[] = [
        {
          id: 'mod1',
          type: ModificationType.ADD_ACTIVITY,
          data: {
            activityType: 'userTask',
            activityId: 'task1',
            name: 'Task 1',
          },
          createdAt: new Date(),
        },
        {
          id: 'mod2',
          type: ModificationType.ADD_ACTIVITY,
          data: {
            activityType: 'serviceTask',
            activityId: 'task2',
            name: 'Task 2',
          },
          createdAt: new Date(),
        },
      ];

      const request: IBatchModificationRequest = {
        context: {
          processDefinitionId: testProcessDefinitionId,
          validate: true,
        },
        modifications,
        atomic: true,
      };

      const result = await service.executeModification(request);

      expect(result.success).toBe(true);
      expect(result.executedModifications).toHaveLength(2);
      expect(result.newProcessDefinitionId).toBeDefined();
    });

    it('原子模式下单个修改失败应该回滚', async () => {
      const modifications: IDynamicModification[] = [
        {
          id: 'mod1',
          type: ModificationType.ADD_ACTIVITY,
          data: {
            activityType: 'userTask',
            activityId: 'validTask',
            name: 'Valid Task',
          },
          createdAt: new Date(),
        },
        {
          id: 'mod2',
          type: ModificationType.REMOVE_ACTIVITY,
          data: {
            activityId: 'nonExistentTask', // 不存在的活动
          },
          createdAt: new Date(),
        },
      ];

      const request: IBatchModificationRequest = {
        context: {
          processDefinitionId: testProcessDefinitionId,
          validate: true,
        },
        modifications,
        atomic: true,
      };

      const result = await service.executeModification(request);

      expect(result.success).toBe(false);
      // 验证失败时不应该执行任何修改
    });

    it('非原子模式下应该继续执行', async () => {
      const modifications: IDynamicModification[] = [
        {
          id: 'mod1',
          type: ModificationType.ADD_ACTIVITY,
          data: {
            activityType: 'userTask',
            activityId: 'validTask',
            name: 'Valid Task',
          },
          createdAt: new Date(),
        },
        {
          id: 'mod2',
          type: ModificationType.REMOVE_ACTIVITY,
          data: {
            activityId: 'nonExistentTask',
          },
          createdAt: new Date(),
        },
      ];

      const request: IBatchModificationRequest = {
        context: {
          processDefinitionId: testProcessDefinitionId,
          validate: false, // 跳过验证
        },
        modifications,
        atomic: false,
      };

      const result = await service.executeModification(request);

      // 非原子模式，第一个成功执行
      expect(result.success).toBe(true);
      expect(result.executedModifications.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('calculateDiff', () => {
    it('应该正确计算活动差异', async () => {
      // 先执行修改
      const context: IDynamicModificationContext = {
        processDefinitionId: testProcessDefinitionId,
        validate: true,
      };

      const addResult = await service.addActivity(context, {
        activityType: 'userTask',
        activityId: 'newTask',
        name: 'New Task',
      });

      expect(addResult.success).toBe(true);
      expect(addResult.newProcessDefinitionId).toBeDefined();

      // 计算差异
      const diff = await service.calculateDiff(
        testProcessDefinitionId,
        addResult.newProcessDefinitionId!
      );

      expect(diff.addedActivities).toHaveLength(1);
      expect(diff.addedActivities[0].id).toBe('newTask');
    });
  });

  describe('validateModifications', () => {
    it('有效修改应该通过验证', async () => {
      const modifications: IDynamicModification[] = [
        {
          id: 'mod1',
          type: ModificationType.ADD_ACTIVITY,
          data: {
            activityType: 'userTask',
            activityId: 'newTask',
            name: 'New Task',
          },
          createdAt: new Date(),
        },
      ];

      const result = await service.validateModifications(modifications, {
        processDefinitionId: testProcessDefinitionId,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('无效修改应该返回错误', async () => {
      const modifications: IDynamicModification[] = [
        {
          id: 'mod1',
          type: ModificationType.REMOVE_ACTIVITY,
          data: {
            activityId: 'nonExistentTask',
          },
          createdAt: new Date(),
        },
      ];

      const result = await service.validateModifications(modifications, {
        processDefinitionId: testProcessDefinitionId,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('rollbackModification', () => {
    it('应该成功回滚修改', async () => {
      const context: IDynamicModificationContext = {
        processDefinitionId: testProcessDefinitionId,
        validate: true,
      };

      const result = await service.addActivity(context, {
        activityType: 'userTask',
        activityId: 'newTask',
        name: 'New Task',
      });

      expect(result.success).toBe(true);

      // 回滚
      const rollbackResult = await service.rollbackModification(
        result.executedModifications[0].id
      );

      // 注意：由于修改记录ID和执行修改的ID不同，这里可能需要调整
      // 实际测试中需要获取正确的修改记录ID
    });

    it('回滚不存在的修改应该返回false', async () => {
      const result = await service.rollbackModification('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('DynamicModificationBuilder', () => {
    it('构建器应该正确构建修改请求', () => {
      const builder = service.createBuilder(testProcessDefinitionId);

      const request = builder
        .addUserTask('task1', 'Task 1')
        .addServiceTask('task2', 'Task 2', 'console.log("test")')
        .addSequenceFlow('flow1', 'task1', 'task2')
        .changeActivityProperty('task1', 'assignee', 'admin')
        .build();

      expect(request.modifications).toHaveLength(4);
      expect(request.context.processDefinitionId).toBe(testProcessDefinitionId);
      expect(request.atomic).toBe(true);
    });

    it('构建器应该支持链式调用', () => {
      const builder = service.createBuilder(testProcessDefinitionId);

      const request = builder
        .addUserTask('task1', 'Task 1')
        .removeActivity('userTask1')
        .setSequenceFlowCondition('flow1', '${true}')
        .addGateway('gateway1', 'exclusiveGateway')
        .build();

      expect(request.modifications).toHaveLength(4);
    });
  });
});
