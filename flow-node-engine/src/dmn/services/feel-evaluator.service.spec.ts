import { Test, TestingModule } from '@nestjs/testing';
import { FeelEvaluatorService } from './feel-evaluator.service';
import { FeelBuiltinFunctionsService } from './feel-builtin-functions.service';
import {
  FeelExpressionType,
  FeelEvaluationContext,
} from '../interfaces/feel-expression.interface';

describe('FeelEvaluatorService', () => {
  let service: FeelEvaluatorService;
  let builtinFunctions: FeelBuiltinFunctionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeelEvaluatorService, FeelBuiltinFunctionsService],
    }).compile();

    service = module.get<FeelEvaluatorService>(FeelEvaluatorService);
    builtinFunctions = module.get<FeelBuiltinFunctionsService>(FeelBuiltinFunctionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluateString', () => {
    const context: Record<string, any> = {
      age: 25,
      name: 'John',
      score: 85.5,
      active: true,
      tags: ['a', 'b', 'c'],
      user: {
        name: 'Alice',
        age: 30,
      },
    };

    it('应该正确求值数字字面量', () => {
      const result = service.evaluateString('42', context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });

    it('应该正确求值字符串字面量', () => {
      const result = service.evaluateString('"hello"', context);
      expect(result.success).toBe(true);
      expect(result.value).toBe('hello');
    });

    it('应该正确求值布尔字面量', () => {
      const result1 = service.evaluateString('true', context);
      expect(result1.success).toBe(true);
      expect(result1.value).toBe(true);

      const result2 = service.evaluateString('false', context);
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(false);
    });

    it('应该正确求值null字面量', () => {
      const result = service.evaluateString('null', context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(null);
    });

    it('应该正确求值变量引用', () => {
      const result = service.evaluateString('age', context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(25);
    });

    it('应该正确求值属性访问', () => {
      const result = service.evaluateString('user.name', context);
      expect(result.success).toBe(true);
      expect(result.value).toBe('Alice');
    });

    it('应该正确求值相等比较', () => {
      const result1 = service.evaluateString('age = 25', context);
      expect(result1.success).toBe(true);
      expect(result1.value).toBe(true);

      const result2 = service.evaluateString('age = 30', context);
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(false);
    });

    it('应该正确求值不等比较', () => {
      const result1 = service.evaluateString('age != 30', context);
      expect(result1.success).toBe(true);
      expect(result1.value).toBe(true);

      const result2 = service.evaluateString('age != 25', context);
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(false);
    });

    it('应该正确求值小于比较', () => {
      const result1 = service.evaluateString('age < 30', context);
      expect(result1.success).toBe(true);
      expect(result1.value).toBe(true);

      const result2 = service.evaluateString('age < 20', context);
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(false);
    });

    it('应该正确求值小于等于比较', () => {
      const result1 = service.evaluateString('age <= 25', context);
      expect(result1.success).toBe(true);
      expect(result1.value).toBe(true);

      const result2 = service.evaluateString('age <= 20', context);
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(false);
    });

    it('应该正确求值大于比较', () => {
      const result1 = service.evaluateString('age > 20', context);
      expect(result1.success).toBe(true);
      expect(result1.value).toBe(true);

      const result2 = service.evaluateString('age > 30', context);
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(false);
    });

    it('应该正确求值大于等于比较', () => {
      const result1 = service.evaluateString('age >= 25', context);
      expect(result1.success).toBe(true);
      expect(result1.value).toBe(true);

      const result2 = service.evaluateString('age >= 30', context);
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(false);
    });

    it('应该正确求值and逻辑运算', () => {
      const result1 = service.evaluateString('age > 20 and active = true', context);
      expect(result1.success).toBe(true);
      expect(result1.value).toBe(true);

      const result2 = service.evaluateString('age > 30 and active = true', context);
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(false);
    });

    it('应该正确求值or逻辑运算', () => {
      const result1 = service.evaluateString('age > 30 or active = true', context);
      expect(result1.success).toBe(true);
      expect(result1.value).toBe(true);

      const result2 = service.evaluateString('age > 30 or active = false', context);
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(false);
    });

    it('应该正确求值between表达式', () => {
      const result1 = service.evaluateString('age between 20 and 30', context);
      expect(result1.success).toBe(true);
      expect(result1.value).toBe(true);

      const result2 = service.evaluateString('age between 30 and 40', context);
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(false);
    });

    it('应该正确求值in表达式', () => {
      const result1 = service.evaluateString('age in [20, 25, 30]', context);
      expect(result1.success).toBe(true);
      expect(result1.value).toBe(true);

      const result2 = service.evaluateString('age in [10, 15, 20]', context);
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(false);
    });

    it('应该正确求值算术加法', () => {
      const result = service.evaluateString('age + 5', context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(30);
    });

    it('应该正确求值算术减法', () => {
      const result = service.evaluateString('age - 5', context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(20);
    });

    it('应该正确求值算术乘法', () => {
      const result = service.evaluateString('age * 2', context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(50);
    });

    it('应该正确求值算术除法', () => {
      const result = service.evaluateString('score / 2', context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(42.75);
    });

    it('应该在除以零时返回错误', () => {
      const result = service.evaluateString('age / 0', context);
      expect(result.success).toBe(false);
      expect(result.errorType).toBe('DIVISION_BY_ZERO');
    });

    it('应该在变量未找到时返回错误', () => {
      const result = service.evaluateString('unknown', context);
      expect(result.success).toBe(false);
      expect(result.errorType).toBe('RUNTIME_ERROR');
    });
  });

  describe('evaluate with AST', () => {
    const evalContext: FeelEvaluationContext = {
      variables: { x: 10, y: 20 },
      functions: {},
    };

    it('应该正确求值字面量表达式', () => {
      const expr = {
        type: FeelExpressionType.NUMBER,
        value: 42,
      };
      const result = service.evaluate(expr, evalContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });

    it('应该正确求值变量表达式', () => {
      const expr = {
        type: FeelExpressionType.VARIABLE,
        name: 'x',
      };
      const result = service.evaluate(expr, evalContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(10);
    });

    it('应该正确求值二元加法表达式', () => {
      const expr = {
        type: FeelExpressionType.ADDITION,
        left: { type: FeelExpressionType.VARIABLE, name: 'x' },
        right: { type: FeelExpressionType.VARIABLE, name: 'y' },
      };
      const result = service.evaluate(expr, evalContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(30);
    });

    it('应该正确求值二元比较表达式', () => {
      const expr = {
        type: FeelExpressionType.LESS_THAN,
        left: { type: FeelExpressionType.VARIABLE, name: 'x' },
        right: { type: FeelExpressionType.VARIABLE, name: 'y' },
      };
      const result = service.evaluate(expr, evalContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('应该正确求值逻辑and表达式', () => {
      const expr = {
        type: FeelExpressionType.AND,
        left: {
          type: FeelExpressionType.LESS_THAN,
          left: { type: FeelExpressionType.VARIABLE, name: 'x' },
          right: { type: FeelExpressionType.NUMBER, value: 15 },
        },
        right: {
          type: FeelExpressionType.GREATER_THAN,
          left: { type: FeelExpressionType.VARIABLE, name: 'y' },
          right: { type: FeelExpressionType.NUMBER, value: 15 },
        },
      };
      const result = service.evaluate(expr, evalContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('应该正确求值列表表达式', () => {
      const expr = {
        type: FeelExpressionType.LIST,
        elements: [
          { type: FeelExpressionType.NUMBER, value: 1 },
          { type: FeelExpressionType.NUMBER, value: 2 },
          { type: FeelExpressionType.NUMBER, value: 3 },
        ],
      };
      const result = service.evaluate(expr, evalContext);
      expect(result.success).toBe(true);
      expect(result.value).toEqual([1, 2, 3]);
    });

    it('应该正确求值if表达式', () => {
      const expr = {
        type: FeelExpressionType.IF,
        condition: {
          type: FeelExpressionType.GREATER_THAN,
          left: { type: FeelExpressionType.VARIABLE, name: 'x' },
          right: { type: FeelExpressionType.NUMBER, value: 5 },
        },
        thenExpression: { type: FeelExpressionType.STRING, value: 'big' },
        elseExpression: { type: FeelExpressionType.STRING, value: 'small' },
      };
      const result = service.evaluate(expr, evalContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe('big');
    });

    it('应该正确求值between表达式', () => {
      const expr = {
        type: FeelExpressionType.BETWEEN,
        value: { type: FeelExpressionType.VARIABLE, name: 'x' },
        low: { type: FeelExpressionType.NUMBER, value: 5 },
        high: { type: FeelExpressionType.NUMBER, value: 15 },
      };
      const result = service.evaluate(expr, evalContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('应该正确求值一元负号表达式', () => {
      const expr = {
        type: FeelExpressionType.NEGATION,
        operand: { type: FeelExpressionType.VARIABLE, name: 'x' },
      };
      const result = service.evaluate(expr, evalContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(-10);
    });

    it('应该正确求值一元not表达式', () => {
      const expr = {
        type: FeelExpressionType.NOT,
        operand: { type: FeelExpressionType.BOOLEAN, value: true },
      };
      const result = service.evaluate(expr, evalContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });
  });
});
