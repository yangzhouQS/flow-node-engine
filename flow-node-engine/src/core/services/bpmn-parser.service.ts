import { Injectable, Logger } from '@nestjs/common';
import { BpmnModdle } from 'bpmn-moddle';

import { EventBusService } from './event-bus.service';

/**
 * BPMN 2.0 流程定义接口
 */
export interface BpmnProcessDefinition {
  id: string;
  name: string;
  version?: string;
  isExecutable?: boolean;
  startEvents: BpmnElement[];
  userTasks: BpmnElement[];
  serviceTasks: BpmnElement[];
  gateways: BpmnElement[];
  endEvents: BpmnElement[];
  sequenceFlows: BpmnSequenceFlow[];
  subProcesses: BpmnProcessDefinition[];
}

/**
 * BPMN 元素接口
 */
export interface BpmnElement {
  id: string;
  name?: string;
  type: string;
  properties?: Record<string, any>;
  // Call Activity 属性
  calledElement?: string;
  calledElementBinding?: string;
  calledElementVersionTag?: string;
  async?: boolean;
  asyncBefore?: boolean;
  // IO Specification
  ioSpecification?: any;
  dataInputAssociations?: any[];
  dataOutputAssociations?: any[];
  // Sub Process 属性
  children?: BpmnElement[];
  flowElements?: BpmnElement[];
  triggeredByEvent?: boolean;
  // Event 属性
  isInterrupting?: boolean;
  incoming?: string[];
  outgoing?: string[];
  // Event Definitions
  signalRef?: string;
  signalEventDefinition?: any;
  messageRef?: string;
  messageEventDefinition?: any;
  timerEventDefinition?: any;
  errorRef?: string;
  errorEventDefinition?: any;
  escalationRef?: string;
  escalationEventDefinition?: any;
  conditionExpression?: any;
  conditionalEventDefinition?: any;
  compensationEventDefinition?: any;
}

/**
 * BPMN 序列流接口
 */
export interface BpmnSequenceFlow {
  id: string;
  sourceRef: string;
  targetRef: string;
  conditionExpression?: string;
  name?: string;
}

/**
 * BPMN 解析结果
 */
export interface BpmnParseResult {
  processDefinition: BpmnProcessDefinition;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * BPMN 解析服务
 * 用于解析 BPMN 2.0 XML 文件
 */
@Injectable()
export class BpmnParserService {
  private readonly logger = new Logger(BpmnParserService.name);
  private readonly moddle = new BpmnModdle({
    camunda: 'http://camunda.org/schema/1.0/bpmn',
  });

  constructor(private readonly eventBusService: EventBusService) {}

  /**
   * 解析 BPMN XML
   * @param bpmnXml BPMN XML 字符串
   * @returns 解析结果
   */
  async parse(bpmnXml: string): Promise<BpmnParseResult> {
    try {
      this.logger.debug('Parsing BPMN XML...');
      this.eventBusService.emit('bpmn.parse.start', { bpmnXml });

      const result = await this.moddle.fromXML(bpmnXml);
      const definitions = result.rootElement;

      if (!definitions) {
        throw new Error('Invalid BPMN XML: no definitions found');
      }

      // 验证 BPMN
      const validation = await this.validate(bpmnXml);
      if (!validation.isValid) {
        this.eventBusService.emit('bpmn.parse.error', {
          bpmnXml,
          errors: validation.errors,
        });
        return {
          processDefinition: null as any,
          ...validation,
        };
      }

      // 解析流程定义
      const processDefinition = this.parseProcessDefinition(definitions);

      const parseResult: BpmnParseResult = {
        processDefinition,
        isValid: true,
        errors: [],
        warnings: [],
      };

      this.eventBusService.emit('bpmn.parse.success', {
        processDefinition,
      });

      return parseResult;
    } catch (error) {
      this.logger.error('Failed to parse BPMN XML', (error as Error).stack);
      this.eventBusService.emit('bpmn.parse.error', {
        bpmnXml,
        error: (error as Error).message,
      });

      return {
        processDefinition: null as any,
        isValid: false,
        errors: [(error as Error).message],
        warnings: [],
      };
    }
  }

  /**
   * 验证 BPMN XML
   * @param bpmnXml BPMN XML 字符串
   * @returns 验证结果
   */
  async validate(bpmnXml: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const result = await this.moddle.fromXML(bpmnXml);
      const definitions = result.rootElement;

      if (!definitions) {
        errors.push('No definitions found in BPMN XML');
        return { isValid: false, errors, warnings };
      }

      const processes = this.getProcesses(definitions);

      if (processes.length === 0) {
        errors.push('No process found in BPMN definitions');
        return { isValid: false, errors, warnings };
      }

      // 验证每个流程
      for (const process of processes) {
        this.validateProcess(process, errors, warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(`Validation error: ${(error as Error).message}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * 生成流程图 SVG
   * @param bpmnXml BPMN XML 字符串
   * @returns SVG 字符串
   */
  async generateDiagram(bpmnXml: string): Promise<string> {
    try {
      this.logger.debug('Generating BPMN diagram...');
      this.eventBusService.emit('bpmn.diagram.start', { bpmnXml });

      // 注意：实际项目中需要使用 bpmn-js 来生成流程图
      // 这里返回一个占位符
      const svg = `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f5f5f5"/>
        <text x="400" y="300" text-anchor="middle" font-size="20">流程图生成功能待实现</text>
      </svg>`;

      this.eventBusService.emit('bpmn.diagram.success', { svg });
      return svg;
    } catch (error) {
      this.logger.error('Failed to generate BPMN diagram', (error as Error).stack);
      this.eventBusService.emit('bpmn.diagram.error', {
        bpmnXml,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 解析流程定义
   * @param definitions BPMN 定义对象
   * @returns 流程定义
   */
  private parseProcessDefinition(definitions: any): BpmnProcessDefinition {
    const processes = this.getProcesses(definitions);
    const mainProcess = processes[0];

    return {
      id: mainProcess.id,
      name: mainProcess.name || mainProcess.id,
      version: definitions.version,
      isExecutable: mainProcess.isExecutable,
      startEvents: this.parseElements(mainProcess, 'bpmn:StartEvent'),
      userTasks: this.parseElements(mainProcess, 'bpmn:UserTask'),
      serviceTasks: this.parseElements(mainProcess, 'bpmn:ServiceTask'),
      gateways: this.parseGateways(mainProcess),
      endEvents: this.parseElements(mainProcess, 'bpmn:EndEvent'),
      sequenceFlows: this.parseSequenceFlows(mainProcess),
      subProcesses: this.parseSubProcesses(mainProcess),
    };
  }

  /**
   * 获取所有流程
   * @param definitions BPMN 定义对象
   * @returns 流程数组
   */
  private getProcesses(definitions: any): any[] {
    return definitions.rootElements?.filter(
      (el: any) => el.$type === 'bpmn:Process',
    ) || [];
  }

  /**
   * 解析元素
   * @param process 流程对象
   * @param elementType 元素类型
   * @returns 元素数组
   */
  private parseElements(
    process: any,
    elementType: string,
  ): BpmnElement[] {
    return (process.flowElements || [])
      .filter((el: any) => el.$type === elementType)
      .map((el: any) => ({
        id: el.id,
        name: el.name,
        type: el.$type,
        properties: this.extractProperties(el),
      }));
  }

  /**
   * 解析网关
   * @param process 流程对象
   * @returns 网关数组
   */
  private parseGateways(process: any): BpmnElement[] {
    const gatewayTypes = [
      'bpmn:ExclusiveGateway',
      'bpmn:ParallelGateway',
      'bpmn:InclusiveGateway',
      'bpmn:EventBasedGateway',
    ];

    return (process.flowElements || [])
      .filter((el: any) => gatewayTypes.includes(el.$type))
      .map((el: any) => ({
        id: el.id,
        name: el.name,
        type: el.$type,
        properties: this.extractProperties(el),
      }));
  }

  /**
   * 解析序列流
   * @param process 流程对象
   * @returns 序列流数组
   */
  private parseSequenceFlows(process: any): BpmnSequenceFlow[] {
    return (process.flowElements || [])
      .filter((el: any) => el.$type === 'bpmn:SequenceFlow')
      .map((el: any) => ({
        id: el.id,
        sourceRef: el.sourceRef.id,
        targetRef: el.targetRef.id,
        conditionExpression: el.conditionExpression?.body,
        name: el.name,
      }));
  }

  /**
   * 解析子流程
   * @param process 流程对象
   * @returns 子流程数组
   */
  private parseSubProcesses(process: any): BpmnProcessDefinition[] {
    return (process.flowElements || [])
      .filter((el: any) => el.$type === 'bpmn:SubProcess')
      .map((el: any) => ({
        id: el.id,
        name: el.name || el.id,
        version: undefined,
        isExecutable: el.isExecutable,
        startEvents: this.parseElements(el, 'bpmn:StartEvent'),
        userTasks: this.parseElements(el, 'bpmn:UserTask'),
        serviceTasks: this.parseElements(el, 'bpmn:ServiceTask'),
        gateways: this.parseGateways(el),
        endEvents: this.parseElements(el, 'bpmn:EndEvent'),
        sequenceFlows: this.parseSequenceFlows(el),
        subProcesses: this.parseSubProcesses(el),
      }));
  }

  /**
   * 提取元素属性
   * @param element BPMN 元素
   * @returns 属性对象
   */
  private extractProperties(element: any): Record<string, any> {
    const properties: Record<string, any> = {};

    // 提取 Camunda 扩展属性
    if (element.extensionElements) {
      const propertiesElement = element.extensionElements.values?.find(
        (el: any) => el.$type === 'camunda:Properties',
      );
      if (propertiesElement) {
        for (const prop of propertiesElement.values || []) {
          if (prop.$type === 'camunda:Property') {
            properties[prop.name] = prop.value;
          }
        }
      }
    }

    return properties;
  }

  /**
   * 验证流程
   * @param process 流程对象
   * @param errors 错误数组
   * @param warnings 警告数组
   */
  private validateProcess(
    process: any,
    errors: string[],
    warnings: string[],
  ): void {
    // 检查是否有开始事件
    const startEvents = (process.flowElements || []).filter(
      (el: any) => el.$type === 'bpmn:StartEvent',
    );
    if (startEvents.length === 0) {
      errors.push(`Process ${process.id} has no start event`);
    } else if (startEvents.length > 1) {
      warnings.push(`Process ${process.id} has multiple start events`);
    }

    // 检查是否有结束事件
    const endEvents = (process.flowElements || []).filter(
      (el: any) => el.$type === 'bpmn:EndEvent',
    );
    if (endEvents.length === 0) {
      errors.push(`Process ${process.id} has no end event`);
    }

    // 检查序列流是否有效
    const sequenceFlows = (process.flowElements || []).filter(
      (el: any) => el.$type === 'bpmn:SequenceFlow',
    );
    const elementIds = new Set(
      (process.flowElements || []).map((el: any) => el.id),
    );

    for (const flow of sequenceFlows) {
      if (!elementIds.has(flow.sourceRef?.id)) {
        errors.push(
          `Sequence flow ${flow.id} references non-existent source: ${flow.sourceRef?.id}`,
        );
      }
      if (!elementIds.has(flow.targetRef?.id)) {
        errors.push(
          `Sequence flow ${flow.id} references non-existent target: ${flow.targetRef?.id}`,
        );
      }
    }
  }
}
