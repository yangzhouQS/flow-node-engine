/**
 * 流程图生成服务实现
 * 基于SVG生成流程图，对应 Flowable DefaultProcessDiagramGenerator
 */

import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import {
  IProcessDiagramGenerator,
  IDiagramGenerateOptions,
  IHighlightConfig,
  IDiagramLayout,
  IGraphicInfo,
  ISvgCanvas,
  ISvgElement,
  ImageType,
  DiagramElementType,
  DEFAULT_COLOR_CONFIG,
  IColorConfig,
} from '../interfaces/diagram.interface';

/**
 * SVG画布实现
 */
class SvgCanvas implements ISvgCanvas {
  width: number;
  height: number;
  elements: ISvgElement[] = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  addElement(element: ISvgElement): void {
    this.elements.push(element);
  }

  render(): string {
    const svgElements = this.elements.map((el) => this.renderElement(el)).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">
  <rect width="100%" height="100%" fill="white"/>
${svgElements}
</svg>`;
  }

  private renderElement(element: ISvgElement, indent: string = '  '): string {
    const attrs = Object.entries(element.attributes)
      .map(([key, value]) => `${key}="${this.escapeXml(value)}"`)
      .join(' ');

    if (element.children && element.children.length > 0) {
      const childContent = element.children
        .map((child) => this.renderElement(child, indent + '  '))
        .join('\n');
      return `${indent}<${element.type} ${attrs}>
${childContent}
${indent}</${element.type}>`;
    }

    if (element.text) {
      return `${indent}<${element.type} ${attrs}>${this.escapeXml(element.text)}</${element.type}>`;
    }

    return `${indent}<${element.type} ${attrs}/>`;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, ''');
  }
}

/**
 * BPMN元素解析结果
 */
interface ParsedBpmnElement {
  id: string;
  name?: string;
  type: string;
  graphicInfo?: IGraphicInfo;
  incoming?: string[];
  outgoing?: string[];
}

/**
 * BPMN解析结果
 */
interface ParsedBpmn {
  process: {
    id: string;
    name?: string;
    elements: ParsedBpmnElement[];
  };
  diagram: {
    planeId: string;
    shapes: Map<string, IGraphicInfo>;
    edges: Map<string, { waypoints: { x: number; y: number }[] }>;
  };
}

/**
 * 流程图生成服务实现
 */
@Injectable()
export class ProcessDiagramGeneratorService implements IProcessDiagramGenerator {
  private readonly logger = new Logger(ProcessDiagramGeneratorService.name);
  private readonly xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      allowBooleanAttributes: true,
    });
  }

  /**
   * 生成流程图
   */
  async generateDiagram(bpmnXml: string, options: IDiagramGenerateOptions): Promise<Buffer> {
    const svgContent = await this.generateSvgDiagram(bpmnXml, options.highlight);

    switch (options.imageType) {
      case ImageType.SVG:
        return Buffer.from(svgContent, 'utf-8');
      case ImageType.JPEG:
        // JPEG需要额外的转换库，这里返回SVG
        this.logger.warn('JPEG format not fully supported, returning SVG');
        return Buffer.from(svgContent, 'utf-8');
      case ImageType.PNG:
      default:
        // PNG需要额外的转换库，这里返回SVG
        this.logger.warn('PNG format not fully supported, returning SVG');
        return Buffer.from(svgContent, 'utf-8');
    }
  }

  /**
   * 生成PNG流程图
   */
  async generatePngDiagram(bpmnXml: string, highlight?: IHighlightConfig): Promise<Buffer> {
    return this.generateDiagram(bpmnXml, { imageType: ImageType.PNG, highlight });
  }

  /**
   * 生成JPEG流程图
   */
  async generateJpegDiagram(bpmnXml: string, highlight?: IHighlightConfig): Promise<Buffer> {
    return this.generateDiagram(bpmnXml, { imageType: ImageType.JPEG, highlight });
  }

  /**
   * 生成SVG流程图
   */
  async generateSvgDiagram(bpmnXml: string, highlight?: IHighlightConfig): Promise<string> {
    const parsed = this.parseBpmn(bpmnXml);
    const layout = this.calculateLayout(parsed);
    const canvas = new SvgCanvas(layout.canvasWidth, layout.canvasHeight);

    const colors = { ...DEFAULT_COLOR_CONFIG };
    const highlightedActivities = highlight?.highlightedActivities || [];
    const highlightedFlows = highlight?.highlightedFlows || [];

    // 绘制连线
    for (const element of parsed.process.elements) {
      if (element.type === DiagramElementType.SEQUENCE_FLOW) {
        const isHighlighted = highlightedFlows.includes(element.id);
        this.drawSequenceFlow(canvas, element, parsed.diagram.edges.get(element.id), isHighlighted, colors);
      }
    }

    // 绘制节点
    for (const element of parsed.process.elements) {
      if (element.type !== DiagramElementType.SEQUENCE_FLOW) {
        const isHighlighted = highlightedActivities.includes(element.id);
        this.drawElement(canvas, element, layout, isHighlighted, colors);
      }
    }

    return canvas.render();
  }

  /**
   * 获取流程图布局信息
   */
  async getDiagramLayout(bpmnXml: string): Promise<IDiagramLayout> {
    const parsed = this.parseBpmn(bpmnXml);
    return this.calculateLayout(parsed);
  }

  /**
   * 生成流程实例图
   */
  async generateProcessInstanceDiagram(
    bpmnXml: string,
    activeActivityIds: string[],
    options?: Partial<IDiagramGenerateOptions>
  ): Promise<Buffer> {
    const highlight: IHighlightConfig = {
      highlightedActivities: activeActivityIds,
      highlightColor: options?.colors?.highlight || DEFAULT_COLOR_CONFIG.highlight,
    };

    return this.generateDiagram(bpmnXml, {
      imageType: options?.imageType || ImageType.SVG,
      highlight,
      ...options,
    });
  }

  /**
   * 解析BPMN XML
   */
  private parseBpmn(bpmnXml: string): ParsedBpmn {
    const parsed = this.xmlParser.parse(bpmnXml);

    // 获取根元素
    const definitions = parsed['bpmn:definitions'] || parsed.definitions;
    if (!definitions) {
      throw new Error('Invalid BPMN XML: missing definitions');
    }

    // 解析流程
    const processObj = definitions['bpmn:process'] || definitions.process;
    const processId = processObj?.id || '';
    const processName = processObj?.name;

    // 解析流程元素
    const elements: ParsedBpmnElement[] = [];
    this.parseProcessElements(processObj, elements);

    // 解析图形信息
    const diagram = definitions['bpmndi:BPMNDiagram'] || definitions['bpmn:BPMNDiagram'] || definitions.BPMNDiagram;
    const plane = diagram?.['bpmndi:BPMNPlane'] || diagram?.['bpmn:BPMNPlane'] || diagram?.BPMNPlane;

    const shapes = new Map<string, IGraphicInfo>();
    const edges = new Map<string, { waypoints: { x: number; y: number }[] }>();

    if (plane) {
      // 解析形状
      const shapeList = this.ensureArray(plane['bpmndi:BPMNShape'] || plane['bpmn:BPMNShape'] || plane.BPMNShape);
      for (const shape of shapeList) {
        const id = shape['bpmnElement'] || shape.bpmnElement;
        const bounds = shape['dc:Bounds'] || shape.dcBounds || shape.Bounds;
        if (id && bounds) {
          shapes.set(id, {
            elementId: id,
            x: parseFloat(bounds.x || bounds['@_x'] || 0),
            y: parseFloat(bounds.y || bounds['@_y'] || 0),
            width: parseFloat(bounds.width || bounds['@_width'] || 100),
            height: parseFloat(bounds.height || bounds['@_height'] || 80),
          });
        }
      }

      // 解析边
      const edgeList = this.ensureArray(plane['bpmndi:BPMNEdge'] || plane['bpmn:BPMNEdge'] || plane.BPMNEdge);
      for (const edge of edgeList) {
        const id = edge['bpmnElement'] || edge.bpmnElement;
        const waypointList = this.ensureArray(
          edge['di:waypoint'] || edge.diWaypoint || edge.waypoint || edge['bpmndi:waypoint']
        );
        if (id && waypointList.length > 0) {
          const waypoints = waypointList.map((wp: any) => ({
            x: parseFloat(wp.x || wp['@_x'] || 0),
            y: parseFloat(wp.y || wp['@_y'] || 0),
          }));
          edges.set(id, { waypoints });
        }
      }
    }

    // 合并图形信息到元素
    for (const element of elements) {
      element.graphicInfo = shapes.get(element.id);
    }

    return {
      process: { id: processId, name: processName, elements },
      diagram: { planeId: plane?.id || '', shapes, edges },
    };
  }

  /**
   * 解析流程元素
   */
  private parseProcessElements(processObj: any, elements: ParsedBpmnElement[]): void {
    const elementTypes = [
      { key: 'bpmn:startEvent', type: DiagramElementType.START_EVENT },
      { key: 'startEvent', type: DiagramElementType.START_EVENT },
      { key: 'bpmn:endEvent', type: DiagramElementType.END_EVENT },
      { key: 'endEvent', type: DiagramElementType.END_EVENT },
      { key: 'bpmn:userTask', type: DiagramElementType.USER_TASK },
      { key: 'userTask', type: DiagramElementType.USER_TASK },
      { key: 'bpmn:serviceTask', type: DiagramElementType.SERVICE_TASK },
      { key: 'serviceTask', type: DiagramElementType.SERVICE_TASK },
      { key: 'bpmn:scriptTask', type: DiagramElementType.SCRIPT_TASK },
      { key: 'scriptTask', type: DiagramElementType.SCRIPT_TASK },
      { key: 'bpmn:exclusiveGateway', type: DiagramElementType.EXCLUSIVE_GATEWAY },
      { key: 'exclusiveGateway', type: DiagramElementType.EXCLUSIVE_GATEWAY },
      { key: 'bpmn:parallelGateway', type: DiagramElementType.PARALLEL_GATEWAY },
      { key: 'parallelGateway', type: DiagramElementType.PARALLEL_GATEWAY },
      { key: 'bpmn:inclusiveGateway', type: DiagramElementType.INCLUSIVE_GATEWAY },
      { key: 'inclusiveGateway', type: DiagramElementType.INCLUSIVE_GATEWAY },
      { key: 'bpmn:sequenceFlow', type: DiagramElementType.SEQUENCE_FLOW },
      { key: 'sequenceFlow', type: DiagramElementType.SEQUENCE_FLOW },
      { key: 'bpmn:subProcess', type: DiagramElementType.SUB_PROCESS },
      { key: 'subProcess', type: DiagramElementType.SUB_PROCESS },
      { key: 'bpmn:callActivity', type: DiagramElementType.CALL_ACTIVITY },
      { key: 'callActivity', type: DiagramElementType.CALL_ACTIVITY },
    ];

    for (const { key, type } of elementTypes) {
      const items = this.ensureArray(processObj[key]);
      for (const item of items) {
        const element: ParsedBpmnElement = {
          id: item.id,
          name: item.name,
          type,
          incoming: this.ensureArray(item['bpmn:incoming'] || item.incoming).map((s: any) => String(s)),
          outgoing: this.ensureArray(item['bpmn:outgoing'] || item.outgoing).map((s: any) => String(s)),
        };
        elements.push(element);
      }
    }
  }

  /**
   * 确保数组
   */
  private ensureArray(value: any): any[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  /**
   * 计算布局
   */
  private calculateLayout(parsed: ParsedBpmn): IDiagramLayout {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = 0;
    let maxY = 0;

    const elementGraphicInfo = new Map<string, IGraphicInfo>();

    for (const element of parsed.process.elements) {
      if (element.graphicInfo) {
        const gi = element.graphicInfo;
        minX = Math.min(minX, gi.x);
        minY = Math.min(minY, gi.y);
        maxX = Math.max(maxX, gi.x + gi.width);
        maxY = Math.max(maxY, gi.y + gi.height);
        elementGraphicInfo.set(element.id, gi);
      }
    }

    // 处理没有元素的情况
    if (minX === Infinity) {
      minX = 0;
      minY = 0;
    }

    const padding = 20;
    return {
      canvasWidth: maxX + padding * 2,
      canvasHeight: maxY + padding * 2,
      minX,
      minY,
      elementGraphicInfo,
    };
  }

  /**
   * 绘制元素
   */
  private drawElement(
    canvas: ISvgCanvas,
    element: ParsedBpmnElement,
    layout: IDiagramLayout,
    isHighlighted: boolean,
    colors: IColorConfig
  ): void {
    if (!element.graphicInfo) return;

    const gi = element.graphicInfo;
    const x = gi.x;
    const y = gi.y;
    const width = gi.width;
    const height = gi.height;

    switch (element.type) {
      case DiagramElementType.START_EVENT:
        this.drawStartEvent(canvas, x, y, width, height, element.name, isHighlighted, colors);
        break;
      case DiagramElementType.END_EVENT:
        this.drawEndEvent(canvas, x, y, width, height, element.name, isHighlighted, colors);
        break;
      case DiagramElementType.USER_TASK:
      case DiagramElementType.SERVICE_TASK:
      case DiagramElementType.SCRIPT_TASK:
        this.drawTask(canvas, x, y, width, height, element.name, element.type, isHighlighted, colors);
        break;
      case DiagramElementType.EXCLUSIVE_GATEWAY:
      case DiagramElementType.PARALLEL_GATEWAY:
      case DiagramElementType.INCLUSIVE_GATEWAY:
        this.drawGateway(canvas, x, y, width, height, element.name, element.type, isHighlighted, colors);
        break;
      case DiagramElementType.SUB_PROCESS:
      case DiagramElementType.CALL_ACTIVITY:
        this.drawSubProcess(canvas, x, y, width, height, element.name, isHighlighted, colors);
        break;
    }
  }

  /**
   * 绘制开始事件
   */
  private drawStartEvent(
    canvas: ISvgCanvas,
    x: number,
    y: number,
    width: number,
    height: number,
    label?: string,
    isHighlighted?: boolean,
    colors?: IColorConfig
  ): void {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const r = Math.min(width, height) / 2 - 2;

    canvas.addElement({
      type: 'circle',
      attributes: {
        cx: String(cx),
        cy: String(cy),
        r: String(r),
        fill: 'white',
        stroke: isHighlighted ? colors?.highlight : colors?.startEvent,
        'stroke-width': '2',
      },
    });

    if (label) {
      canvas.addElement({
        type: 'text',
        attributes: {
          x: String(cx),
          y: String(y + height + 15),
          'text-anchor': 'middle',
          'font-size': '11',
          fill: colors?.label || '#333',
        },
        text: label,
      });
    }
  }

  /**
   * 绘制结束事件
   */
  private drawEndEvent(
    canvas: ISvgCanvas,
    x: number,
    y: number,
    width: number,
    height: number,
    label?: string,
    isHighlighted?: boolean,
    colors?: IColorConfig
  ): void {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const r = Math.min(width, height) / 2 - 2;

    canvas.addElement({
      type: 'circle',
      attributes: {
        cx: String(cx),
        cy: String(cy),
        r: String(r),
        fill: isHighlighted ? colors?.highlight : colors?.endEvent,
        stroke: isHighlighted ? colors?.highlight : colors?.endEvent,
        'stroke-width': '3',
      },
    });

    if (label) {
      canvas.addElement({
        type: 'text',
        attributes: {
          x: String(cx),
          y: String(y + height + 15),
          'text-anchor': 'middle',
          'font-size': '11',
          fill: colors?.label || '#333',
        },
        text: label,
      });
    }
  }

  /**
   * 绘制任务
   */
  private drawTask(
    canvas: ISvgCanvas,
    x: number,
    y: number,
    width: number,
    height: number,
    label?: string,
    taskType?: string,
    isHighlighted?: boolean,
    colors?: IColorConfig
  ): void {
    const cornerRadius = 10;

    canvas.addElement({
      type: 'rect',
      attributes: {
        x: String(x),
        y: String(y),
        width: String(width),
        height: String(height),
        rx: String(cornerRadius),
        ry: String(cornerRadius),
        fill: 'white',
        stroke: isHighlighted ? colors?.highlight : colors?.userTask,
        'stroke-width': '2',
      },
    });

    // 任务类型图标
    const iconText = taskType === DiagramElementType.USER_TASK ? '👤' : 
                     taskType === DiagramElementType.SERVICE_TASK ? '⚙️' : 
                     taskType === DiagramElementType.SCRIPT_TASK ? '📜' : '';

    if (iconText) {
      canvas.addElement({
        type: 'text',
        attributes: {
          x: String(x + 10),
          y: String(y + 20),
          'font-size': '14',
        },
        text: iconText,
      });
    }

    if (label) {
      canvas.addElement({
        type: 'text',
        attributes: {
          x: String(x + width / 2),
          y: String(y + height / 2 + 5),
          'text-anchor': 'middle',
          'font-size': '12',
          fill: colors?.label || '#333',
        },
        text: label.length > 15 ? label.substring(0, 15) + '...' : label,
      });
    }
  }

  /**
   * 绘制网关
   */
  private drawGateway(
    canvas: ISvgCanvas,
    x: number,
    y: number,
    width: number,
    height: number,
    label?: string,
    gatewayType?: string,
    isHighlighted?: boolean,
    colors?: IColorConfig
  ): void {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const size = Math.min(width, height) - 4;

    // 菱形路径
    const points = `${cx},${cy - size / 2} ${cx + size / 2},${cy} ${cx},${cy + size / 2} ${cx - size / 2},${cy}`;

    canvas.addElement({
      type: 'polygon',
      attributes: {
        points,
        fill: 'white',
        stroke: isHighlighted ? colors?.highlight : colors?.gateway,
        'stroke-width': '2',
      },
    });

    // 网关类型图标
    let icon = '';
    switch (gatewayType) {
      case DiagramElementType.EXCLUSIVE_GATEWAY:
        icon = 'X';
        break;
      case DiagramElementType.PARALLEL_GATEWAY:
        icon = '+';
        break;
      case DiagramElementType.INCLUSIVE_GATEWAY:
        icon = 'O';
        break;
    }

    if (icon) {
      canvas.addElement({
        type: 'text',
        attributes: {
          x: String(cx),
          y: String(cy + 5),
          'text-anchor': 'middle',
          'font-size': '16',
          'font-weight': 'bold',
          fill: colors?.gateway,
        },
        text: icon,
      });
    }

    if (label) {
      canvas.addElement({
        type: 'text',
        attributes: {
          x: String(cx),
          y: String(y + height + 15),
          'text-anchor': 'middle',
          'font-size': '11',
          fill: colors?.label || '#333',
        },
        text: label,
      });
    }
  }

  /**
   * 绘制子流程
   */
  private drawSubProcess(
    canvas: ISvgCanvas,
    x: number,
    y: number,
    width: number,
    height: number,
    label?: string,
    isHighlighted?: boolean,
    colors?: IColorConfig
  ): void {
    canvas.addElement({
      type: 'rect',
      attributes: {
        x: String(x),
        y: String(y),
        width: String(width),
        height: String(height),
        fill: 'white',
        stroke: isHighlighted ? colors?.highlight : colors?.userTask,
        'stroke-width': '2',
      },
    });

    if (label) {
      canvas.addElement({
        type: 'text',
        attributes: {
          x: String(x + 10),
          y: String(y + 20),
          'font-size': '12',
          fill: colors?.label || '#333',
        },
        text: label,
      });
    }
  }

  /**
   * 绘制连线
   */
  private drawSequenceFlow(
    canvas: ISvgCanvas,
    element: ParsedBpmnElement,
    edge?: { waypoints: { x: number; y: number }[] },
    isHighlighted?: boolean,
    colors?: IColorConfig
  ): void {
    if (!edge || edge.waypoints.length < 2) return;

    const pathData = edge.waypoints
      .map((wp, i) => `${i === 0 ? 'M' : 'L'}${wp.x},${wp.y}`)
      .join(' ');

    canvas.addElement({
      type: 'path',
      attributes: {
        d: pathData,
        fill: 'none',
        stroke: isHighlighted ? colors?.highlight : colors?.sequenceFlow,
        'stroke-width': '2',
        'marker-end': 'url(#arrow)',
      },
    });

    // 添加箭头定义
    canvas.addElement({
      type: 'defs',
      attributes: {},
      children: [
        {
          type: 'marker',
          attributes: {
            id: 'arrow',
            markerWidth: '10',
            markerHeight: '10',
            refX: '9',
            refY: '3',
            orient: 'auto',
            'marker-units': 'strokeWidth',
          },
          children: [
            {
              type: 'path',
              attributes: {
                d: 'M0,0 L0,6 L9,3 z',
                fill: isHighlighted ? colors?.highlight : colors?.sequenceFlow,
              },
            },
          ],
        },
      ],
    });
  }
}
