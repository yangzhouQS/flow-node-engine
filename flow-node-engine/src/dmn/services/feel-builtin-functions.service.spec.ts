import { Test, TestingModule } from '@nestjs/testing';
import { FeelBuiltinFunctionsService } from './feel-builtin-functions.service';

describe('FeelBuiltinFunctionsService', () => {
  let service: FeelBuiltinFunctionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeelBuiltinFunctionsService],
    }).compile();

    service = module.get<FeelBuiltinFunctionsService>(FeelBuiltinFunctionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('数值函数', () => {
    it('abs - 应该返回绝对值', () => {
      const func = service.getFunction('abs');
      expect(func).toBeDefined();
      expect(func!.implementation(-5)).toBe(5);
      expect(func!.implementation(5)).toBe(5);
    });

    it('ceiling - 应该向上取整', () => {
      const func = service.getFunction('ceiling');
      expect(func).toBeDefined();
      expect(func!.implementation(4.3)).toBe(5);
      expect(func!.implementation(-4.3)).toBe(-4);
    });

    it('floor - 应该向下取整', () => {
      const func = service.getFunction('floor');
      expect(func).toBeDefined();
      expect(func!.implementation(4.7)).toBe(4);
      expect(func!.implementation(-4.7)).toBe(-5);
    });

    it('modulo - 应该返回模', () => {
      const func = service.getFunction('modulo');
      expect(func).toBeDefined();
      expect(func!.implementation(10, 3)).toBe(1);
      expect(func!.implementation(-10, 3)).toBe(2);
    });

    it('power - 应该返回幂', () => {
      const func = service.getFunction('power');
      expect(func).toBeDefined();
      expect(func!.implementation(2, 3)).toBe(8);
      expect(func!.implementation(4, 0.5)).toBe(2);
    });

    it('round - 应该四舍五入', () => {
      const func = service.getFunction('round');
      expect(func).toBeDefined();
      expect(func!.implementation(4.5)).toBe(5);
      expect(func!.implementation(4.4)).toBe(4);
      expect(func!.implementation(4.567, 2)).toBe(4.57);
    });

    it('sqrt - 应该返回平方根', () => {
      const func = service.getFunction('sqrt');
      expect(func).toBeDefined();
      expect(func!.implementation(16)).toBe(4);
      expect(func!.implementation(2)).toBeCloseTo(1.414, 2);
    });

    it('number - 应该转换字符串为数字', () => {
      const func = service.getFunction('number');
      expect(func).toBeDefined();
      expect(func!.implementation('42')).toBe(42);
      expect(func!.implementation('3.14')).toBe(3.14);
    });
  });

  describe('字符串函数', () => {
    it('substring - 应该返回子字符串', () => {
      const func = service.getFunction('substring');
      expect(func).toBeDefined();
      expect(func!.implementation('hello', 2)).toBe('ello');
      expect(func!.implementation('hello', 2, 3)).toBe('ell');
    });

    it('string length - 应该返回字符串长度', () => {
      const func = service.getFunction('string length');
      expect(func).toBeDefined();
      expect(func!.implementation('hello')).toBe(5);
    });

    it('upper case - 应该返回大写', () => {
      const func = service.getFunction('upper case');
      expect(func).toBeDefined();
      expect(func!.implementation('hello')).toBe('HELLO');
    });

    it('lower case - 应该返回小写', () => {
      const func = service.getFunction('lower case');
      expect(func).toBeDefined();
      expect(func!.implementation('HELLO')).toBe('hello');
    });

    it('contains - 应该检查包含', () => {
      const func = service.getFunction('contains');
      expect(func).toBeDefined();
      expect(func!.implementation('hello world', 'world')).toBe(true);
      expect(func!.implementation('hello world', 'foo')).toBe(false);
    });

    it('starts with - 应该检查前缀', () => {
      const func = service.getFunction('starts with');
      expect(func).toBeDefined();
      expect(func!.implementation('hello', 'hel')).toBe(true);
      expect(func!.implementation('hello', 'wor')).toBe(false);
    });

    it('ends with - 应该检查后缀', () => {
      const func = service.getFunction('ends with');
      expect(func).toBeDefined();
      expect(func!.implementation('hello', 'llo')).toBe(true);
      expect(func!.implementation('hello', 'hel')).toBe(false);
    });

    it('split - 应该分割字符串', () => {
      const func = service.getFunction('split');
      expect(func).toBeDefined();
      expect(func!.implementation('a,b,c', ',')).toEqual(['a', 'b', 'c']);
    });
  });

  describe('列表函数', () => {
    it('list contains - 应该检查列表包含', () => {
      const func = service.getFunction('list contains');
      expect(func).toBeDefined();
      expect(func!.implementation([1, 2, 3], 2)).toBe(true);
      expect(func!.implementation([1, 2, 3], 4)).toBe(false);
    });

    it('count - 应该返回元素数量', () => {
      const func = service.getFunction('count');
      expect(func).toBeDefined();
      expect(func!.implementation([1, 2, 3])).toBe(3);
      expect(func!.implementation([])).toBe(0);
    });

    it('min - 应该返回最小值', () => {
      const func = service.getFunction('min');
      expect(func).toBeDefined();
      expect(func!.implementation([3, 1, 2])).toBe(1);
    });

    it('max - 应该返回最大值', () => {
      const func = service.getFunction('max');
      expect(func).toBeDefined();
      expect(func!.implementation([3, 1, 2])).toBe(3);
    });

    it('sum - 应该返回和', () => {
      const func = service.getFunction('sum');
      expect(func).toBeDefined();
      expect(func!.implementation([1, 2, 3, 4])).toBe(10);
    });

    it('mean - 应该返回平均值', () => {
      const func = service.getFunction('mean');
      expect(func).toBeDefined();
      expect(func!.implementation([1, 2, 3, 4])).toBe(2.5);
    });

    it('median - 应该返回中位数', () => {
      const func = service.getFunction('median');
      expect(func).toBeDefined();
      expect(func!.implementation([1, 3, 5])).toBe(3);
      expect(func!.implementation([1, 2, 3, 4])).toBe(2.5);
    });

    it('and - 应该返回逻辑与', () => {
      const func = service.getFunction('and');
      expect(func).toBeDefined();
      expect(func!.implementation([true, true, true])).toBe(true);
      expect(func!.implementation([true, false, true])).toBe(false);
    });

    it('or - 应该返回逻辑或', () => {
      const func = service.getFunction('or');
      expect(func).toBeDefined();
      expect(func!.implementation([false, false, true])).toBe(true);
      expect(func!.implementation([false, false, false])).toBe(false);
    });

    it('reverse - 应该反转列表', () => {
      const func = service.getFunction('reverse');
      expect(func).toBeDefined();
      expect(func!.implementation([1, 2, 3])).toEqual([3, 2, 1]);
    });

    it('distinct values - 应该去重', () => {
      const func = service.getFunction('distinct values');
      expect(func).toBeDefined();
      expect(func!.implementation([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
    });

    it('flatten - 应该扁平化', () => {
      const func = service.getFunction('flatten');
      expect(func).toBeDefined();
      expect(func!.implementation([[1, 2], [3, 4]])).toEqual([1, 2, 3, 4]);
    });

    it('join - 应该连接列表', () => {
      const func = service.getFunction('join');
      expect(func).toBeDefined();
      expect(func!.implementation(['a', 'b', 'c'], '-')).toBe('a-b-c');
    });
  });

  describe('日期时间函数', () => {
    it('now - 应该返回当前时间', () => {
      const func = service.getFunction('now');
      expect(func).toBeDefined();
      const result = func!.implementation();
      expect(result instanceof Date).toBe(true);
    });

    it('today - 应该返回当前日期', () => {
      const func = service.getFunction('today');
      expect(func).toBeDefined();
      const result = func!.implementation();
      expect(result instanceof Date).toBe(true);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it('date - 应该创建日期', () => {
      const func = service.getFunction('date');
      expect(func).toBeDefined();
      const result = func!.implementation(2024, 6, 15);
      expect(result instanceof Date).toBe(true);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(5); // 月份从0开始
      expect(result.getDate()).toBe(15);
    });
  });

  describe('转换函数', () => {
    it('string - 应该转换为字符串', () => {
      const func = service.getFunction('string');
      expect(func).toBeDefined();
      expect(func!.implementation(42)).toBe('42');
      expect(func!.implementation(true)).toBe('true');
      expect(func!.implementation(null)).toBe('null');
    });

    it('boolean - 应该转换为布尔值', () => {
      const func = service.getFunction('boolean');
      expect(func).toBeDefined();
      expect(func!.implementation(1)).toBe(true);
      expect(func!.implementation(0)).toBe(false);
      expect(func!.implementation('true')).toBe(true);
      expect(func!.implementation('false')).toBe(false);
    });
  });

  describe('上下文函数', () => {
    it('get entries - 应该获取所有条目', () => {
      const func = service.getFunction('get entries');
      expect(func).toBeDefined();
      const result = func!.implementation({ a: 1, b: 2 });
      expect(result).toContainEqual({ key: 'a', value: 1 });
      expect(result).toContainEqual({ key: 'b', value: 2 });
    });

    it('get value - 应该获取值', () => {
      const func = service.getFunction('get value');
      expect(func).toBeDefined();
      expect(func!.implementation({ a: 1, b: 2 }, 'a')).toBe(1);
      expect(func!.implementation({ a: 1, b: 2 }, 'b')).toBe(2);
    });

    it('context put - 应该设置值', () => {
      const func = service.getFunction('context put');
      expect(func).toBeDefined();
      const result = func!.implementation({ a: 1 }, 'b', 2);
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('context merge - 应该合并上下文', () => {
      const func = service.getFunction('context merge');
      expect(func).toBeDefined();
      const result = func!.implementation([{ a: 1 }, { b: 2 }]);
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe('hasFunction', () => {
    it('应该正确检查函数是否存在', () => {
      expect(service.hasFunction('abs')).toBe(true);
      expect(service.hasFunction('sum')).toBe(true);
      expect(service.hasFunction('nonexistent')).toBe(false);
    });

    it('应该支持带空格的函数名', () => {
      expect(service.hasFunction('string length')).toBe(true);
      expect(service.hasFunction('list contains')).toBe(true);
    });
  });

  describe('getAllFunctions', () => {
    it('应该返回所有函数', () => {
      const functions = service.getAllFunctions();
      expect(functions.length).toBeGreaterThan(50);
    });
  });
});
