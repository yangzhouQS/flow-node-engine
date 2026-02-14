import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { BpmnParserService } from './bpmn-parser.service';
import { EventBusService } from './event-bus.service';

describe('BpmnParserService', () => {
  let service: BpmnParserService;
  let eventBusService: EventBusService;

  const mockEventBusService = {
    emit: vi.fn(),
    subscribe: vi.fn(),
  };

  // 有效的 BPMN XML
  const validBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="testProcess" name="测试流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <userTask id="task1" name="任务1"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <endEvent id="end" name="结束"/>
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
  </process>
</definitions>`;

  // 无效的 BPMN XML
  const invalidBpmnXml = `<invalid>not a valid bpmn</invalid>`;

  // 缺少开始事件的 BPMN XML
  const missingStartEventXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="testProcess" name="测试流程">
    <userTask id="task1" name="任务1"/>
    <endEvent id="end" name="结束"/>
    <sequenceFlow id="flow1" sourceRef="task1" targetRef="end"/>
  </process>
</definitions>`;

  // 缺少结束事件的 BPMN XML
  const missingEndEventXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="testProcess" name="测试流程">
    <startEvent id="start" name="开始"/>
    <userTask id="task1" name="任务1"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
  </process>
</definitions>`;

  // 包含网关的 BPMN XML
  const gatewayBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="gatewayProcess" name="网关流程">
    <startEvent id="start"/>
    <exclusiveGateway id="gateway1" name="排他网关"/>
    <parallelGateway id="gateway2" name="并行网关"/>
    <inclusiveGateway id="gateway3" name="包容网关"/>
    <userTask id="task1" name="任务1"/>
    <userTask id="task2" name="任务2"/>
    <endEvent id="end"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="gateway1"/>
    <sequenceFlow id="flow2" sourceRef="gateway1" targetRef="task1"/>
    <sequenceFlow id="flow3" sourceRef="task1" targetRef="end"/>
  </process>
</definitions>`;

  // 包含子流程的 BPMN XML
  const subProcessBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="subProcessTest" name="子流程测试">
    <startEvent id="start"/>
    <subProcess id="subProcess1" name="子流程1">
      <startEvent id="subStart"/>
      <userTask id="subTask1" name="子任务1"/>
      <endEvent id="subEnd"/>
      <sequenceFlow id="subFlow1" sourceRef="subStart" targetRef="subTask1"/>
      <sequenceFlow id="subFlow2" sourceRef="subTask1" targetRef="subEnd"/>
    </subProcess>
    <endEvent id="end"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="subProcess1"/>
    <sequenceFlow id="flow2" sourceRef="subProcess1" targetRef="end"/>
  </process>
</definitions>`;

  // 包含服务任务的 BPMN XML
  const serviceTaskBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="serviceTaskProcess" name="服务任务流程">
    <startEvent id="start"/>
    <serviceTask id="serviceTask1" name="服务任务1"/>
    <endEvent id="end"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="serviceTask1"/>
    <sequenceFlow id="flow2" sourceRef="serviceTask1" targetRef="end"/>
  </process>
</definitions>`;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BpmnParserService,
        {
          provide: EventBusService,
          useValue: mockEventBusService,
        },
      ],
    }).compile();

    service = module.get<BpmnParserService>(BpmnParserService);
    eventBusService = module.get<EventBusService>(EventBusService);
  });

  describe('parse', () => {
    it('应该成功解析有效的 BPMN XML', async () => {
      const result = await service.parse(validBpmnXml);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.processDefinition).toBeDefined();
      expect(result.processDefinition.id).toBe('testProcess');
      expect(result.processDefinition.name).toBe('测试流程');
    });

    it('解析开始时应该发出事件', async () => {
      await service.parse(validBpmnXml);

      expect(mockEventBusService.emit).toHaveBeenCalledWith(
        'bpmn.parse.start',
        { bpmnXml: validBpmnXml },
      );
    });

    it('解析成功时应该发出事件', async () => {
      await service.parse(validBpmnXml);

      expect(mockEventBusService.emit).toHaveBeenCalledWith(
        'bpmn.parse.success',
        expect.objectContaining({
          processDefinition: expect.any(Object),
        }),
      );
    });

    it('解析无效 XML 时应该返回错误', async () => {
      const result = await service.parse(invalidBpmnXml);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('解析失败时应该发出错误事件', async () => {
      await service.parse(invalidBpmnXml);

      expect(mockEventBusService.emit).toHaveBeenCalledWith(
        'bpmn.parse.error',
        expect.objectContaining({
          bpmnXml: invalidBpmnXml,
        }),
      );
    });

    it('应该正确解析开始事件', async () => {
      const result = await service.parse(validBpmnXml);

      expect(result.processDefinition.startEvents).toHaveLength(1);
      expect(result.processDefinition.startEvents[0].id).toBe('start');
      expect(result.processDefinition.startEvents[0].name).toBe('开始');
      expect(result.processDefinition.startEvents[0].type).toBe('bpmn:StartEvent');
    });

    it('应该正确解析用户任务', async () => {
      const result = await service.parse(validBpmnXml);

      expect(result.processDefinition.userTasks).toHaveLength(1);
      expect(result.processDefinition.userTasks[0].id).toBe('task1');
      expect(result.processDefinition.userTasks[0].name).toBe('任务1');
      expect(result.processDefinition.userTasks[0].type).toBe('bpmn:UserTask');
    });

    it('应该正确解析结束事件', async () => {
      const result = await service.parse(validBpmnXml);

      expect(result.processDefinition.endEvents).toHaveLength(1);
      expect(result.processDefinition.endEvents[0].id).toBe('end');
      expect(result.processDefinition.endEvents[0].type).toBe('bpmn:EndEvent');
    });

    it('应该正确解析序列流', async () => {
      const result = await service.parse(validBpmnXml);

      expect(result.processDefinition.sequenceFlows).toHaveLength(2);
      expect(result.processDefinition.sequenceFlows[0].sourceRef).toBe('start');
      expect(result.processDefinition.sequenceFlows[0].targetRef).toBe('task1');
    });

    it('应该正确解析网关', async () => {
      const result = await service.parse(gatewayBpmnXml);

      expect(result.processDefinition.gateways).toHaveLength(3);
      
      const exclusiveGateway = result.processDefinition.gateways.find(
        g => g.type === 'bpmn:ExclusiveGateway',
      );
      expect(exclusiveGateway).toBeDefined();
      expect(exclusiveGateway?.id).toBe('gateway1');

      const parallelGateway = result.processDefinition.gateways.find(
        g => g.type === 'bpmn:ParallelGateway',
      );
      expect(parallelGateway).toBeDefined();
      expect(parallelGateway?.id).toBe('gateway2');

      const inclusiveGateway = result.processDefinition.gateways.find(
        g => g.type === 'bpmn:InclusiveGateway',
      );
      expect(inclusiveGateway).toBeDefined();
      expect(inclusiveGateway?.id).toBe('gateway3');
    });

    it('应该正确解析服务任务', async () => {
      const result = await service.parse(serviceTaskBpmnXml);

      expect(result.processDefinition.serviceTasks).toHaveLength(1);
      expect(result.processDefinition.serviceTasks[0].id).toBe('serviceTask1');
      expect(result.processDefinition.serviceTasks[0].type).toBe('bpmn:ServiceTask');
    });

    it('应该正确解析子流程', async () => {
      const result = await service.parse(subProcessBpmnXml);

      expect(result.processDefinition.subProcesses).toHaveLength(1);
      expect(result.processDefinition.subProcesses[0].id).toBe('subProcess1');
      expect(result.processDefinition.subProcesses[0].userTasks).toHaveLength(1);
    });
  });

  describe('validate', () => {
    it('应该验证有效的 BPMN XML', async () => {
      const result = await service.validate(validBpmnXml);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测缺少开始事件', async () => {
      const result = await service.validate(missingStartEventXml);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('no start event'))).toBe(true);
    });

    it('应该检测缺少结束事件', async () => {
      const result = await service.validate(missingEndEventXml);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('no end event'))).toBe(true);
    });

    it('应该检测无效的 XML', async () => {
      const result = await service.validate(invalidBpmnXml);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该对多个开始事件发出警告', async () => {
      const multipleStartEventsXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="testProcess" name="测试流程">
    <startEvent id="start1"/>
    <startEvent id="start2"/>
    <userTask id="task1"/>
    <endEvent id="end"/>
    <sequenceFlow id="flow1" sourceRef="start1" targetRef="task1"/>
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
  </process>
</definitions>`;

      const result = await service.validate(multipleStartEventsXml);

      expect(result.warnings.some(w => w.includes('multiple start events'))).toBe(true);
    });
  });

  describe('generateDiagram', () => {
    it('应该生成流程图 SVG', async () => {
      const svg = await service.generateDiagram(validBpmnXml);

      expect(svg).toBeDefined();
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('生成开始时应该发出事件', async () => {
      await service.generateDiagram(validBpmnXml);

      expect(mockEventBusService.emit).toHaveBeenCalledWith(
        'bpmn.diagram.start',
        { bpmnXml: validBpmnXml },
      );
    });

    it('生成成功时应该发出事件', async () => {
      await service.generateDiagram(validBpmnXml);

      expect(mockEventBusService.emit).toHaveBeenCalledWith(
        'bpmn.diagram.success',
        expect.objectContaining({
          svg: expect.any(String),
        }),
      );
    });
  });

  describe('parseProcessDefinition', () => {
    it('应该正确设置流程定义属性', async () => {
      const result = await service.parse(validBpmnXml);

      expect(result.processDefinition.id).toBe('testProcess');
      expect(result.processDefinition.name).toBe('测试流程');
      expect(result.processDefinition.isExecutable).toBe(true);
    });

    it('当没有name 时应该使用id 作为name', async () => {
      const noNameXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="testProcess">
    <startEvent id="start"/>
    <endEvent id="end"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="end"/>
  </process>
</definitions>`;

      const result = await service.parse(noNameXml);

      expect(result.processDefinition.name).toBe('testProcess');
    });
  });

  describe('错误处理', () => {
    it('应该处理空 XML', async () => {
      const result = await service.parse('');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该处理 null XML', async () => {
      const result = await service.parse(null as any);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该处理格式错误的 XML', async () => {
      const malformedXml = '<definitions><process></definitions>';
      const result = await service.parse(malformedXml);

      expect(result.isValid).toBe(false);
    });
  });
});
