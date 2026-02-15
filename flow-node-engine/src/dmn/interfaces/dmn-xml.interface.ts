/**
 * DMN XML接口定义
 * 基于OMG DMN 1.1/1.2/1.3规范
 * 与Flowable DMN XML转换器兼容
 */

/**
 * DMN命名空间常量
 */
export const DMN_NAMESPACES = {
  DMN_11: 'http://www.omg.org/spec/DMN/20151101/dmn.xsd',
  DMN_12: 'http://www.omg.org/spec/DMN/20180521/MODEL/',
  DMN_13: 'https://www.omg.org/spec/DMN/20191111/MODEL/',
  DMNDI: 'https://www.omg.org/spec/DMN/20191111/DMNDI/',
  DC: 'http://www.omg.org/spec/DMN/20180521/DC/',
  DI: 'http://www.omg.org/spec/DMN/20180521/DI/',
  FLOWABLE_EXTENSIONS: 'http://flowable.org/bpmn',
} as const;

/**
 * DMN XML元素常量
 */
export const DMN_XML_ELEMENTS = {
  DEFINITIONS: 'definitions',
  DECISION: 'decision',
  DECISION_TABLE: 'decisionTable',
  RULE: 'rule',
  INPUT: 'input',
  OUTPUT: 'output',
  INPUT_EXPRESSION: 'inputExpression',
  INPUT_VALUES: 'inputValues',
  OUTPUT_VALUES: 'outputValues',
  TEXT: 'text',
  INPUT_ENTRY: 'inputEntry',
  OUTPUT_ENTRY: 'outputEntry',
  DESCRIPTION: 'description',
  EXTENSION_ELEMENTS: 'extensionElements',
  VARIABLE: 'variable',
  INFORMATION_REQUIREMENT: 'informationRequirement',
  REQUIRED_DECISION: 'requiredDecision',
  REQUIRED_INPUT: 'requiredInput',
  AUTHORITY_REQUIREMENT: 'authorityRequirement',
  REQUIRED_AUTHORITY: 'requiredAuthority',
  ITEM_DEFINITION: 'itemDefinition',
  ITEM_COMPONENT: 'itemComponent',
  INPUT_DATA: 'inputData',
  DECISION_SERVICE: 'decisionService',
  OUTPUT_DECISION: 'outputDecision',
  ENCAPSULATED_DECISION: 'encapsulatedDecision',
  TYPE_REF: 'typeRef',
  ALLOWED_VALUES: 'allowedValues',
} as const;

/**
 * DMN XML属性常量
 */
export const DMN_XML_ATTRIBUTES = {
  ID: 'id',
  NAME: 'name',
  LABEL: 'label',
  TYPE_REF: 'typeRef',
  HIT_POLICY: 'hitPolicy',
  AGGREGATION: 'aggregation',
  EXPRESSION: 'expression',
  NAMESPACE: 'namespace',
  EXPORTER: 'exporter',
  EXPORTER_VERSION: 'exporterVersion',
  HREF: 'href',
  IS_COLLECTION: 'isCollection',
  FORCE_DMN_11: 'forceDMN11',
} as const;

/**
 * Hit Policy XML值映射
 */
export const HIT_POLICY_XML_MAP: Record<string, string> = {
  UNIQUE: 'UNIQUE',
  FIRST: 'FIRST',
  PRIORITY: 'PRIORITY',
  ANY: 'ANY',
  COLLECT: 'COLLECT',
  RULE_ORDER: 'RULE ORDER',
  OUTPUT_ORDER: 'OUTPUT ORDER',
  UNORDERED: 'UNORDERED',
} as const;

/**
 * Aggregation XML值映射
 */
export const AGGREGATION_XML_MAP: Record<string, string> = {
  SUM: 'SUM',
  COUNT: 'COUNT',
  MIN: 'MIN',
  MAX: 'MAX',
} as const;

/**
 * DMN定义XML结构
 */
export interface DmnDefinitionXml {
  id: string;
  name?: string;
  namespace: string;
  exporter?: string;
  exporterVersion?: string;
  decisions: DmnDecisionXml[];
  itemDefinitions?: DmnItemDefinitionXml[];
  inputData?: DmnInputDataXml[];
  decisionServices?: DmnDecisionServiceXml[];
  namespaces?: Record<string, string>;
  extensionElements?: DmnExtensionElementXml[];
}

/**
 * 决策XML结构
 */
export interface DmnDecisionXml {
  id: string;
  name?: string;
  description?: string;
  variable?: DmnInformationItemXml;
  decisionTable?: DmnDecisionTableXml;
  informationRequirements?: DmnInformationRequirementXml[];
  authorityRequirements?: DmnAuthorityRequirementXml[];
  extensionElements?: DmnExtensionElementXml[];
  forceDMN11?: boolean;
}

/**
 * 决策表XML结构
 */
export interface DmnDecisionTableXml {
  id: string;
  hitPolicy?: string;
  aggregation?: string;
  description?: string;
  inputs: DmnInputClauseXml[];
  outputs: DmnOutputClauseXml[];
  rules: DmnDecisionRuleXml[];
  extensionElements?: DmnExtensionElementXml[];
}

/**
 * 输入子句XML结构
 */
export interface DmnInputClauseXml {
  id: string;
  label?: string;
  description?: string;
  inputExpression: DmnLiteralExpressionXml;
  inputValues?: DmnUnaryTestsXml;
  extensionElements?: DmnExtensionElementXml[];
}

/**
 * 输出子句XML结构
 */
export interface DmnOutputClauseXml {
  id: string;
  label?: string;
  name?: string;
  typeRef?: string;
  description?: string;
  outputValues?: DmnUnaryTestsXml;
  defaultOutputEntry?: DmnLiteralExpressionXml;
  extensionElements?: DmnExtensionElementXml[];
}

/**
 * 决策规则XML结构
 */
export interface DmnDecisionRuleXml {
  id: string;
  description?: string;
  inputEntries: DmnUnaryTestsXml[];
  outputEntries: DmnLiteralExpressionXml[];
  extensionElements?: DmnExtensionElementXml[];
}

/**
 * 字面表达式XML结构
 */
export interface DmnLiteralExpressionXml {
  id?: string;
  text?: string;
  typeRef?: string;
  expressionLanguage?: string;
}

/**
 * 一元测试XML结构
 */
export interface DmnUnaryTestsXml {
  id: string;
  text?: string;
  expressionLanguage?: string;
  extensionElements?: DmnExtensionElementXml[];
}

/**
 * 信息项XML结构
 */
export interface DmnInformationItemXml {
  id?: string;
  name?: string;
  label?: string;
  typeRef?: string;
  description?: string;
}

/**
 * 信息需求XML结构
 */
export interface DmnInformationRequirementXml {
  id: string;
  requiredDecision?: DmnDmnElementReferenceXml;
  requiredInput?: DmnDmnElementReferenceXml;
}

/**
 * 授权需求XML结构
 */
export interface DmnAuthorityRequirementXml {
  id: string;
  requiredAuthority?: DmnDmnElementReferenceXml;
}

/**
 * DMN元素引用XML结构
 */
export interface DmnDmnElementReferenceXml {
  href: string;
}

/**
 * 项定义XML结构
 */
export interface DmnItemDefinitionXml {
  id?: string;
  name?: string;
  label?: string;
  typeRef?: string;
  isCollection?: boolean;
  description?: string;
  allowedValues?: DmnUnaryTestsXml;
  itemComponents?: DmnItemDefinitionXml[];
  extensionElements?: DmnExtensionElementXml[];
}

/**
 * 输入数据XML结构
 */
export interface DmnInputDataXml {
  id: string;
  name?: string;
  description?: string;
  variable?: DmnInformationItemXml;
  extensionElements?: DmnExtensionElementXml[];
}

/**
 * 决策服务XML结构
 */
export interface DmnDecisionServiceXml {
  id: string;
  name?: string;
  description?: string;
  outputDecisions: DmnDmnElementReferenceXml[];
  encapsulatedDecisions: DmnDmnElementReferenceXml[];
  inputData: DmnDmnElementReferenceXml[];
  extensionElements?: DmnExtensionElementXml[];
}

/**
 * 扩展元素XML结构
 */
export interface DmnExtensionElementXml {
  name: string;
  namespace?: string;
  attributes?: Record<string, string>;
  childElements?: DmnExtensionElementXml[];
  textContent?: string;
}

/**
 * 扩展属性XML结构
 */
export interface DmnExtensionAttributeXml {
  name: string;
  namespace?: string;
  value: string;
}

/**
 * DMN DI图形信息
 */
export interface DmnDiDiagramXml {
  id: string;
  name?: string;
  documentation?: string;
  resolution?: number;
  shapes: DmnDiShapeXml[];
  edges: DmnDiEdgeXml[];
}

/**
 * DMN DI形状XML结构
 */
export interface DmnDiShapeXml {
  id: string;
  dmnElementRef: string;
  bounds: DmnDiBoundsXml;
  decisionServiceDividerLine?: DmnDiDecisionServiceDividerLineXml;
  label?: DmnDiShapeXml;
}

/**
 * DMN DI边界XML结构
 */
export interface DmnDiBoundsXml {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * DMN DI边XML结构
 */
export interface DmnDiEdgeXml {
  id: string;
  dmnElementRef: string;
  waypoints: DmnDiWaypointXml[];
  label?: DmnDiShapeXml;
}

/**
 * DMN DI路径点XML结构
 */
export interface DmnDiWaypointXml {
  x: number;
  y: number;
}

/**
 * DMN DI决策服务分割线XML结构
 */
export interface DmnDiDecisionServiceDividerLineXml {
  waypoints: DmnDiWaypointXml[];
}

/**
 * XML解析选项
 */
export interface DmnXmlParseOptions {
  validateSchema?: boolean;
  enableSafeXml?: boolean;
  encoding?: string;
  targetNamespace?: string;
}

/**
 * XML导出选项
 */
export interface DmnXmlExportOptions {
  encoding?: string;
  indent?: boolean;
  includeDi?: boolean;
  dmnVersion?: '1.1' | '1.2' | '1.3';
}

/**
 * XML解析结果
 */
export interface DmnXmlParseResult {
  definition: DmnDefinitionXml;
  warnings: string[];
  errors: string[];
}

/**
 * XML验证结果
 */
export interface DmnXmlValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
