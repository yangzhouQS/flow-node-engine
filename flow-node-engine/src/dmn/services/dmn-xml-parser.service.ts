import { Injectable, Logger } from '@nestjs/common';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import {
  DmnDefinitionXml,
  DmnDecisionXml,
  DmnDecisionTableXml,
  DmnInputClauseXml,
  DmnOutputClauseXml,
  DmnDecisionRuleXml,
  DmnLiteralExpressionXml,
  DmnUnaryTestsXml,
  DmnXmlParseOptions,
  DmnXmlParseResult,
  DmnXmlValidationResult,
  DmnItemDefinitionXml,
  DmnInputDataXml,
  DmnDecisionServiceXml,
  DmnInformationRequirementXml,
  DmnAuthorityRequirementXml,
  DmnExtensionElementXml,
  DMN_NAMESPACES,
  DMN_XML_ELEMENTS,
  DMN_XML_ATTRIBUTES,
  HIT_POLICY_XML_MAP,
  AGGREGATION_XML_MAP,
} from '../interfaces/dmn-xml.interface';
import { HitPolicy, AggregationType } from '../entities/dmn-decision.entity';
import {
  CreateDecisionDto,
  DecisionInputDto,
  DecisionOutputDto,
  DecisionRuleDto,
  RuleConditionDto,
  RuleOutputDto,
} from '../dto/dmn.dto';

/**
 * DMN XML解析器服务
 * 负责将DMN XML转换为内部模型
 */
@Injectable()
export class DmnXmlParserService {
  private readonly logger = new Logger(DmnXmlParserService.name);
  private readonly parser: XMLParser;
  private readonly builder: XMLBuilder;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      trimValues: true,
      ignoreNameSpace: false,
      allowBooleanAttributes: true,
      parseNodeValue: false,
      parseTagValue: false,
      isArray: (name: string) => {
        const arrayElements = [
          'decision',
          'input',
          'output',
          'rule',
          'inputEntry',
          'outputEntry',
          'itemDefinition',
          'inputData',
          'decisionService',
          'informationRequirement',
          'authorityRequirement',
          'extensionElement',
          'itemComponent',
          'outputDecision',
          'encapsulatedDecision',
          'waypoint',
        ];
        return arrayElements.includes(name);
      },
    });

    this.builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true,
    });
  }

  /**
   * 解析DMN XML字符串
   */
  parseXml(xmlContent: string, options?: DmnXmlParseOptions): DmnXmlParseResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const parsed = this.parser.parse(xmlContent);
      const definitions = this.findDefinitions(parsed);

      if (!definitions) {
        errors.push('未找到DMN definitions元素');
        return {
          definition: this.createEmptyDefinition(),
          warnings,
          errors,
        };
      }

      const definition = this.parseDefinitions(definitions, warnings);
      this.detectDmnVersion(definitions, definition, warnings);

      return {
        definition,
        warnings,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`XML解析错误: ${errorMessage}`);
      this.logger.error(`DMN XML解析失败: ${errorMessage}`);

      return {
        definition: this.createEmptyDefinition(),
        warnings,
        errors,
      };
    }
  }

  /**
   * 验证DMN XML
   */
  validateXml(xmlContent: string): DmnXmlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const parsed = this.parser.parse(xmlContent);
      const definitions = this.findDefinitions(parsed);

      if (!definitions) {
        errors.push('未找到DMN definitions根元素');
        return { valid: false, errors, warnings };
      }

      // 检查必要的命名空间
      this.validateNamespaces(definitions, warnings);

      // 检查决策定义
      const decisions = this.getElements(definitions, DMN_XML_ELEMENTS.DECISION);
      if (!decisions || decisions.length === 0) {
        warnings.push('未定义任何决策');
      }

      // 验证每个决策
      for (const decision of decisions) {
        this.validateDecision(decision, errors, warnings);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`XML验证错误: ${errorMessage}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * 将DMN XML转换为CreateDecisionDto
   */
  convertToCreateDto(xmlContent: string, tenantId?: string): CreateDecisionDto[] {
    const result = this.parseXml(xmlContent);
    if (result.errors.length > 0) {
      throw new Error(`DMN XML解析失败: ${result.errors.join(', ')}`);
    }

    const dtos: CreateDecisionDto[] = [];
    for (const decision of result.definition.decisions) {
      if (decision.decisionTable) {
        dtos.push(this.convertDecisionToDto(decision, result.definition, tenantId));
      }
    }

    return dtos;
  }

  /**
   * 查找definitions元素
   */
  private findDefinitions(parsed: any): any | null {
    const possibleKeys = Object.keys(parsed);
    for (const key of possibleKeys) {
      if (key.endsWith(DMN_XML_ELEMENTS.DEFINITIONS) || key === DMN_XML_ELEMENTS.DEFINITIONS) {
        return parsed[key];
      }
    }
    return null;
  }

  /**
   * 解析definitions元素
   */
  private parseDefinitions(definitions: any, warnings: string[]): DmnDefinitionXml {
    const result: DmnDefinitionXml = {
      id: this.getAttribute(definitions, DMN_XML_ATTRIBUTES.ID) || '',
      name: this.getAttribute(definitions, DMN_XML_ATTRIBUTES.NAME),
      namespace: this.getAttribute(definitions, DMN_XML_ATTRIBUTES.NAMESPACE) || DMN_NAMESPACES.DMN_13,
      exporter: this.getAttribute(definitions, DMN_XML_ATTRIBUTES.EXPORTER),
      exporterVersion: this.getAttribute(definitions, DMN_XML_ATTRIBUTES.EXPORTER_VERSION),
      decisions: [],
      itemDefinitions: [],
      inputData: [],
      decisionServices: [],
      namespaces: this.extractNamespaces(definitions),
    };

    // 解析ItemDefinitions
    const itemDefs = this.getElements(definitions, DMN_XML_ELEMENTS.ITEM_DEFINITION);
    if (itemDefs) {
      for (const itemDef of itemDefs) {
        result.itemDefinitions?.push(this.parseItemDefinition(itemDef));
      }
    }

    // 解析InputData
    const inputDataList = this.getElements(definitions, DMN_XML_ELEMENTS.INPUT_DATA);
    if (inputDataList) {
      for (const inputData of inputDataList) {
        result.inputData?.push(this.parseInputData(inputData));
      }
    }

    // 解析Decisions
    const decisions = this.getElements(definitions, DMN_XML_ELEMENTS.DECISION);
    if (decisions) {
      for (const decision of decisions) {
        result.decisions.push(this.parseDecision(decision, warnings));
      }
    }

    // 解析DecisionServices
    const decisionServices = this.getElements(definitions, DMN_XML_ELEMENTS.DECISION_SERVICE);
    if (decisionServices) {
      for (const ds of decisionServices) {
        result.decisionServices?.push(this.parseDecisionService(ds));
      }
    }

    return result;
  }

  /**
   * 解析Decision元素
   */
  private parseDecision(decision: any, warnings: string[]): DmnDecisionXml {
    const result: DmnDecisionXml = {
      id: this.getAttribute(decision, DMN_XML_ATTRIBUTES.ID) || '',
      name: this.getAttribute(decision, DMN_XML_ATTRIBUTES.NAME),
      description: this.getElementText(decision, DMN_XML_ELEMENTS.DESCRIPTION),
      decisionTable: undefined,
      informationRequirements: [],
      authorityRequirements: [],
    };

    // 解析Variable
    const variable = this.getElement(decision, DMN_XML_ELEMENTS.VARIABLE);
    if (variable) {
      result.variable = {
        id: this.getAttribute(variable, DMN_XML_ATTRIBUTES.ID),
        name: this.getAttribute(variable, DMN_XML_ATTRIBUTES.NAME),
        typeRef: this.getAttribute(variable, DMN_XML_ATTRIBUTES.TYPE_REF),
      };
    }

    // 解析DecisionTable
    const decisionTable = this.getElement(decision, DMN_XML_ELEMENTS.DECISION_TABLE);
    if (decisionTable) {
      result.decisionTable = this.parseDecisionTable(decisionTable, warnings);
    }

    // 解析InformationRequirements
    const infoReqs = this.getElements(decision, DMN_XML_ELEMENTS.INFORMATION_REQUIREMENT);
    if (infoReqs) {
      for (const infoReq of infoReqs) {
        result.informationRequirements?.push(this.parseInformationRequirement(infoReq));
      }
    }

    // 解析AuthorityRequirements
    const authReqs = this.getElements(decision, DMN_XML_ELEMENTS.AUTHORITY_REQUIREMENT);
    if (authReqs) {
      for (const authReq of authReqs) {
        result.authorityRequirements?.push(this.parseAuthorityRequirement(authReq));
      }
    }

    return result;
  }

  /**
   * 解析DecisionTable元素
   */
  private parseDecisionTable(decisionTable: any, warnings: string[]): DmnDecisionTableXml {
    const hitPolicyValue = this.getAttribute(decisionTable, DMN_XML_ATTRIBUTES.HIT_POLICY) || 'FIRST';
    const hitPolicy = this.mapHitPolicyFromXml(hitPolicyValue, warnings);
    const aggregationValue = this.getAttribute(decisionTable, DMN_XML_ATTRIBUTES.AGGREGATION);
    const aggregation = aggregationValue ? this.mapAggregationFromXml(aggregationValue, warnings) : undefined;

    const result: DmnDecisionTableXml = {
      id: this.getAttribute(decisionTable, DMN_XML_ATTRIBUTES.ID) || '',
      hitPolicy,
      aggregation,
      description: this.getElementText(decisionTable, DMN_XML_ELEMENTS.DESCRIPTION),
      inputs: [],
      outputs: [],
      rules: [],
    };

    // 解析Inputs
    const inputs = this.getElements(decisionTable, DMN_XML_ELEMENTS.INPUT);
    if (inputs) {
      for (const input of inputs) {
        result.inputs.push(this.parseInputClause(input));
      }
    }

    // 解析Outputs
    const outputs = this.getElements(decisionTable, DMN_XML_ELEMENTS.OUTPUT);
    if (outputs) {
      for (const output of outputs) {
        result.outputs.push(this.parseOutputClause(output));
      }
    }

    // 解析Rules
    const rules = this.getElements(decisionTable, DMN_XML_ELEMENTS.RULE);
    if (rules) {
      for (const rule of rules) {
        result.rules.push(this.parseRule(rule, result.inputs));
      }
    }

    return result;
  }

  /**
   * 解析InputClause元素
   */
  private parseInputClause(input: any): DmnInputClauseXml {
    const result: DmnInputClauseXml = {
      id: this.getAttribute(input, DMN_XML_ATTRIBUTES.ID) || '',
      label: this.getAttribute(input, DMN_XML_ATTRIBUTES.LABEL),
      inputExpression: { text: '' },
    };

    // 解析InputExpression
    const inputExpr = this.getElement(input, DMN_XML_ELEMENTS.INPUT_EXPRESSION);
    if (inputExpr) {
      result.inputExpression = {
        id: this.getAttribute(inputExpr, DMN_XML_ATTRIBUTES.ID),
        text: this.getElementText(inputExpr, DMN_XML_ELEMENTS.TEXT) || '',
        typeRef: this.getAttribute(inputExpr, DMN_XML_ATTRIBUTES.TYPE_REF),
      };
    }

    // 解析InputValues
    const inputValues = this.getElement(input, DMN_XML_ELEMENTS.INPUT_VALUES);
    if (inputValues) {
      result.inputValues = {
        id: this.getAttribute(inputValues, DMN_XML_ATTRIBUTES.ID) || '',
        text: this.getElementText(inputValues, DMN_XML_ELEMENTS.TEXT),
      };
    }

    return result;
  }

  /**
   * 解析OutputClause元素
   */
  private parseOutputClause(output: any): DmnOutputClauseXml {
    const result: DmnOutputClauseXml = {
      id: this.getAttribute(output, DMN_XML_ATTRIBUTES.ID) || '',
      label: this.getAttribute(output, DMN_XML_ATTRIBUTES.LABEL),
      name: this.getAttribute(output, DMN_XML_ATTRIBUTES.NAME),
      typeRef: this.getAttribute(output, DMN_XML_ATTRIBUTES.TYPE_REF),
      inputExpression: { text: '' },
    };

    // 解析OutputValues
    const outputValues = this.getElement(output, DMN_XML_ELEMENTS.OUTPUT_VALUES);
    if (outputValues) {
      result.outputValues = {
        id: this.getAttribute(outputValues, DMN_XML_ATTRIBUTES.ID) || '',
        text: this.getElementText(outputValues, DMN_XML_ELEMENTS.TEXT),
      };
    }

    return result;
  }

  /**
   * 解析Rule元素
   */
  private parseRule(rule: any, inputs: DmnInputClauseXml[]): DmnDecisionRuleXml {
    const result: DmnDecisionRuleXml = {
      id: this.getAttribute(rule, DMN_XML_ATTRIBUTES.ID) || '',
      description: this.getElementText(rule, DMN_XML_ELEMENTS.DESCRIPTION),
      inputEntries: [],
      outputEntries: [],
    };

    // 解析InputEntries
    const inputEntries = this.getElements(rule, DMN_XML_ELEMENTS.INPUT_ENTRY);
    if (inputEntries) {
      for (let i = 0; i < inputEntries.length; i++) {
        const entry = inputEntries[i];
        result.inputEntries.push({
          id: this.getAttribute(entry, DMN_XML_ATTRIBUTES.ID) || '',
          text: this.getElementText(entry, DMN_XML_ELEMENTS.TEXT),
        });
      }
    }

    // 解析OutputEntries
    const outputEntries = this.getElements(rule, DMN_XML_ELEMENTS.OUTPUT_ENTRY);
    if (outputEntries) {
      for (const entry of outputEntries) {
        result.outputEntries.push({
          id: this.getAttribute(entry, DMN_XML_ATTRIBUTES.ID) || '',
          text: this.getElementText(entry, DMN_XML_ELEMENTS.TEXT),
        });
      }
    }

    return result;
  }

  /**
   * 解析ItemDefinition元素
   */
  private parseItemDefinition(itemDef: any): DmnItemDefinitionXml {
    const result: DmnItemDefinitionXml = {
      id: this.getAttribute(itemDef, DMN_XML_ATTRIBUTES.ID),
      name: this.getAttribute(itemDef, DMN_XML_ATTRIBUTES.NAME),
      label: this.getAttribute(itemDef, DMN_XML_ATTRIBUTES.LABEL),
      typeRef: this.getElementText(itemDef, DMN_XML_ELEMENTS.TYPE_REF),
      isCollection: this.getAttribute(itemDef, DMN_XML_ATTRIBUTES.IS_COLLECTION) === 'true',
      itemComponents: [],
    };

    // 解析ItemComponents
    const components = this.getElements(itemDef, DMN_XML_ELEMENTS.ITEM_COMPONENT);
    if (components) {
      for (const component of components) {
        result.itemComponents?.push(this.parseItemDefinition(component));
      }
    }

    return result;
  }

  /**
   * 解析InputData元素
   */
  private parseInputData(inputData: any): DmnInputDataXml {
    const result: DmnInputDataXml = {
      id: this.getAttribute(inputData, DMN_XML_ATTRIBUTES.ID) || '',
      name: this.getAttribute(inputData, DMN_XML_ATTRIBUTES.NAME),
    };

    // 解析Variable
    const variable = this.getElement(inputData, DMN_XML_ELEMENTS.VARIABLE);
    if (variable) {
      result.variable = {
        id: this.getAttribute(variable, DMN_XML_ATTRIBUTES.ID),
        name: this.getAttribute(variable, DMN_XML_ATTRIBUTES.NAME),
        typeRef: this.getAttribute(variable, DMN_XML_ATTRIBUTES.TYPE_REF),
      };
    }

    return result;
  }

  /**
   * 解析DecisionService元素
   */
  private parseDecisionService(ds: any): DmnDecisionServiceXml {
    const result: DmnDecisionServiceXml = {
      id: this.getAttribute(ds, DMN_XML_ATTRIBUTES.ID) || '',
      name: this.getAttribute(ds, DMN_XML_ATTRIBUTES.NAME),
      outputDecisions: [],
      encapsulatedDecisions: [],
      inputData: [],
    };

    // 解析OutputDecisions
    const outputDecisions = this.getElements(ds, DMN_XML_ELEMENTS.OUTPUT_DECISION);
    if (outputDecisions) {
      for (const od of outputDecisions) {
        result.outputDecisions.push({
          href: this.getAttribute(od, DMN_XML_ATTRIBUTES.HREF) || '',
        });
      }
    }

    // 解析EncapsulatedDecisions
    const encapsulatedDecisions = this.getElements(ds, DMN_XML_ELEMENTS.ENCAPSULATED_DECISION);
    if (encapsulatedDecisions) {
      for (const ed of encapsulatedDecisions) {
        result.encapsulatedDecisions.push({
          href: this.getAttribute(ed, DMN_XML_ATTRIBUTES.HREF) || '',
        });
      }
    }

    return result;
  }

  /**
   * 解析InformationRequirement元素
   */
  private parseInformationRequirement(infoReq: any): DmnInformationRequirementXml {
    const result: DmnInformationRequirementXml = {
      id: this.getAttribute(infoReq, DMN_XML_ATTRIBUTES.ID) || '',
    };

    const requiredDecision = this.getElement(infoReq, DMN_XML_ELEMENTS.REQUIRED_DECISION);
    if (requiredDecision) {
      result.requiredDecision = {
        href: this.getAttribute(requiredDecision, DMN_XML_ATTRIBUTES.HREF) || '',
      };
    }

    const requiredInput = this.getElement(infoReq, DMN_XML_ELEMENTS.REQUIRED_INPUT);
    if (requiredInput) {
      result.requiredInput = {
        href: this.getAttribute(requiredInput, DMN_XML_ATTRIBUTES.HREF) || '',
      };
    }

    return result;
  }

  /**
   * 解析AuthorityRequirement元素
   */
  private parseAuthorityRequirement(authReq: any): DmnAuthorityRequirementXml {
    const result: DmnAuthorityRequirementXml = {
      id: this.getAttribute(authReq, DMN_XML_ATTRIBUTES.ID) || '',
    };

    const requiredAuthority = this.getElement(authReq, DMN_XML_ELEMENTS.REQUIRED_AUTHORITY);
    if (requiredAuthority) {
      result.requiredAuthority = {
        href: this.getAttribute(requiredAuthority, DMN_XML_ATTRIBUTES.HREF) || '',
      };
    }

    return result;
  }

  /**
   * 将Decision转换为CreateDecisionDto
   */
  private convertDecisionToDto(
    decision: DmnDecisionXml,
    definition: DmnDefinitionXml,
    tenantId?: string
  ): CreateDecisionDto {
    const table = decision.decisionTable!;

    // 转换输入
    const inputs: DecisionInputDto[] = table.inputs.map((input, index) => ({
      id: input.id || `input_${index}`,
      label: input.label || input.inputExpression?.text || `Input ${index + 1}`,
      expression: input.inputExpression?.text || '',
      type: input.inputExpression?.typeRef,
    }));

    // 转换输出
    const outputs: DecisionOutputDto[] = table.outputs.map((output, index) => ({
      id: output.id || `output_${index}`,
      label: output.label || output.name || `Output ${index + 1}`,
      name: output.name || `output_${index}`,
      type: output.typeRef,
    }));

    // 转换规则
    const rules: DecisionRuleDto[] = table.rules.map((rule, ruleIndex) => {
      const conditions: RuleConditionDto[] = rule.inputEntries.map((entry, entryIndex) => {
        const input = table.inputs[entryIndex];
        return this.parseConditionFromText(
          entry.text || '',
          input.id || `input_${entryIndex}`,
          input.inputExpression?.typeRef
        );
      });

      const ruleOutputs: RuleOutputDto[] = rule.outputEntries.map((entry, entryIndex) => {
        const output = table.outputs[entryIndex];
        return {
          outputId: output.id || `output_${entryIndex}`,
          value: this.parseOutputValueFromText(entry.text || '', output.typeRef),
        };
      });

      return {
        id: rule.id || `rule_${ruleIndex}`,
        conditions,
        outputs: ruleOutputs,
        description: rule.description,
      };
    });

    return {
      decisionKey: decision.id,
      name: decision.name,
      description: decision.description,
      hitPolicy: this.mapHitPolicyToEnum(table.hitPolicy || 'FIRST'),
      aggregation: table.aggregation ? this.mapAggregationToEnum(table.aggregation) : undefined,
      inputs,
      outputs,
      rules,
      tenantId,
      extra: {
        originalId: decision.id,
        namespace: definition.namespace,
        variable: decision.variable,
      },
    };
  }

  /**
   * 从文本解析条件
   */
  private parseConditionFromText(text: string, inputId: string, typeRef?: string): RuleConditionDto {
    // 简单的条件解析逻辑
    const trimmed = text.trim();

    // 检查是否是简单比较
    const comparisonMatch = trimmed.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    if (comparisonMatch) {
      return {
        inputId,
        operator: comparisonMatch[2],
        value: this.parseValue(comparisonMatch[3].trim(), typeRef),
      };
    }

    // 检查是否是in操作
    const inMatch = trimmed.match(/^in\s*\((.+)\)$/i);
    if (inMatch) {
      const values = inMatch[1].split(',').map((v) => this.parseValue(v.trim(), typeRef));
      return {
        inputId,
        operator: 'in',
        value: values,
      };
    }

    // 检查是否是between操作
    const betweenMatch = trimmed.match(/^(.+?)\s*\.\.\s*(.+)$/);
    if (betweenMatch) {
      return {
        inputId,
        operator: 'between',
        value: [
          this.parseValue(betweenMatch[1].trim(), typeRef),
          this.parseValue(betweenMatch[2].trim(), typeRef),
        ],
      };
    }

    // 默认作为等于处理
    return {
      inputId,
      operator: '==',
      value: this.parseValue(trimmed, typeRef),
    };
  }

  /**
   * 从文本解析输出值
   */
  private parseOutputValueFromText(text: string, typeRef?: string): any {
    return this.parseValue(text.trim(), typeRef);
  }

  /**
   * 解析值
   */
  private parseValue(text: string, typeRef?: string): any {
    if (!text) return text;

    // 移除引号
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      return text.slice(1, -1);
    }

    // 根据类型解析
    if (typeRef) {
      const lowerType = typeRef.toLowerCase();
      if (lowerType.includes('int') || lowerType.includes('long') || lowerType.includes('short')) {
        const parsed = parseInt(text, 10);
        return isNaN(parsed) ? text : parsed;
      }
      if (lowerType.includes('double') || lowerType.includes('float') || lowerType.includes('decimal')) {
        const parsed = parseFloat(text);
        return isNaN(parsed) ? text : parsed;
      }
      if (lowerType.includes('boolean')) {
        return text.toLowerCase() === 'true';
      }
    }

    // 尝试自动检测类型
    if (text.toLowerCase() === 'true') return true;
    if (text.toLowerCase() === 'false') return false;
    if (text.toLowerCase() === 'null') return null;

    const numValue = parseFloat(text);
    if (!isNaN(numValue) && isFinite(numValue)) {
      return numValue;
    }

    return text;
  }

  /**
   * 映射HitPolicy从XML值
   */
  private mapHitPolicyFromXml(value: string, warnings: string[]): string {
    const normalized = value.toUpperCase().replace(' ', '_');
    const validPolicies = Object.keys(HIT_POLICY_XML_MAP);

    if (validPolicies.includes(normalized)) {
      return normalized;
    }

    // 处理特殊格式
    if (value === 'RULE ORDER') return 'RULE_ORDER';
    if (value === 'OUTPUT ORDER') return 'OUTPUT_ORDER';

    warnings.push(`未知的HitPolicy值: ${value}, 使用默认值FIRST`);
    return 'FIRST';
  }

  /**
   * 映射HitPolicy到枚举
   */
  private mapHitPolicyToEnum(value: string): HitPolicy {
    const mapping: Record<string, HitPolicy> = {
      UNIQUE: HitPolicy.UNIQUE,
      FIRST: HitPolicy.FIRST,
      PRIORITY: HitPolicy.PRIORITY,
      ANY: HitPolicy.ANY,
      COLLECT: HitPolicy.COLLECT,
      RULE_ORDER: HitPolicy.RULE_ORDER,
      OUTPUT_ORDER: HitPolicy.OUTPUT_ORDER,
      UNORDERED: HitPolicy.UNORDERED,
    };

    return mapping[value] || HitPolicy.FIRST;
  }

  /**
   * 映射Aggregation从XML值
   */
  private mapAggregationFromXml(value: string, warnings: string[]): string {
    const upper = value.toUpperCase();
    const validAggregations = Object.keys(AGGREGATION_XML_MAP);

    if (validAggregations.includes(upper)) {
      return upper;
    }

    warnings.push(`未知的Aggregation值: ${value}`);
    return upper;
  }

  /**
   * 映射Aggregation到枚举
   */
  private mapAggregationToEnum(value: string): AggregationType {
    const mapping: Record<string, AggregationType> = {
      SUM: AggregationType.SUM,
      COUNT: AggregationType.COUNT,
      MIN: AggregationType.MIN,
      MAX: AggregationType.MAX,
    };

    return mapping[value] || AggregationType.SUM;
  }

  /**
   * 检测DMN版本
   */
  private detectDmnVersion(definitions: any, definition: DmnDefinitionXml, warnings: string[]): void {
    const namespaces = definition.namespaces || {};

    for (const [prefix, uri] of Object.entries(namespaces)) {
      if (uri === DMN_NAMESPACES.DMN_13) {
        this.logger.debug('检测到DMN 1.3版本');
        return;
      }
      if (uri === DMN_NAMESPACES.DMN_12) {
        this.logger.debug('检测到DMN 1.2版本');
        return;
      }
      if (uri === DMN_NAMESPACES.DMN_11) {
        this.logger.debug('检测到DMN 1.1版本');
        return;
      }
    }

    warnings.push('无法确定DMN版本，将使用1.3作为默认版本');
  }

  /**
   * 验证命名空间
   */
  private validateNamespaces(definitions: any, warnings: string[]): void {
    const namespace = this.getAttribute(definitions, 'xmlns');
    if (!namespace) {
      warnings.push('缺少默认命名空间声明');
    }
  }

  /**
   * 验证Decision元素
   */
  private validateDecision(decision: any, errors: string[], warnings: string[]): void {
    const id = this.getAttribute(decision, DMN_XML_ATTRIBUTES.ID);
    if (!id) {
      errors.push('Decision元素缺少id属性');
    }

    const decisionTable = this.getElement(decision, DMN_XML_ELEMENTS.DECISION_TABLE);
    if (!decisionTable) {
      warnings.push(`Decision '${id}' 没有定义DecisionTable`);
      return;
    }

    // 验证输入输出
    const inputs = this.getElements(decisionTable, DMN_XML_ELEMENTS.INPUT);
    const outputs = this.getElements(decisionTable, DMN_XML_ELEMENTS.OUTPUT);

    if (!inputs || inputs.length === 0) {
      warnings.push(`Decision '${id}' 没有定义输入`);
    }
    if (!outputs || outputs.length === 0) {
      warnings.push(`Decision '${id}' 没有定义输出`);
    }
  }

  /**
   * 提取命名空间
   */
  private extractNamespaces(element: any): Record<string, string> {
    const namespaces: Record<string, string> = {};
    const attrs = Object.keys(element).filter((k) => k.startsWith('@_'));

    for (const attr of attrs) {
      if (attr.startsWith('@_xmlns')) {
        const prefix = attr.replace('@_xmlns:', '').replace('@_xmlns', '');
        const uri = element[attr];
        if (prefix) {
          namespaces[prefix] = uri;
        }
      }
    }

    return namespaces;
  }

  /**
   * 获取属性值
   */
  private getAttribute(element: any, name: string): string | undefined {
    return element[`@_${name}`];
  }

  /**
   * 获取元素
   */
  private getElement(parent: any, name: string): any | null {
    const keys = Object.keys(parent);
    for (const key of keys) {
      if (key === name || key.endsWith(`:${name}`)) {
        return parent[key];
      }
    }
    return null;
  }

  /**
   * 获取元素数组
   */
  private getElements(parent: any, name: string): any[] | null {
    const element = this.getElement(parent, name);
    if (!element) return null;
    return Array.isArray(element) ? element : [element];
  }

  /**
   * 获取元素文本内容
   */
  private getElementText(parent: any, name: string): string | undefined {
    const element = this.getElement(parent, name);
    if (!element) return undefined;

    if (typeof element === 'string') {
      return element;
    }

    return element['#text'];
  }

  /**
   * 创建空定义
   */
  private createEmptyDefinition(): DmnDefinitionXml {
    return {
      id: '',
      namespace: DMN_NAMESPACES.DMN_13,
      decisions: [],
    };
  }
}
