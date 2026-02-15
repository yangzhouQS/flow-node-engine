/**
 * 流程图生成服务单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessDiagramGeneratorService } from './process-diagram-generator.service';
import { ImageType, DiagramElementType } from '../interfaces/diagram.interface';

describe('ProcessDiagramGeneratorService', () => {
  let service: ProcessDiagramGeneratorService;

  // 简单的BPMN XML示例
  const simpleBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC">
  <bpmn:process id="simpleProcess" name="Simple Process">
    <bpmn:startEvent id="start" name="Start"/>
    <bpmn:userTask id="task1" name="Review Task"/>
    <bpmn:endEvent id="end" name="End"/>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <bpmn:sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diagram">
    <bpmndi:BPMNPlane id="plane" bpmnElement="simpleProcess">
      <bpmndi:BPMNShape id="start_shape" bpmnElement="start">
        <dc:Bounds x="100" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="task1_shape" bpmnElement="task1">
        <dc:Bounds x="200" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_shape" bpmnElement="end">
        <dc:Bounds x="350" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow1_edge" bpmnElement="flow1">
        <di:waypoint x="136" y="118"/>
        <di:waypoint x="200" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow2_edge" bpmnElement="flow2">
        <di:waypoint x="300" y="118"/>
        <di:waypoint x="350" y="118"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

  // 带网关的BPMN XML
  const gatewayBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC">
  <bpmn:process id="gatewayProcess" name="Gateway Process">
    <bpmn:startEvent id="start" name="Start"/>
    <bpmn:exclusiveGateway id="gateway1" name="Decision"/>
    <bpmn:userTask id="task1" name="Task A"/>
    <bpmn:userTask id="task2" name="Task B"/>
    <bpmn:endEvent id="end" name="End"/>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="gateway1"/>
    <bpmn:sequenceFlow id="flow2" sourceRef="gateway1" targetRef="task1"/>
    <bpmn:sequenceFlow id="flow3" sourceRef="gateway1" targetRef="task2"/>
    <bpmn:sequenceFlow id="flow4" sourceRef="task1" targetRef="end"/>
    <bpmn:sequenceFlow id="flow5" sourceRef="task2" targetRef="end"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diagram">
    <bpmndi:BPMNPlane id="plane" bpmnElement="gatewayProcess">
      <bpmndi:BPMNShape id="start_shape" bpmnElement="start">
        <dc:Bounds x="100" y="200" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gateway1_shape" bpmnElement="gateway1">
        <dc:Bounds x="200" y="192" width="50" height="50"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="task1_shape" bpmnElement="task1">
        <dc:Bounds x="300" y="100" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="task2_shape" bpmnElement="task2">
        <dc:Bounds x="300" y="300" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_shape" bpmnElement="end">
        <dc:Bounds x="500" y="200" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

  beforeEach(() => {
    service = new ProcessDiagramGeneratorService();
  });

  describe('generateSvgDiagram', () => {
    it('should generate SVG from simple BPMN', async () => {
      const svg = await service.generateSvgDiagram(simpleBpmnXml);

      expect(svg).toBeDefined();
      expect(svg).toContain('<?xml version="1.0"');
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('should include BPMN elements in SVG', async () => {
      const svg = await service.generateSvgDiagram(simpleBpmnXml);

      // 检查SVG包含元素
      expect(svg).toContain('circle'); // 开始/结束事件
      expect(svg).toContain('rect'); // 任务
      expect(svg).toContain('path'); // 连线
    });

    it('should generate SVG with gateway', async () => {
      const svg = await service.generateSvgDiagram(gatewayBpmnXml);

      expect(svg).toBeDefined();
      expect(svg).toContain('polygon'); // 网关是菱形
    });

    it('should highlight specified activities', async () => {
      const svg = await service.generateSvgDiagram(simpleBpmnXml, {
        highlightedActivities: ['task1'],
        highlightColor: '#00FF00',
      });

      expect(svg).toBeDefined();
      // 高亮元素应该使用高亮颜色
    });
  });

  describe('generatePngDiagram', () => {
    it('should generate PNG diagram', async () => {
      const buffer = await service.generatePngDiagram(simpleBpmnXml);

      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });

  describe('generateJpegDiagram', () => {
    it('should generate JPEG diagram', async () => {
      const buffer = await service.generateJpegDiagram(simpleBpmnXml);

      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });

  describe('generateDiagram', () => {
    it('should generate diagram with specified image type', async () => {
      const buffer = await service.generateDiagram(simpleBpmnXml, {
        imageType: ImageType.SVG,
      });

      expect(buffer).toBeDefined();
      expect(buffer.toString()).toContain('<svg');
    });

    it('should apply custom colors', async () => {
      const buffer = await service.generateDiagram(simpleBpmnXml, {
        imageType: ImageType.SVG,
        colors: {
          startEvent: '#FF0000',
          endEvent: '#0000FF',
          userTask: '#00FF00',
        },
      });

      expect(buffer).toBeDefined();
    });
  });

  describe('getDiagramLayout', () => {
    it('should return diagram layout', async () => {
      const layout = await service.getDiagramLayout(simpleBpmnXml);

      expect(layout).toBeDefined();
      expect(layout.canvasWidth).toBeGreaterThan(0);
      expect(layout.canvasHeight).toBeGreaterThan(0);
      expect(layout.elementGraphicInfo).toBeDefined();
    });

    it('should include element positions', async () => {
      const layout = await service.getDiagramLayout(simpleBpmnXml);

      expect(layout.elementGraphicInfo.size).toBeGreaterThan(0);
    });
  });

  describe('generateProcessInstanceDiagram', () => {
    it('should generate diagram with highlighted activities', async () => {
      const buffer = await service.generateProcessInstanceDiagram(
        simpleBpmnXml,
        ['task1'],
        { imageType: ImageType.SVG }
      );

      expect(buffer).toBeDefined();
      const svg = buffer.toString();
      expect(svg).toContain('<svg');
    });

    it('should highlight multiple activities', async () => {
      const buffer = await service.generateProcessInstanceDiagram(
        gatewayBpmnXml,
        ['task1', 'task2'],
        { imageType: ImageType.SVG }
      );

      expect(buffer).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid BPMN XML', async () => {
      await expect(service.generateSvgDiagram('invalid xml')).rejects.toThrow();
    });

    it('should handle empty BPMN', async () => {
      const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
</bpmn:definitions>`;

      await expect(service.generateSvgDiagram(emptyXml)).rejects.toThrow();
    });
  });

  describe('BPMN element rendering', () => {
    it('should render start event correctly', async () => {
      const svg = await service.generateSvgDiagram(simpleBpmnXml);
      expect(svg).toContain('circle');
    });

    it('should render end event correctly', async () => {
      const svg = await service.generateSvgDiagram(simpleBpmnXml);
      expect(svg).toContain('circle');
    });

    it('should render user task correctly', async () => {
      const svg = await service.generateSvgDiagram(simpleBpmnXml);
      expect(svg).toContain('rect');
      expect(svg).toContain('rx="10"'); // 圆角
    });

    it('should render exclusive gateway correctly', async () => {
      const svg = await service.generateSvgDiagram(gatewayBpmnXml);
      expect(svg).toContain('polygon');
    });

    it('should include element labels', async () => {
      const svg = await service.generateSvgDiagram(simpleBpmnXml);
      expect(svg).toContain('Review Task');
    });
  });
});
