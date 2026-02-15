import { Test, TestingModule } from '@nestjs/testing';
import { DmnXmlExporterService } from './dmn-xml-exporter.service';
import { DmnDecisionEntity, HitPolicy, AggregationType, DmnDecisionStatus } from '../entities/dmn-decision.entity';
import { DmnDefinitionXml } from '../interfaces/dmn-xml.interface';

describe('DmnXmlExporterService', () => {
  let service: DmnXmlExporterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DmnXmlExporterService],
    }).compile();

    service = module.get<DmnXmlExporterService>(DmnXmlExporterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('exportToXml', () => {
    it('should export a simple decision to DMN XML', () => {
      const decision = createMockDecision({
        decisionKey: 'decision_1',
        name: 'Test Decision',
        hitPolicy: HitPolicy.FIRST,
      });

      const xml = service.exportToXml(decision);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<definitions');
      expect(xml).toContain('<decision');
      expect(xml).toContain('id="decision_1"');
      expect(xml).toContain('name="Test Decision"');
      expect(xml).toContain('<decisionTable');
      expect(xml).toContain('</decisionTable>');
      expect(xml).toContain('</decision>');
      expect(xml).toContain('</definitions>');
    });

    it('should export decision with inputs and outputs', () => {
      const decision = createMockDecision({
        inputs: [
          { id: 'input_1', label: 'Age', expression: 'age', type: 'number' },
          { id: 'input_2', label: 'Name', expression: 'name', type: 'string' },
        ],
        outputs: [
          { id: 'output_1', label: 'Result', name: 'result', type: 'string' },
        ],
      });

      const xml = service.exportToXml(decision);

      expect(xml).toContain('<input');
      expect(xml).toContain('label="Age"');
      expect(xml).toContain('<inputExpression');
      expect(xml).toContain('<text>age</text>');
      expect(xml).toContain('<output');
      expect(xml).toContain('name="result"');
    });

    it('should export decision with rules', () => {
      const decision = createMockDecision({
        rules: [
          {
            id: 'rule_1',
            conditions: [
              { inputId: 'input_1', operator: '>', value: 18 },
            ],
            outputs: [
              { outputId: 'output_1', value: 'Adult' },
            ],
          },
          {
            id: 'rule_2',
            conditions: [
              { inputId: 'input_1', operator: '<=', value: 18 },
            ],
            outputs: [
              { outputId: 'output_1', value: 'Minor' },
            ],
          },
        ],
      });

      const xml = service.exportToXml(decision);

      expect(xml).toContain('<rule');
      expect(xml).toContain('<inputEntry');
      expect(xml).toContain('<outputEntry');
      expect(xml).toContain('> 18');
    });

    it('should export different hit policies', () => {
      const hitPolicies = [
        HitPolicy.UNIQUE,
        HitPolicy.FIRST,
        HitPolicy.PRIORITY,
        HitPolicy.ANY,
        HitPolicy.COLLECT,
        HitPolicy.RULE_ORDER,
        HitPolicy.OUTPUT_ORDER,
        HitPolicy.UNORDERED,
      ];

      for (const policy of hitPolicies) {
        const decision = createMockDecision({ hitPolicy: policy });
        const xml = service.exportToXml(decision);
        expect(xml).toContain('hitPolicy');
      }
    });

    it('should export COLLECT hit policy with aggregation', () => {
      const decision = createMockDecision({
        hitPolicy: HitPolicy.COLLECT,
        aggregation: AggregationType.SUM,
      });

      const xml = service.exportToXml(decision);

      expect(xml).toContain('hitPolicy="COLLECT"');
      expect(xml).toContain('aggregation="SUM"');
    });

    it('should export with DMN 1.3 namespace by default', () => {
      const decision = createMockDecision();
      const xml = service.exportToXml(decision);

      expect(xml).toContain('xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"');
    });

    it('should export with DMN 1.2 namespace when specified', () => {
      const decision = createMockDecision();
      const xml = service.exportToXml(decision, { dmnVersion: '1.2' });

      expect(xml).toContain('xmlns="http://www.omg.org/spec/DMN/20180521/MODEL/"');
    });

    it('should export with DMN 1.1 namespace when specified', () => {
      const decision = createMockDecision();
      const xml = service.exportToXml(decision, { dmnVersion: '1.1' });

      expect(xml).toContain('xmlns="http://www.omg.org/spec/DMN/20151101/dmn.xsd"');
    });

    it('should include description when present', () => {
      const decision = createMockDecision({
        description: 'This is a test decision',
      });

      const xml = service.exportToXml(decision);

      expect(xml).toContain('This is a test decision');
    });
  });

  describe('exportDecisionsToXml', () => {
    it('should export multiple decisions to single DMN XML', () => {
      const decisions = [
        createMockDecision({ decisionKey: 'decision_1', name: 'First Decision' }),
        createMockDecision({ decisionKey: 'decision_2', name: 'Second Decision' }),
      ];

      const xml = service.exportDecisionsToXml(decisions);

      expect(xml).toContain('id="decision_1"');
      expect(xml).toContain('name="First Decision"');
      expect(xml).toContain('id="decision_2"');
      expect(xml).toContain('name="Second Decision"');
    });
  });

  describe('exportDefinitionToXml', () => {
    it('should export DmnDefinitionXml to XML', () => {
      const definition: DmnDefinitionXml = {
        id: 'definitions_1',
        name: 'Test Definitions',
        namespace: 'http://test.org/dmn',
        exporter: 'test-exporter',
        exporterVersion: '1.0.0',
        decisions: [
          {
            id: 'decision_1',
            name: 'Test Decision',
            decisionTable: {
              id: 'table_1',
              hitPolicy: 'FIRST',
              inputs: [
                {
                  id: 'input_1',
                  inputExpression: { text: 'x' },
                },
              ],
              outputs: [
                {
                  id: 'output_1',
                  name: 'result',
                },
              ],
              rules: [],
            },
          },
        ],
      };

      const xml = service.exportDefinitionToXml(definition);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('id="definitions_1"');
      expect(xml).toContain('name="Test Definitions"');
      expect(xml).toContain('exporter="test-exporter"');
      expect(xml).toContain('exporterVersion="1.0.0"');
    });
  });

  describe('condition formatting', () => {
    it('should format equality condition', () => {
      const decision = createMockDecision({
        rules: [
          {
            conditions: [{ inputId: 'input_1', operator: '==', value: 'test' }],
            outputs: [{ outputId: 'output_1', value: 'result' }],
          },
        ],
      });

      const xml = service.exportToXml(decision);
      expect(xml).toContain('"test"');
    });

    it('should format comparison conditions', () => {
      const decision = createMockDecision({
        rules: [
          {
            conditions: [{ inputId: 'input_1', operator: '>', value: 10 }],
            outputs: [{ outputId: 'output_1', value: 'result' }],
          },
        ],
      });

      const xml = service.exportToXml(decision);
      expect(xml).toContain('> 10');
    });

    it('should format between condition', () => {
      const decision = createMockDecision({
        rules: [
          {
            conditions: [{ inputId: 'input_1', operator: 'between', value: [10, 20] }],
            outputs: [{ outputId: 'output_1', value: 'result' }],
          },
        ],
      });

      const xml = service.exportToXml(decision);
      expect(xml).toContain('[10..20]');
    });

    it('should format in condition', () => {
      const decision = createMockDecision({
        rules: [
          {
            conditions: [{ inputId: 'input_1', operator: 'in', value: ['A', 'B', 'C'] }],
            outputs: [{ outputId: 'output_1', value: 'result' }],
          },
        ],
      });

      const xml = service.exportToXml(decision);
      expect(xml).toContain('"A"');
      expect(xml).toContain('"B"');
      expect(xml).toContain('"C"');
    });

    it('should format not equal condition', () => {
      const decision = createMockDecision({
        rules: [
          {
            conditions: [{ inputId: 'input_1', operator: '!=', value: 'exclude' }],
            outputs: [{ outputId: 'output_1', value: 'result' }],
          },
        ],
      });

      const xml = service.exportToXml(decision);
      expect(xml).toContain('not("exclude")');
    });
  });

  describe('value formatting', () => {
    it('should format string values with quotes', () => {
      const decision = createMockDecision({
        rules: [
          {
            conditions: [{ inputId: 'input_1', operator: '==', value: 'hello' }],
            outputs: [{ outputId: 'output_1', value: 'world' }],
          },
        ],
      });

      const xml = service.exportToXml(decision);
      expect(xml).toContain('"hello"');
      expect(xml).toContain('"world"');
    });

    it('should format numeric values without quotes', () => {
      const decision = createMockDecision({
        rules: [
          {
            conditions: [{ inputId: 'input_1', operator: '==', value: 42 }],
            outputs: [{ outputId: 'output_1', value: 100 }],
          },
        ],
      });

      const xml = service.exportToXml(decision);
      expect(xml).toContain('42');
      expect(xml).toContain('100');
    });

    it('should format boolean values', () => {
      const decision = createMockDecision({
        rules: [
          {
            conditions: [{ inputId: 'input_1', operator: '==', value: true }],
            outputs: [{ outputId: 'output_1', value: false }],
          },
        ],
      });

      const xml = service.exportToXml(decision);
      expect(xml).toContain('true');
    });

    it('should format null values', () => {
      const decision = createMockDecision({
        rules: [
          {
            conditions: [{ inputId: 'input_1', operator: '==', value: null }],
            outputs: [{ outputId: 'output_1', value: 'result' }],
          },
        ],
      });

      const xml = service.exportToXml(decision);
      expect(xml).toContain('null');
    });
  });

  describe('encoding options', () => {
    it('should use UTF-8 encoding by default', () => {
      const decision = createMockDecision();
      const xml = service.exportToXml(decision);

      expect(xml).toContain('encoding="UTF-8"');
    });

    it('should use specified encoding', () => {
      const decision = createMockDecision();
      const xml = service.exportToXml(decision, { encoding: 'ISO-8859-1' });

      expect(xml).toContain('encoding="ISO-8859-1"');
    });
  });
});

/**
 * 创建模拟决策实体
 */
function createMockDecision(overrides: Partial<DmnDecisionEntity> = {}): DmnDecisionEntity {
  const decision = new DmnDecisionEntity();
  decision.id = 'test-id';
  decision.decisionKey = overrides.decisionKey || 'test_decision';
  decision.name = overrides.name || 'Test Decision';
  decision.description = overrides.description;
  decision.category = overrides.category;
  decision.hitPolicy = overrides.hitPolicy || HitPolicy.FIRST;
  decision.aggregation = overrides.aggregation;
  decision.version = 1;
  decision.status = DmnDecisionStatus.PUBLISHED;
  decision.inputs = overrides.inputs || [
    { id: 'input_1', label: 'Input 1', expression: 'input1', type: 'string' },
  ];
  decision.outputs = overrides.outputs || [
    { id: 'output_1', label: 'Output 1', name: 'output1', type: 'string' },
  ];
  decision.rules = overrides.rules || [
    {
      id: 'rule_1',
      conditions: [{ inputId: 'input_1', operator: '==', value: 'test' }],
      outputs: [{ outputId: 'output_1', value: 'result' }],
    },
  ];
  decision.tenantId = overrides.tenantId;
  decision.createTime = new Date();
  decision.extra = overrides.extra;

  return decision;
}
