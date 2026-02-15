import { Test, TestingModule } from '@nestjs/testing';
import { DmnXmlParserService } from './dmn-xml-parser.service';
import { HitPolicy } from '../entities/dmn-decision.entity';

describe('DmnXmlParserService', () => {
  let service: DmnXmlParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DmnXmlParserService],
    }).compile();

    service = module.get<DmnXmlParserService>(DmnXmlParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseXml', () => {
    it('should parse a simple DMN XML', () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="definitions_1" name="Test Definitions" 
    xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
    xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/">
  <decision id="decision_1" name="Test Decision">
    <decisionTable id="table_1" hitPolicy="FIRST">
      <input id="input_1" label="Age">
        <inputExpression id="expr_1" typeRef="number">
          <text>age</text>
        </inputExpression>
      </input>
      <output id="output_1" label="Result" name="result" typeRef="string"/>
      <rule id="rule_1">
        <inputEntry id="entry_1_1">
          <text>> 18</text>
        </inputEntry>
        <outputEntry id="entry_1_2">
          <text>"Adult"</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

      const result = service.parseXml(xmlContent);

      expect(result.errors).toHaveLength(0);
      expect(result.definition.id).toBe('definitions_1');
      expect(result.definition.name).toBe('Test Definitions');
      expect(result.definition.decisions).toHaveLength(1);
      expect(result.definition.decisions[0].id).toBe('decision_1');
      expect(result.definition.decisions[0].name).toBe('Test Decision');
    });

    it('should parse decision table with inputs and outputs', () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="definitions_1" xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/">
  <decision id="decision_1" name="Test Decision">
    <decisionTable id="table_1" hitPolicy="UNIQUE">
      <input id="input_1" label="Score">
        <inputExpression id="expr_1" typeRef="number">
          <text>score</text>
        </inputExpression>
      </input>
      <input id="input_2" label="Level">
        <inputExpression id="expr_2" typeRef="string">
          <text>level</text>
        </inputExpression>
      </input>
      <output id="output_1" label="Grade" name="grade" typeRef="string"/>
      <rule id="rule_1">
        <inputEntry id="entry_1_1"><text>>= 90</text></inputEntry>
        <inputEntry id="entry_1_2"><text>"A"</text></inputEntry>
        <outputEntry id="out_1"><text>"Excellent"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

      const result = service.parseXml(xmlContent);

      expect(result.errors).toHaveLength(0);
      const table = result.definition.decisions[0].decisionTable;
      expect(table).toBeDefined();
      expect(table?.inputs).toHaveLength(2);
      expect(table?.outputs).toHaveLength(1);
      expect(table?.rules).toHaveLength(1);
      expect(table?.hitPolicy).toBe('UNIQUE');
    });

    it('should parse different hit policies', () => {
      const hitPolicies = ['UNIQUE', 'FIRST', 'PRIORITY', 'ANY', 'COLLECT', 'RULE ORDER', 'OUTPUT ORDER'];

      for (const policy of hitPolicies) {
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="definitions_1" xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/">
  <decision id="decision_1">
    <decisionTable id="table_1" hitPolicy="${policy}">
      <input id="input_1">
        <inputExpression><text>x</text></inputExpression>
      </input>
      <output id="output_1" name="result"/>
      <rule id="rule_1">
        <inputEntry><text>1</text></inputEntry>
        <outputEntry><text>"A"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

        const result = service.parseXml(xmlContent);
        expect(result.errors).toHaveLength(0);
        const table = result.definition.decisions[0].decisionTable;
        expect(table?.hitPolicy).toBeDefined();
      }
    });

    it('should parse COLLECT hit policy with aggregation', () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="definitions_1" xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/">
  <decision id="decision_1">
    <decisionTable id="table_1" hitPolicy="COLLECT" aggregation="SUM">
      <input id="input_1">
        <inputExpression><text>category</text></inputExpression>
      </input>
      <output id="output_1" name="total" typeRef="number"/>
      <rule id="rule_1">
        <inputEntry><text>"A"</text></inputEntry>
        <outputEntry><text>100</text></outputEntry>
      </rule>
      <rule id="rule_2">
        <inputEntry><text>"A"</text></inputEntry>
        <outputEntry><text>200</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

      const result = service.parseXml(xmlContent);
      expect(result.errors).toHaveLength(0);
      const table = result.definition.decisions[0].decisionTable;
      expect(table?.hitPolicy).toBe('COLLECT');
      expect(table?.aggregation).toBe('SUM');
    });

    it('should return errors for invalid XML', () => {
      const invalidXml = 'not valid xml';
      const result = service.parseXml(invalidXml);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return error when definitions element is missing', () => {
      const xmlWithoutDefinitions = `<?xml version="1.0" encoding="UTF-8"?>
<otherRoot id="test">
  <decision id="decision_1"/>
</otherRoot>`;

      const result = service.parseXml(xmlWithoutDefinitions);
      expect(result.errors).toContain('未找到DMN definitions元素');
    });
  });

  describe('validateXml', () => {
    it('should validate a correct DMN XML', () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="definitions_1" xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/">
  <decision id="decision_1" name="Test Decision">
    <decisionTable id="table_1" hitPolicy="FIRST">
      <input id="input_1" label="Age">
        <inputExpression id="expr_1" typeRef="number">
          <text>age</text>
        </inputExpression>
      </input>
      <output id="output_1" label="Result" name="result" typeRef="string"/>
      <rule id="rule_1">
        <inputEntry id="entry_1_1"><text>> 18</text></inputEntry>
        <outputEntry id="entry_1_2"><text>"Adult"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

      const result = service.validateXml(xmlContent);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report errors for missing decision id', () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="definitions_1" xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/">
  <decision name="Test Decision">
    <decisionTable id="table_1">
      <input id="input_1">
        <inputExpression><text>x</text></inputExpression>
      </input>
      <output id="output_1" name="result"/>
    </decisionTable>
  </decision>
</definitions>`;

      const result = service.validateXml(xmlContent);
      expect(result.errors).toContain('Decision元素缺少id属性');
    });

    it('should warn when no decisions are defined', () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="definitions_1" xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/">
</definitions>`;

      const result = service.validateXml(xmlContent);
      expect(result.warnings).toContain('未定义任何决策');
    });
  });

  describe('convertToCreateDto', () => {
    it('should convert DMN XML to CreateDecisionDto', () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="definitions_1" xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/">
  <decision id="decision_1" name="Test Decision">
    <decisionTable id="table_1" hitPolicy="FIRST">
      <input id="input_1" label="Age">
        <inputExpression id="expr_1" typeRef="number">
          <text>age</text>
        </inputExpression>
      </input>
      <output id="output_1" label="Result" name="result" typeRef="string"/>
      <rule id="rule_1">
        <inputEntry id="entry_1_1"><text>> 18</text></inputEntry>
        <outputEntry id="entry_1_2"><text>"Adult"</text></outputEntry>
      </rule>
      <rule id="rule_2">
        <inputEntry id="entry_2_1"><text><= 18</text></inputEntry>
        <outputEntry id="entry_2_2"><text>"Minor"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

      const dtos = service.convertToCreateDto(xmlContent);

      expect(dtos).toHaveLength(1);
      expect(dtos[0].decisionKey).toBe('decision_1');
      expect(dtos[0].name).toBe('Test Decision');
      expect(dtos[0].hitPolicy).toBe(HitPolicy.FIRST);
      expect(dtos[0].inputs).toHaveLength(1);
      expect(dtos[0].outputs).toHaveLength(1);
      expect(dtos[0].rules).toHaveLength(2);
    });

    it('should convert multiple decisions', () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="definitions_1" xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/">
  <decision id="decision_1" name="First Decision">
    <decisionTable id="table_1">
      <input id="input_1"><inputExpression><text>x</text></inputExpression></input>
      <output id="output_1" name="result"/>
      <rule id="rule_1">
        <inputEntry><text>1</text></inputEntry>
        <outputEntry><text>"A"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
  <decision id="decision_2" name="Second Decision">
    <decisionTable id="table_2">
      <input id="input_2"><inputExpression><text>y</text></inputExpression></input>
      <output id="output_2" name="result"/>
      <rule id="rule_2">
        <inputEntry><text>2</text></inputEntry>
        <outputEntry><text>"B"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

      const dtos = service.convertToCreateDto(xmlContent);
      expect(dtos).toHaveLength(2);
      expect(dtos[0].decisionKey).toBe('decision_1');
      expect(dtos[1].decisionKey).toBe('decision_2');
    });

    it('should include tenantId when provided', () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="definitions_1" xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/">
  <decision id="decision_1">
    <decisionTable id="table_1">
      <input id="input_1"><inputExpression><text>x</text></inputExpression></input>
      <output id="output_1" name="result"/>
      <rule id="rule_1">
        <inputEntry><text>1</text></inputEntry>
        <outputEntry><text>"A"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

      const dtos = service.convertToCreateDto(xmlContent, 'tenant-123');
      expect(dtos[0].tenantId).toBe('tenant-123');
    });

    it('should throw error for invalid XML', () => {
      const invalidXml = 'invalid xml';
      expect(() => service.convertToCreateDto(invalidXml)).toThrow('DMN XML解析失败');
    });
  });

  describe('parseConditionFromText', () => {
    it('should parse comparison operators', () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="definitions_1" xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/">
  <decision id="decision_1">
    <decisionTable id="table_1">
      <input id="input_1"><inputExpression typeRef="number"><text>value</text></inputExpression></input>
      <output id="output_1" name="result"/>
      <rule id="rule_1">
        <inputEntry><text>> 10</text></inputEntry>
        <outputEntry><text>"A"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

      const dtos = service.convertToCreateDto(xmlContent);
      expect(dtos[0].rules[0].conditions[0].operator).toBe('>');
      expect(dtos[0].rules[0].conditions[0].value).toBe(10);
    });

    it('should parse between operator', () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="definitions_1" xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/">
  <decision id="decision_1">
    <decisionTable id="table_1">
      <input id="input_1"><inputExpression typeRef="number"><text>value</text></inputExpression></input>
      <output id="output_1" name="result"/>
      <rule id="rule_1">
        <inputEntry><text>[10..20]</text></inputEntry>
        <outputEntry><text>"Range"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

      const dtos = service.convertToCreateDto(xmlContent);
      expect(dtos[0].rules[0].conditions[0].operator).toBe('between');
      expect(dtos[0].rules[0].conditions[0].value).toEqual([10, 20]);
    });
  });

  describe('parseValue', () => {
    it('should parse string values with quotes', () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="definitions_1" xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/">
  <decision id="decision_1">
    <decisionTable id="table_1">
      <input id="input_1"><inputExpression typeRef="string"><text>name</text></inputExpression></input>
      <output id="output_1" name="result"/>
      <rule id="rule_1">
        <inputEntry><text>"John"</text></inputEntry>
        <outputEntry><text>"Hello"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

      const dtos = service.convertToCreateDto(xmlContent);
      expect(dtos[0].rules[0].conditions[0].value).toBe('John');
    });

    it('should parse boolean values', () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="definitions_1" xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/">
  <decision id="decision_1">
    <decisionTable id="table_1">
      <input id="input_1"><inputExpression typeRef="boolean"><text>active</text></inputExpression></input>
      <output id="output_1" name="result"/>
      <rule id="rule_1">
        <inputEntry><text>true</text></inputEntry>
        <outputEntry><text>"Yes"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

      const dtos = service.convertToCreateDto(xmlContent);
      expect(dtos[0].rules[0].conditions[0].value).toBe(true);
    });
  });
});
