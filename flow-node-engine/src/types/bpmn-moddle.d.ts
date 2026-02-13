/**
 * bpmn-moddle 类型声明
 * BPMN 2.0 XML 解析库
 */

declare module 'bpmn-moddle' {
  interface ModdleElement {
    $type: string;
    id: string;
    name?: string;
    $attrs: Record<string, any>;
    [key: string]: any;
  }

  interface BpmnDefinitions extends ModdleElement {
    rootElements: ModdleElement[];
    targetNamespace?: string;
    version?: string;
  }

  interface BpmnProcess extends ModdleElement {
    flowElements: ModdleElement[];
    isExecutable?: boolean;
    laneSets?: ModdleElement[];
    dataObjects?: ModdleElement[];
    properties?: ModdleElement[];
  }

  interface BpmnFlowElement extends ModdleElement {
    name?: string;
    incoming?: ModdleElement[];
    outgoing?: ModdleElement[];
  }

  interface BpmnSequenceFlow extends BpmnFlowElement {
    sourceRef: ModdleElement;
    targetRef: ModdleElement;
    conditionExpression?: ModdleElement;
  }

  interface BpmnActivity extends BpmnFlowElement {
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

  interface BpmnTask extends BpmnActivity {}

  interface BpmnUserTask extends BpmnTask {
    implementation?: string;
    renderings?: ModdleElement[];
    resources?: ModdleElement[];
  }

  interface BpmnServiceTask extends BpmnTask {
    implementation?: string;
    operationRef?: ModdleElement;
  }

  interface BpmnSubProcess extends BpmnActivity {
    triggeredByEvent?: boolean;
    flowElements: ModdleElement[];
    children?: ModdleElement[];
  }

  interface BpmnCallActivity extends BpmnActivity {
    calledElement?: string;
    calledElementBinding?: string;
    calledElementVersion?: string;
    calledElementVersionTag?: string;
    async?: boolean;
    asyncBefore?: boolean;
  }

  interface BpmnEvent extends BpmnFlowElement {
    isInterrupting?: boolean;
    parallelMultiple?: boolean;
  }

  interface BpmnStartEvent extends BpmnEvent {
    isInterrupting: boolean;
  }

  interface BpmnEndEvent extends BpmnEvent {}

  interface BpmnBoundaryEvent extends BpmnEvent {
    cancelActivity?: boolean;
    attachedToRef?: ModdleElement;
  }

  interface BpmnEventDefinition extends ModdleElement {}

  interface BpmnTimerEventDefinition extends BpmnEventDefinition {
    timeDate?: ModdleElement;
    timeDuration?: ModdleElement;
    timeCycle?: ModdleElement;
  }

  interface BpmnMessageEventDefinition extends BpmnEventDefinition {
    messageRef?: ModdleElement;
  }

  interface BpmnSignalEventDefinition extends BpmnEventDefinition {
    signalRef?: ModdleElement;
  }

  interface BpmnErrorEventDefinition extends BpmnEventDefinition {
    errorRef?: ModdleElement;
  }

  interface BpmnEscalationEventDefinition extends BpmnEventDefinition {
    escalationRef?: ModdleElement;
  }

  interface BpmnConditionalEventDefinition extends BpmnEventDefinition {
    conditionExpression?: ModdleElement;
  }

  interface BpmnCompensationEventDefinition extends BpmnEventDefinition {
    waitForCompletion?: boolean;
    activityRef?: ModdleElement;
  }

  interface BpmnGateway extends BpmnFlowElement {}

  interface BpmnExclusiveGateway extends BpmnGateway {
    default?: ModdleElement;
  }

  interface BpmnParallelGateway extends BpmnGateway {}

  interface BpmnInclusiveGateway extends BpmnGateway {
    default?: ModdleElement;
  }

  interface BpmnEventBasedGateway extends BpmnGateway {
    instantiate?: boolean;
    eventGatewayType?: string;
  }

  interface BpmnIoSpecification extends ModdleElement {
    dataInputs?: ModdleElement[];
    dataOutputs?: ModdleElement[];
    inputSets?: ModdleElement[];
    outputSets?: ModdleElement[];
  }

  interface BpmnDataInputAssociation extends ModdleElement {
    sourceRef?: ModdleElement[];
    targetRef?: ModdleElement;
    transformation?: ModdleElement;
  }

  interface BpmnDataOutputAssociation extends ModdleElement {
    sourceRef?: ModdleElement;
    targetRef?: ModdleElement;
    transformation?: ModdleElement;
  }

  interface FromXMLResult {
    rootElement: BpmnDefinitions | null;
    warnings?: string[];
    references?: any[];
  }

  interface ToXMLResult {
    xml: string;
  }

  interface ModdleOptions {
    [prefix: string]: string;
  }

  interface Moddle {
    fromXML(xml: string): Promise<FromXMLResult>;
    toXML(element: ModdleElement): Promise<ToXMLResult>;
    create(type: string, attrs?: Record<string, any>): ModdleElement;
    getTypeDescriptor(type: string): any;
  }

  function createModdle(options?: ModdleOptions): Moddle;
  
  export = createModdle;
}
