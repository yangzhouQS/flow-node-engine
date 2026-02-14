/**
 * bpmn-moddle 类型声明
 * BPMN 2.0 XML 解析库
 */

declare module 'bpmn-moddle' {
  export interface ModdleElement {
    $type: string;
    id: string;
    name?: string;
    $attrs: Record<string, any>;
    [key: string]: any;
  }

  export interface BpmnDefinitions extends ModdleElement {
    rootElements: ModdleElement[];
    targetNamespace?: string;
    version?: string;
  }

  export interface BpmnProcess extends ModdleElement {
    flowElements: ModdleElement[];
    isExecutable?: boolean;
    laneSets?: ModdleElement[];
    dataObjects?: ModdleElement[];
    properties?: ModdleElement[];
  }

  export interface BpmnFlowElement extends ModdleElement {
    name?: string;
    incoming?: ModdleElement[];
    outgoing?: ModdleElement[];
  }

  export interface BpmnSequenceFlow extends BpmnFlowElement {
    sourceRef: ModdleElement;
    targetRef: ModdleElement;
    conditionExpression?: ModdleElement;
  }

  export interface BpmnActivity extends BpmnFlowElement {
    isForCompensation?: boolean;
    startQuantity?: number;
    completionQuantity?: number;
    default?: ModdleElement;
    ioSpecification?: ModdleElement;
    properties?: ModdleElement[];
    dataInputAssociations?: ModdleElement[];
    dataOutputAssociations?: ModdleElement[];
    loopCharacteristics?: ModdleElement;
  }

  export interface BpmnTask extends BpmnActivity {}

  export interface BpmnUserTask extends BpmnTask {
    implementation?: string;
    renderings?: ModdleElement[];
    resources?: ModdleElement[];
  }

  export interface BpmnServiceTask extends BpmnTask {
    implementation?: string;
    operationRef?: ModdleElement;
  }

  export interface BpmnSubProcess extends BpmnActivity {
    triggeredByEvent?: boolean;
    flowElements: ModdleElement[];
    children?: ModdleElement[];
  }

  export interface BpmnCallActivity extends BpmnActivity {
    calledElement?: string;
    calledElementBinding?: string;
    calledElementVersion?: string;
    calledElementVersionTag?: string;
    async?: boolean;
    asyncBefore?: boolean;
  }

  export interface BpmnEvent extends BpmnFlowElement {
    isInterrupting?: boolean;
    parallelMultiple?: boolean;
  }

  export interface BpmnStartEvent extends BpmnEvent {
    isInterrupting: boolean;
  }

  export interface BpmnEndEvent extends BpmnEvent {}

  export interface BpmnBoundaryEvent extends BpmnEvent {
    cancelActivity?: boolean;
    attachedToRef?: ModdleElement;
  }

  export interface BpmnEventDefinition extends ModdleElement {}

  export interface BpmnTimerEventDefinition extends BpmnEventDefinition {
    timeDate?: ModdleElement;
    timeDuration?: ModdleElement;
    timeCycle?: ModdleElement;
  }

  export interface BpmnMessageEventDefinition extends BpmnEventDefinition {
    messageRef?: ModdleElement;
  }

  export interface BpmnSignalEventDefinition extends BpmnEventDefinition {
    signalRef?: ModdleElement;
  }

  export interface BpmnErrorEventDefinition extends BpmnEventDefinition {
    errorRef?: ModdleElement;
  }

  export interface BpmnEscalationEventDefinition extends BpmnEventDefinition {
    escalationRef?: ModdleElement;
  }

  export interface BpmnConditionalEventDefinition extends BpmnEventDefinition {
    conditionExpression?: ModdleElement;
  }

  export interface BpmnCompensationEventDefinition extends BpmnEventDefinition {
    waitForCompletion?: boolean;
    activityRef?: ModdleElement;
  }

  export interface BpmnGateway extends BpmnFlowElement {}

  export interface BpmnExclusiveGateway extends BpmnGateway {
    default?: ModdleElement;
  }

  export interface BpmnParallelGateway extends BpmnGateway {}

  export interface BpmnInclusiveGateway extends BpmnGateway {
    default?: ModdleElement;
  }

  export interface BpmnEventBasedGateway extends BpmnGateway {
    instantiate?: boolean;
    eventGatewayType?: string;
  }

  export interface BpmnIoSpecification extends ModdleElement {
    dataInputs?: ModdleElement[];
    dataOutputs?: ModdleElement[];
    inputSets?: ModdleElement[];
    outputSets?: ModdleElement[];
  }

  export interface BpmnDataInputAssociation extends ModdleElement {
    sourceRef?: ModdleElement[];
    targetRef?: ModdleElement;
    transformation?: ModdleElement;
  }

  export interface BpmnDataOutputAssociation extends ModdleElement {
    sourceRef?: ModdleElement;
    targetRef?: ModdleElement;
    transformation?: ModdleElement;
  }

  export interface FromXMLResult {
    rootElement: BpmnDefinitions | null;
    warnings?: string[];
    references?: any[];
  }

  export interface ToXMLResult {
    xml: string;
  }

  export interface ModdleOptions {
    [prefix: string]: string;
  }

  export interface Moddle {
    fromXML(xml: string): Promise<FromXMLResult>;
    toXML(element: ModdleElement): Promise<ToXMLResult>;
    create(type: string, attrs?: Record<string, any>): ModdleElement;
    getTypeDescriptor(type: string): any;
  }

  export class BpmnModdle {
    constructor(options?: ModdleOptions);
    fromXML(xml: string): Promise<FromXMLResult>;
    toXML(element: ModdleElement): Promise<ToXMLResult>;
    create(type: string, attrs?: Record<string, any>): ModdleElement;
    getTypeDescriptor(type: string): any;
  }
}
