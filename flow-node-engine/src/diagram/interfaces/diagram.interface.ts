/**
 * 流程图生成服务接口定义
 * 对应 Flowable image-generator模块的API设计
 */

/**
 * 图像类型
 */
export enum ImageType {
  PNG = 'png',
  JPEG = 'jpeg',
  SVG = 'svg',
}

/**
 * 图形信息接口
 */
export interface IGraphicInfo {
  /** 元素ID */
  elementId: string;
  /** X坐标 */
  x: number;
  /** Y坐标 */
  y: number;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
}

/**
 * 图表布局接口
 */
export interface IDiagramLayout {
  /** 画布宽度 */
  canvasWidth: number;
  /** 画布高度 */
  canvasHeight: number;
  /** 最小X坐标 */
  minX: number;
  /** 最小Y坐标 */
  minY: number;
  /** 元素图形信息映射 */
  elementGraphicInfo: Map<string, IGraphicInfo>;
}

/**
 * 高亮配置接口
 */
export interface IHighlightConfig {
  /** 高亮的活动节点ID列表 */
  highlightedActivities?: string[];
  /** 高亮的连线ID列表 */
  highlightedFlows?: string[];
  /** 高亮颜色 */
  highlightColor?: string;
  /** 当前活动高亮颜色 */
  currentActivityColor?: string;
}

/**
 * 图表生成选项接口
 */
export interface IDiagramGenerateOptions {
  /** 图像类型 */
  imageType: ImageType;
  /** 高亮配置 */
  highlight?: IHighlightConfig;
  /** 活动字体名称 */
  activityFontName?: string;
  /** 标签字体名称 */
  labelFontName?: string;
  /** 注释字体名称 */
  annotationFontName?: string;
  /** 缩放比例 */
  scaleFactor?: number;
  /** 是否绘制没有标签DI的连线名称 */
  drawSequenceFlowNameWithNoLabelDI?: boolean;
  /** 自定义颜色配置 */
  colors?: IColorConfig;
}

/**
 * 颜色配置接口
 */
export interface IColorConfig {
  /** 默认背景色 */
  background?: string;
  /** 开始事件颜色 */
  startEvent?: string;
  /** 结束事件颜色 */
  endEvent?: string;
  /** 用户任务颜色 */
  userTask?: string;
  /** 服务任务颜色 */
  serviceTask?: string;
  /** 网关颜色 */
  gateway?: string;
  /** 连线颜色 */
  sequenceFlow?: string;
  /** 高亮颜色 */
  highlight?: string;
  /** 文字颜色 */
  label?: string;
}

/**
 * 流程图生成器接口
 */
export interface IProcessDiagramGenerator {
  /**
   * 生成流程图
   * @param bpmnXml BPMN XML内容
   * @param options 生成选项
   * @returns 图像Buffer
   */
  generateDiagram(bpmnXml: string, options: IDiagramGenerateOptions): Promise<Buffer>;

  /**
   * 生成PNG流程图
   * @param bpmnXml BPMN XML内容
   * @param highlight 高亮配置
   * @returns PNG图像Buffer
   */
  generatePngDiagram(bpmnXml: string, highlight?: IHighlightConfig): Promise<Buffer>;

  /**
   * 生成JPEG流程图
   * @param bpmnXml BPMN XML内容
   * @param highlight 高亮配置
   * @returns JPEG图像Buffer
   */
  generateJpegDiagram(bpmnXml: string, highlight?: IHighlightConfig): Promise<Buffer>;

  /**
   * 生成SVG流程图
   * @param bpmnXml BPMN XML内容
   * @param highlight 高亮配置
   * @returns SVG字符串
   */
  generateSvgDiagram(bpmnXml: string, highlight?: IHighlightConfig): Promise<string>;

  /**
   * 获取流程图布局信息
   * @param bpmnXml BPMN XML内容
   * @returns 布局信息
   */
  getDiagramLayout(bpmnXml: string): Promise<IDiagramLayout>;

  /**
   * 生成流程实例图(带高亮当前节点)
   * @param bpmnXml BPMN XML内容
   * @param activeActivityIds 当前活动节点ID列表
   * @param options 生成选项
   * @returns 图像Buffer
   */
  generateProcessInstanceDiagram(
    bpmnXml: string,
    activeActivityIds: string[],
    options?: Partial<IDiagramGenerateOptions>
  ): Promise<Buffer>;
}

/**
 * SVG元素接口
 */
export interface ISvgElement {
  /** 元素类型 */
  type: 'rect' | 'circle' | 'path' | 'text' | 'g' | 'polygon' | 'ellipse' | 'defs' | 'marker';
  /** 属性 */
  attributes: Record<string, string>;
  /** 子元素 */
  children?: ISvgElement[];
  /** 文本内容 */
  text?: string;
}

/**
 * SVG画布接口
 */
export interface ISvgCanvas {
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 元素列表 */
  elements: ISvgElement[];
  /** 添加元素 */
  addElement(element: ISvgElement): void;
  /** 渲染为SVG字符串 */
  render(): string;
}

/**
 * 节点绘制指令接口
 */
export interface INodeDrawInstruction {
  /** 节点类型 */
  nodeType: string;
  /** 绘制函数 */
  draw: (canvas: ISvgCanvas, graphicInfo: IGraphicInfo, label?: string) => void;
}

/**
 * 流程图元素类型
 */
export enum DiagramElementType {
  /** 开始事件 */
  START_EVENT = 'startEvent',
  /** 结束事件 */
  END_EVENT = 'endEvent',
  /** 中间捕获事件 */
  INTERMEDIATE_CATCH_EVENT = 'intermediateCatchEvent',
  /** 中间抛出事件 */
  INTERMEDIATE_THROW_EVENT = 'intermediateThrowEvent',
  /** 边界事件 */
  BOUNDARY_EVENT = 'boundaryEvent',
  /** 用户任务 */
  USER_TASK = 'userTask',
  /** 服务任务 */
  SERVICE_TASK = 'serviceTask',
  /** 脚本任务 */
  SCRIPT_TASK = 'scriptTask',
  /** 邮件任务 */
  MAIL_TASK = 'mailTask',
  /** 手动任务 */
  MANUAL_TASK = 'manualTask',
  /** 接收任务 */
  RECEIVE_TASK = 'receiveTask',
  /** 业务规则任务 */
  BUSINESS_RULE_TASK = 'businessRuleTask',
  /** 调用活动 */
  CALL_ACTIVITY = 'callActivity',
  /** 子流程 */
  SUB_PROCESS = 'subProcess',
  /** 事件子流程 */
  EVENT_SUB_PROCESS = 'eventSubProcess',
  /** 排他网关 */
  EXCLUSIVE_GATEWAY = 'exclusiveGateway',
  /** 并行网关 */
  PARALLEL_GATEWAY = 'parallelGateway',
  /** 包容网关 */
  INCLUSIVE_GATEWAY = 'inclusiveGateway',
  /** 事件网关 */
  EVENT_BASED_GATEWAY = 'eventBasedGateway',
  /** 连线 */
  SEQUENCE_FLOW = 'sequenceFlow',
  /** 消息流 */
  MESSAGE_FLOW = 'messageFlow',
  /** 关联 */
  ASSOCIATION = 'association',
  /** 文本注释 */
  TEXT_ANNOTATION = 'textAnnotation',
  /** 泳道 */
  LANE = 'lane',
  /** 池 */
  POOL = 'pool',
}

/**
 * 默认颜色配置
 */
export const DEFAULT_COLOR_CONFIG: IColorConfig = {
  background: '#FFFFFF',
  startEvent: '#92D050',
  endEvent: '#FF6B6B',
  userTask: '#4A90D9',
  serviceTask: '#6C9AC0',
  gateway: '#FFC107',
  sequenceFlow: '#666666',
  highlight: '#00FF00',
  label: '#333333',
};
