import { Injectable, Logger } from '@nestjs/common';
import { XMLBuilder } from 'fast-xml-parser';
import {
  DmnDefinitionXml,
  DmnDecisionXml,
  DmnDecisionTableXml,
  DmnInputClauseXml,
  DmnOutputClauseXml,
  DmnDecisionRuleXml,
  DmnXmlExportOptions,
  DMN_NAMESPACES,
  DMN_XML_ELEMENTS,
  DMN_XML_ATTRIBUTES,
  HIT_POLICY_XML_MAP,
  AGGREGATION_XML_MAP,
} from '../interfaces/dmn-xml.interface';
import { HitPolicy, AggregationType, DmnDecision } from '../entities/dmn-decision.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * DMN XML导出器服务
 * 负责将内部模型导出为DMN XML
 */
@Injectable()
export class DmnXmlExporterService {
  private readonly logger = new Logger(DmnXmlExporterService.name);
  private readonly builder: XMLBuilder;

  constructor() {
    this.builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true,
      cdataPropName: '#cdata',
    });
  }

  /**
   * 将决策实体导出为DMN XML
   */
  exportToXml(decision: DmnDecision, options?: DmnXmlExportOptions): string {
    const definition = this.convertDecisionToDefinition(decision, options);
    return this.generateXml(definition, options);
  }

  /**
   * 将多个决策导出为DMN XML
   */
  exportDecisionsToXml(decisions: DmnDecision[], options?: DmnXmlExportOptions): string {
    const definition = this.convertDecisionsToDefinition(decisions, options);
    return this.generateXml(definition, options);
  }

  /**
   * 将DmnDefinitionXml导出为XML字符串
   */
  exportDefinitionToXml(definition: DmnDefinitionXml, options?: DmnXmlExportOptions): string {
    return this.generateXml(definition, options);
  }

  /**
   * 生成XML字符串
   */
  private generateXml(definition: DmnDefinitionXml, options?: DmnXmlExportOptions): string {
    const dmnVersion = options?.dmnVersion || '1.3';
    const namespace = this.getNamespaceForVersion(dmnVersion);

    const xmlObj = this.buildDefinitionsElement(definition, namespace, options);
    let xmlContent = this.builder.build(xmlObj);

    // 添加XML声明
    xmlContent = `<?xml version="1.0" encoding="${options?.encoding || 'UTF-8'}"?>\n${xmlContent}`;

    return xmlContent;
  }

  /**
   * 构建definitions元素
   */
  private buildDefinitionsElement(
    definition: DmnDefinitionXml,
    namespace: string,
    options?: DmnXmlExportOptions
  ): any {
    const definitions: any = {
      '@_xmlns': namespace,
      '@_xmlns:dmndi': DMN_NAMESPACES.DMNDI,
      '@_xmlns:dc': DMN_NAMESPACES.DC,
      '@_xmlns:di': DMN_NAMESPACES.DI,
    };

    // 添加ID
    if (definition.id) {
      definitions['@_id'] = definition.id;
    }

    // 添加名称
    if (definition.name) {
      definitions['@_name'] = definition.name;
    }

    // 添加namespace属性
    definitions['@_namespace'] = definition.namespace || 'http://flowable.org/dmn';

    // 添加exporter信息
    if (definition.exporter) {
      definitions['@_exporter'] = definition.exporter;
    }
    if (definition.exporterVersion) {
      definitions['@_exporterVersion'] = definition.exporterVersion;
    }

    // 添加额外命名空间
    if (definition.namespaces) {
      for (const [prefix, uri] of Object.entries(definition.namespaces)) {
        definitions[`@_xmlns:${prefix}`] = uri;
      }
    }

    // 添加ItemDefinitions
    if (definition.itemDefinitions && definition.itemDefinitions.length > 0) {
      for (const itemDef of definition.itemDefinitions) {
        if (!definitions.itemDefinition) {
          definitions.itemDefinition = [];
        }
        definitions.itemDefinition.push(this.buildItemDefinition(itemDef));
      }
    }

    // 添加InputData
    if (definition.inputData && definition.inputData.length > 0) {
      for (const inputData of definition.inputData) {
        if (!definitions.inputData) {
          definitions.inputData = [];
        }
        definitions.inputData.push(this.buildInputData(inputData));
      }
    }

    // 添加Decisions
    if (definition.decisions && definition.decisions.length > 0) {
      for (const decision of definition.decisions) {
        if (!definitions.decision) {
          definitions.decision = [];
        }
        definitions.decision.push(this.buildDecision(decision));
      }
    }

    // 添加DecisionServices
    if (definition.decisionServices && definition.decisionServices.length > 0) {
      for (const ds of definition.decisionServices) {
        if (!definitions.decisionService) {
          definitions.decisionService = [];
        }
        definitions.decisionService.push(this.buildDecisionService(ds));
      }
    }

    return { definitions };
  }

  /**
   * 构建Decision元素
   */
  private buildDecision(decision: DmnDecisionXml): any {
    const result: any = {};

    // 添加属性
    if (decision.id) {
      result['@_id'] = decision.id;
    }
    if (decision.name) {
      result['@_name'] = decision.name;
    }

    // 添加forceDMN11属性
    if (decision.forceDMN11) {
      result['@_flowable:forceDMN11'] = 'true';
    }

    // 添加描述
    if (decision.description) {
      result.description = { '#text': decision.description };
    }

    // 添加Variable
    if (decision.variable) {
      result.variable = {};
      if (decision.variable.id) {
        result.variable['@_id'] = decision.variable.id;
      }
      if (decision.variable.name) {
        result.variable['@_name'] = decision.variable.name;
      }
      if (decision.variable.typeRef) {
        result.variable['@_typeRef'] = decision.variable.typeRef;
      }
    }

    // 添加InformationRequirements
    if (decision.informationRequirements && decision.informationRequirements.length > 0) {
      for (const infoReq of decision.informationRequirements) {
        if (!result.informationRequirement) {
          result.informationRequirement = [];
        }
        result.informationRequirement.push(this.buildInformationRequirement(infoReq));
      }
    }

    // 添加AuthorityRequirements
    if (decision.authorityRequirements && decision.authorityRequirements.length > 0) {
      for (const authReq of decision.authorityRequirements) {
        if (!result.authorityRequirement) {
          result.authorityRequirement = [];
        }
        result.authorityRequirement.push(this.buildAuthorityRequirement(authReq));
      }
    }

    // 添加DecisionTable
    if (decision.decisionTable) {
      result.decisionTable = this.buildDecisionTable(decision.decisionTable);
    }

    return result;
  }

  /**
   * 构建DecisionTable元素
   */
  private buildDecisionTable(table: DmnDecisionTableXml): any {
    const result: any = {};

    // 添加属性
    if (table.id) {
      result['@_id'] = table.id;
    }

    // 添加HitPolicy
    if (table.hitPolicy) {
      result['@_hitPolicy'] = this.mapHitPolicyToXml(table.hitPolicy);
    }

    // 添加Aggregation
    if (table.aggregation) {
      result['@_aggregation'] = this.mapAggregationToXml(table.aggregation);
    }

    // 添加描述
    if (table.description) {
      result.description = { '#text': table.description };
    }

    // 添加Inputs
    if (table.inputs && table.inputs.length > 0) {
      for (const input of table.inputs) {
        if (!result.input) {
          result.input = [];
        }
        result.input.push(this.buildInputClause(input));
      }
    }

    // 添加Outputs
    if (table.outputs && table.outputs.length > 0) {
      for (const output of table.outputs) {
        if (!result.output) {
          result.output = [];
        }
        result.output.push(this.buildOutputClause(output));
      }
    }

    // 添加Rules
    if (table.rules && table.rules.length > 0) {
      for (const rule of table.rules) {
        if (!result.rule) {
          result.rule = [];
        }
        result.rule.push(this.buildRule(rule));
      }
    }

    return result;
  }

  /**
   * 构建InputClause元素
   */
  private buildInputClause(input: DmnInputClauseXml): any {
    const result: any = {};

    // 添加属性
    if (input.id) {
      result['@_id'] = input.id;
    }
    if (input.label) {
      result['@_label'] = input.label;
    }

    // 添加描述
    if (input.description) {
      result.description = { '#text': input.description };
    }

    // 添加InputExpression
    if (input.inputExpression) {
      result.inputExpression = {};
      if (input.inputExpression.id) {
        result.inputExpression['@_id'] = input.inputExpression.id;
      }
      if (input.inputExpression.typeRef) {
        result.inputExpression['@_typeRef'] = input.inputExpression.typeRef;
      }
      if (input.inputExpression.text) {
        result.inputExpression.text = { '#text': input.inputExpression.text };
      }
    }

    // 添加InputValues
    if (input.inputValues && input.inputValues.text) {
      result.inputValues = {
        text: { '#text': input.inputValues.text },
      };
    }

    return result;
  }

  /**
   * 构建OutputClause元素
   */
  private buildOutputClause(output: DmnOutputClauseXml): any {
    const result: any = {};

    // 添加属性
    if (output.id) {
      result['@_id'] = output.id;
    }
    if (output.label) {
      result['@_label'] = output.label;
    }
    if (output.name) {
      result['@_name'] = output.name;
    }
    if (output.typeRef) {
      result['@_typeRef'] = output.typeRef;
    }

    // 添加描述
    if (output.description) {
      result.description = { '#text': output.description };
    }

    // 添加OutputValues
    if (output.outputValues && output.outputValues.text) {
      result.outputValues = {
        text: { '#text': output.outputValues.text },
      };
    }

    // 添加DefaultOutputEntry
    if (output.defaultOutputEntry && output.defaultOutputEntry.text) {
      result.defaultOutputEntry = {
        text: { '#cdata': output.defaultOutputEntry.text },
      };
    }

    return result;
  }

  /**
   * 构建Rule元素
   */
  private buildRule(rule: DmnDecisionRuleXml): any {
    const result: any = {};

    // 添加属性
    if (rule.id) {
      result['@_id'] = rule.id;
    }

    // 添加描述
    if (rule.description) {
      result.description = { '#text': rule.description };
    }

    // 添加InputEntries
    if (rule.inputEntries && rule.inputEntries.length > 0) {
      for (const entry of rule.inputEntries) {
        if (!result.inputEntry) {
          result.inputEntry = [];
        }
        const inputEntry: any = {};
        if (entry.id) {
          inputEntry['@_id'] = entry.id;
        }
        if (entry.text) {
          inputEntry.text = { '#cdata': entry.text };
        }
        result.inputEntry.push(inputEntry);
      }
    }

    // 添加OutputEntries
    if (rule.outputEntries && rule.outputEntries.length > 0) {
      for (const entry of rule.outputEntries) {
        if (!result.outputEntry) {
          result.outputEntry = [];
        }
        const outputEntry: any = {};
        if (entry.id) {
          outputEntry['@_id'] = entry.id;
        }
        if (entry.text) {
          outputEntry.text = { '#cdata': entry.text };
        }
        result.outputEntry.push(outputEntry);
      }
    }

    return result;
  }

  /**
   * 构建ItemDefinition元素
   */
  private buildItemDefinition(itemDef: any): any {
    const result: any = {};

    if (itemDef.id) {
      result['@_id'] = itemDef.id;
    }
    if (itemDef.name) {
      result['@_name'] = itemDef.name;
    }
    if (itemDef.label) {
      result['@_label'] = itemDef.label;
    }
    if (itemDef.isCollection) {
      result['@_isCollection'] = 'true';
    }

    if (itemDef.typeRef) {
      result.typeRef = { '#text': itemDef.typeRef };
    }

    if (itemDef.itemComponents && itemDef.itemComponents.length > 0) {
      for (const component of itemDef.itemComponents) {
        if (!result.itemComponent) {
          result.itemComponent = [];
        }
        result.itemComponent.push(this.buildItemDefinition(component));
      }
    }

    return result;
  }

  /**
   * 构建InputData元素
   */
  private buildInputData(inputData: any): any {
    const result: any = {};

    if (inputData.id) {
      result['@_id'] = inputData.id;
    }
    if (inputData.name) {
      result['@_name'] = inputData.name;
    }

    if (inputData.variable) {
      result.variable = {};
      if (inputData.variable.id) {
        result.variable['@_id'] = inputData.variable.id;
      }
      if (inputData.variable.name) {
        result.variable['@_name'] = inputData.variable.name;
      }
      if (inputData.variable.typeRef) {
        result.variable['@_typeRef'] = inputData.variable.typeRef;
      }
    }

    return result;
  }

  /**
   * 构建DecisionService元素
   */
  private buildDecisionService(ds: any): any {
    const result: any = {};

    if (ds.id) {
      result['@_id'] = ds.id;
    }
    if (ds.name) {
      result['@_name'] = ds.name;
    }

    if (ds.outputDecisions && ds.outputDecisions.length > 0) {
      for (const od of ds.outputDecisions) {
        if (!result.outputDecision) {
          result.outputDecision = [];
        }
        result.outputDecision.push({
          '@_href': od.href,
        });
      }
    }

    if (ds.encapsulatedDecisions && ds.encapsulatedDecisions.length > 0) {
      for (const ed of ds.encapsulatedDecisions) {
        if (!result.encapsulatedDecision) {
          result.encapsulatedDecision = [];
        }
        result.encapsulatedDecision.push({
          '@_href': ed.href,
        });
      }
    }

    if (ds.inputData && ds.inputData.length > 0) {
      for (const id of ds.inputData) {
        if (!result.inputData) {
          result.inputData = [];
        }
        result.inputData.push({
          '@_href': id.href,
        });
      }
    }

    return result;
  }

  /**
   * 构建InformationRequirement元素
   */
  private buildInformationRequirement(infoReq: any): any {
    const result: any = {};

    if (infoReq.id) {
      result['@_id'] = infoReq.id;
    }

    if (infoReq.requiredDecision) {
      result.requiredDecision = {
        '@_href': infoReq.requiredDecision.href,
      };
    }

    if (infoReq.requiredInput) {
      result.requiredInput = {
        '@_href': infoReq.requiredInput.href,
      };
    }

    return result;
  }

  /**
   * 构建AuthorityRequirement元素
   */
  private buildAuthorityRequirement(authReq: any): any {
    const result: any = {};

    if (authReq.id) {
      result['@_id'] = authReq.id;
    }

    if (authReq.requiredAuthority) {
      result.requiredAuthority = {
        '@_href': authReq.requiredAuthority.href,
      };
    }

    return result;
  }

  /**
   * 将决策实体转换为DmnDefinitionXml
   */
  private convertDecisionToDefinition(decision: DmnDecision, options?: DmnXmlExportOptions): DmnDefinitionXml {
    return this.convertDecisionsToDefinition([decision], options);
  }

  /**
   * 将多个决策实体转换为DmnDefinitionXml
   */
  private convertDecisionsToDefinition(decisions: DmnDecision[], options?: DmnXmlExportOptions): DmnDefinitionXml {
    const definitionId = `definitions_${uuidv4().replace(/-/g, '_')}`;

    const definition: DmnDefinitionXml = {
      id: definitionId,
      name: 'DMN Definitions',
      namespace: 'http://flowable.org/dmn',
      exporter: 'flow-node-engine',
      exporterVersion: '1.0.0',
      decisions: [],
    };

    for (const decision of decisions) {
      definition.decisions.push(this.convertDecisionEntityToXml(decision));
    }

    return definition;
  }

  /**
   * 将决策实体转换为DmnDecisionXml
   */
  private convertDecisionEntityToXml(decision: DmnDecision): DmnDecisionXml {
    const decisionXml: DmnDecisionXml = {
      id: decision.decisionKey,
      name: decision.name || decision.decisionKey,
      description: decision.description,
      decisionTable: this.convertDecisionTableToXml(decision),
    };

    return decisionXml;
  }

  /**
   * 将决策表转换为DmnDecisionTableXml
   */
  private convertDecisionTableToXml(decision: DmnDecision): DmnDecisionTableXml {
    const tableId = `decisionTable_${uuidv4().replace(/-/g, '_')}`;

    const table: DmnDecisionTableXml = {
      id: tableId,
      hitPolicy: this.mapHitPolicyFromEnum(decision.hitPolicy),
      aggregation: decision.aggregation ? this.mapAggregationFromEnum(decision.aggregation) : undefined,
      inputs: [],
      outputs: [],
      rules: [],
    };

    // 转换输入
    const inputs = this.parseInputs(decision);
    for (const input of inputs) {
      table.inputs.push(input);
    }

    // 转换输出
    const outputs = this.parseOutputs(decision);
    for (const output of outputs) {
      table.outputs.push(output);
    }

    // 转换规则
    const rules = this.parseRules(decision, table.inputs, table.outputs);
    for (const rule of rules) {
      table.rules.push(rule);
    }

    return table;
  }

  /**
   * 解析输入定义
   */
  private parseInputs(decision: DmnDecision): DmnInputClauseXml[] {
    const inputs: DmnInputClauseXml[] = [];
    const inputsData = decision.inputs || [];

    for (let i = 0; i < inputsData.length; i++) {
      const input = inputsData[i];
      inputs.push({
        id: input.id || `input_${i}`,
        label: input.label,
        inputExpression: {
          id: `inputExpression_${i}`,
          text: input.expression || input.label,
          typeRef: input.type,
        },
      });
    }

    return inputs;
  }

  /**
   * 解析输出定义
   */
  private parseOutputs(decision: DmnDecision): DmnOutputClauseXml[] {
    const outputs: DmnOutputClauseXml[] = [];
    const outputsData = decision.outputs || [];

    for (let i = 0; i < outputsData.length; i++) {
      const output = outputsData[i];
      outputs.push({
        id: output.id || `output_${i}`,
        label: output.label,
        name: output.name,
        typeRef: output.type,
      });
    }

    return outputs;
  }

  /**
   * 解析规则
   */
  private parseRules(
    decision: DmnDecision,
    inputs: DmnInputClauseXml[],
    outputs: DmnOutputClauseXml[]
  ): DmnDecisionRuleXml[] {
    const rules: DmnDecisionRuleXml[] = [];
    const rulesData = decision.rules || [];

    for (let i = 0; i < rulesData.length; i++) {
      const rule = rulesData[i];
      const ruleId = rule.id || `rule_${i}`;

      // 构建输入条目
      const inputEntries: any[] = [];
      const conditions = rule.conditions || [];
      for (let j = 0; j < inputs.length; j++) {
        const condition = conditions.find((c) => c.inputId === inputs[j].id);
        const entryId = `inputEntry_${i}_${j}`;
        inputEntries.push({
          id: entryId,
          text: condition ? this.buildConditionText(condition) : '',
        });
      }

      // 构建输出条目
      const outputEntries: any[] = [];
      const ruleOutputs = rule.outputs || [];
      for (let j = 0; j < outputs.length; j++) {
        const output = ruleOutputs.find((o) => o.outputId === outputs[j].id);
        const entryId = `outputEntry_${i}_${j}`;
        outputEntries.push({
          id: entryId,
          text: output ? this.buildOutputText(output.value) : '',
        });
      }

      rules.push({
        id: ruleId,
        description: rule.description,
        inputEntries,
        outputEntries,
      });
    }

    return rules;
  }

  /**
   * 构建条件文本
   */
  private buildConditionText(condition: any): string {
    const value = condition.value;

    switch (condition.operator) {
      case '==':
        return this.formatValue(value);
      case '!=':
        return `not(${this.formatValue(value)})`;
      case '>':
        return `> ${this.formatValue(value)}`;
      case '<':
        return `< ${this.formatValue(value)}`;
      case '>=':
        return `>= ${this.formatValue(value)}`;
      case '<=':
        return `<= ${this.formatValue(value)}`;
      case 'in':
        if (Array.isArray(value)) {
          return value.map((v) => this.formatValue(v)).join(', ');
        }
        return this.formatValue(value);
      case 'not in':
        if (Array.isArray(value)) {
          return `not(${value.map((v) => this.formatValue(v)).join(', ')})`;
        }
        return `not(${this.formatValue(value)})`;
      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          return `[${this.formatValue(value[0])}..${this.formatValue(value[1])}]`;
        }
        return this.formatValue(value);
      default:
        return this.formatValue(value);
    }
  }

  /**
   * 构建输出文本
   */
  private buildOutputText(value: any): string {
    return this.formatValue(value);
  }

  /**
   * 格式化值
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      // 如果已经是带引号的字符串，直接返回
      if (value.startsWith('"') && value.endsWith('"')) {
        return value;
      }
      return `"${value}"`;
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    return String(value);
  }

  /**
   * 映射HitPolicy到XML值
   */
  private mapHitPolicyToXml(value: string): string {
    const mapping: Record<string, string> = {
      UNIQUE: 'UNIQUE',
      FIRST: 'FIRST',
      PRIORITY: 'PRIORITY',
      ANY: 'ANY',
      COLLECT: 'COLLECT',
      RULE_ORDER: 'RULE ORDER',
      OUTPUT_ORDER: 'OUTPUT ORDER',
      UNORDERED: 'UNORDERED',
    };

    return mapping[value] || 'FIRST';
  }

  /**
   * 映射HitPolicy从枚举
   */
  private mapHitPolicyFromEnum(value: HitPolicy): string {
    return value || HitPolicy.FIRST;
  }

  /**
   * 映射Aggregation到XML值
   */
  private mapAggregationToXml(value: string): string {
    const mapping: Record<string, string> = {
      SUM: 'SUM',
      COUNT: 'COUNT',
      MIN: 'MIN',
      MAX: 'MAX',
    };

    return mapping[value] || value;
  }

  /**
   * 映射Aggregation从枚举
   */
  private mapAggregationFromEnum(value: AggregationType): string {
    return value || AggregationType.SUM;
  }

  /**
   * 获取指定版本的命名空间
   */
  private getNamespaceForVersion(version: string): string {
    switch (version) {
      case '1.1':
        return DMN_NAMESPACES.DMN_11;
      case '1.2':
        return DMN_NAMESPACES.DMN_12;
      case '1.3':
      default:
        return DMN_NAMESPACES.DMN_13;
    }
  }
}
