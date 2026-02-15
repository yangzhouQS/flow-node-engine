import { Injectable, Logger } from '@nestjs/common';
import { FeelFunction, FEEL_BUILTIN_FUNCTIONS } from '../interfaces/feel-expression.interface';

/**
 * FEEL内置函数服务
 * 实现DMN 1.3 FEEL标准内置函数
 */
@Injectable()
export class FeelBuiltinFunctionsService {
  private readonly logger = new Logger(FeelBuiltinFunctionsService.name);
  private readonly functions: Map<string, FeelFunction> = new Map();

  constructor() {
    this.registerBuiltinFunctions();
  }

  /**
   * 获取函数
   */
  getFunction(name: string): FeelFunction | undefined {
    // 支持标准名称和带空格的名称
    const normalizedName = this.normalizeFunctionName(name);
    return this.functions.get(normalizedName);
  }

  /**
   * 获取所有函数
   */
  getAllFunctions(): FeelFunction[] {
    return Array.from(this.functions.values());
  }

  /**
   * 检查函数是否存在
   */
  hasFunction(name: string): boolean {
    const normalizedName = this.normalizeFunctionName(name);
    return this.functions.has(normalizedName);
  }

  /**
   * 注册内置函数
   */
  private registerBuiltinFunctions(): void {
    // ==================== 数值函数 ====================
    this.registerNumberFunctions();

    // ==================== 字符串函数 ====================
    this.registerStringFunctions();

    // ==================== 列表函数 ====================
    this.registerListFunctions();

    // ==================== 日期时间函数 ====================
    this.registerDateTimeFunctions();

    // ==================== 转换函数 ====================
    this.registerConversionFunctions();

    // ==================== 上下文函数 ====================
    this.registerContextFunctions();

    // ==================== 范围函数 ====================
    this.registerRangeFunctions();

    this.logger.log(`已注册 ${this.functions.size} 个FEEL内置函数`);
  }

  /**
   * 注册数值函数
   */
  private registerNumberFunctions(): void {
    // abs - 绝对值
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.ABS,
      parameters: [{ name: 'n', type: 'number' }],
      returnType: 'number',
      implementation: (n: number) => Math.abs(n),
      description: '返回数字的绝对值',
    });

    // ceiling - 向上取整
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.CEILING,
      parameters: [{ name: 'n', type: 'number' }],
      returnType: 'number',
      implementation: (n: number) => Math.ceil(n),
      description: '返回大于或等于n的最小整数',
    });

    // floor - 向下取整
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.FLOOR,
      parameters: [{ name: 'n', type: 'number' }],
      returnType: 'number',
      implementation: (n: number) => Math.floor(n),
      description: '返回小于或等于n的最大整数',
    });

    // integer - 取整
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.INTEGER,
      parameters: [{ name: 'n', type: 'number' }],
      returnType: 'number',
      implementation: (n: number) => Math.trunc(n),
      description: '返回n的整数部分',
    });

    // modulo - 取模
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.MODULO,
      parameters: [{ name: 'dividend', type: 'number' }, { name: 'divisor', type: 'number' }],
      returnType: 'number',
      implementation: (dividend: number, divisor: number) => {
        if (divisor === 0) throw new Error('除数不能为零');
        return ((dividend % divisor) + divisor) % divisor;
      },
      description: '返回dividend除以divisor的模',
    });

    // power - 幂运算
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.POWER,
      parameters: [{ name: 'base', type: 'number' }, { name: 'exponent', type: 'number' }],
      returnType: 'number',
      implementation: (base: number, exponent: number) => Math.pow(base, exponent),
      description: '返回base的exponent次幂',
    });

    // round - 四舍五入
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.ROUND,
      parameters: [{ name: 'n', type: 'number' }, { name: 'scale', type: 'number', optional: true }],
      returnType: 'number',
      implementation: (n: number, scale?: number) => {
        if (scale === undefined) return Math.round(n);
        const factor = Math.pow(10, scale);
        return Math.round(n * factor) / factor;
      },
      description: '返回n四舍五入到scale位小数',
    });

    // sqrt - 平方根
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.SQRT,
      parameters: [{ name: 'n', type: 'number' }],
      returnType: 'number',
      implementation: (n: number) => {
        if (n < 0) throw new Error('不能对负数求平方根');
        return Math.sqrt(n);
      },
      description: '返回n的平方根',
    });

    // number - 转换为数字
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.NUMBER,
      parameters: [{ name: 'from', type: 'string' }],
      returnType: 'number',
      implementation: (from: string) => {
        const num = parseFloat(from);
        if (isNaN(num)) throw new Error(`无法将 "${from}" 转换为数字`);
        return num;
      },
      description: '将字符串转换为数字',
    });

    // decimal - 小数格式化
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.DECIMAL,
      parameters: [{ name: 'n', type: 'number' }, { name: 'scale', type: 'number' }],
      returnType: 'number',
      implementation: (n: number, scale: number) => {
        const factor = Math.pow(10, scale);
        return Math.round(n * factor) / factor;
      },
      description: '返回n保留scale位小数',
    });
  }

  /**
   * 注册字符串函数
   */
  private registerStringFunctions(): void {
    // substring - 子字符串
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.SUBSTRING,
      parameters: [
        { name: 'string', type: 'string' },
        { name: 'start', type: 'number' },
        { name: 'length', type: 'number', optional: true },
      ],
      returnType: 'string',
      implementation: (string: string, start: number, length?: number) => {
        // FEEL索引从1开始
        const startIndex = start - 1;
        if (length !== undefined) {
          return string.substring(startIndex, startIndex + length);
        }
        return string.substring(startIndex);
      },
      description: '返回字符串的子串',
    });

    // string length - 字符串长度
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.STRING_LENGTH,
      parameters: [{ name: 'string', type: 'string' }],
      returnType: 'number',
      implementation: (string: string) => string.length,
      description: '返回字符串的长度',
    });

    // upper case - 大写
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.UPPER_CASE,
      parameters: [{ name: 'string', type: 'string' }],
      returnType: 'string',
      implementation: (string: string) => string.toUpperCase(),
      description: '返回字符串的大写形式',
    });

    // lower case - 小写
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.LOWER_CASE,
      parameters: [{ name: 'string', type: 'string' }],
      returnType: 'string',
      implementation: (string: string) => string.toLowerCase(),
      description: '返回字符串的小写形式',
    });

    // substring before - 子串之前
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.SUBSTRING_BEFORE,
      parameters: [{ name: 'string', type: 'string' }, { name: 'match', type: 'string' }],
      returnType: 'string',
      implementation: (string: string, match: string) => {
        const index = string.indexOf(match);
        return index === -1 ? '' : string.substring(0, index);
      },
      description: '返回match之前的子串',
    });

    // substring after - 子串之后
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.SUBSTRING_AFTER,
      parameters: [{ name: 'string', type: 'string' }, { name: 'match', type: 'string' }],
      returnType: 'string',
      implementation: (string: string, match: string) => {
        const index = string.indexOf(match);
        return index === -1 ? '' : string.substring(index + match.length);
      },
      description: '返回match之后的子串',
    });

    // replace - 替换
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.REPLACE,
      parameters: [
        { name: 'input', type: 'string' },
        { name: 'pattern', type: 'string' },
        { name: 'replacement', type: 'string' },
        { name: 'flags', type: 'string', optional: true },
      ],
      returnType: 'string',
      implementation: (input: string, pattern: string, replacement: string, flags?: string) => {
        const regex = new RegExp(pattern, flags || 'g');
        return input.replace(regex, replacement);
      },
      description: '使用正则表达式替换字符串',
    });

    // contains - 包含
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.CONTAINS,
      parameters: [{ name: 'string', type: 'string' }, { name: 'match', type: 'string' }],
      returnType: 'boolean',
      implementation: (string: string, match: string) => string.includes(match),
      description: '检查字符串是否包含match',
    });

    // starts with - 以...开始
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.STARTS_WITH,
      parameters: [{ name: 'string', type: 'string' }, { name: 'match', type: 'string' }],
      returnType: 'boolean',
      implementation: (string: string, match: string) => string.startsWith(match),
      description: '检查字符串是否以match开始',
    });

    // ends with - 以...结束
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.ENDS_WITH,
      parameters: [{ name: 'string', type: 'string' }, { name: 'match', type: 'string' }],
      returnType: 'boolean',
      implementation: (string: string, match: string) => string.endsWith(match),
      description: '检查字符串是否以match结束',
    });

    // matches - 正则匹配
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.MATCHES,
      parameters: [
        { name: 'input', type: 'string' },
        { name: 'pattern', type: 'string' },
        { name: 'flags', type: 'string', optional: true },
      ],
      returnType: 'boolean',
      implementation: (input: string, pattern: string, flags?: string) => {
        const regex = new RegExp(pattern, flags);
        return regex.test(input);
      },
      description: '检查字符串是否匹配正则表达式',
    });

    // split - 分割
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.SPLIT,
      parameters: [{ name: 'string', type: 'string' }, { name: 'delimiter', type: 'string' }],
      returnType: 'list',
      implementation: (string: string, delimiter: string) => string.split(delimiter),
      description: '使用分隔符分割字符串',
    });

    // concat - 连接
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.CONCAT,
      parameters: [{ name: 'strings', type: 'list' }],
      returnType: 'string',
      implementation: (strings: string[]) => strings.join(''),
      description: '连接字符串列表',
    });
  }

  /**
   * 注册列表函数
   */
  private registerListFunctions(): void {
    // list contains - 列表包含
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.LIST_CONTAINS,
      parameters: [{ name: 'list', type: 'list' }, { name: 'element', type: 'any' }],
      returnType: 'boolean',
      implementation: (list: any[], element: any) => list.includes(element),
      description: '检查列表是否包含元素',
    });

    // count - 计数
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.COUNT,
      parameters: [{ name: 'list', type: 'list' }],
      returnType: 'number',
      implementation: (list: any[]) => list.length,
      description: '返回列表的元素数量',
    });

    // min - 最小值
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.MIN,
      parameters: [{ name: 'list', type: 'list' }],
      returnType: 'number',
      implementation: (list: number[]) => {
        if (list.length === 0) return null;
        return Math.min(...list);
      },
      description: '返回列表中的最小值',
    });

    // max - 最大值
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.MAX,
      parameters: [{ name: 'list', type: 'list' }],
      returnType: 'number',
      implementation: (list: number[]) => {
        if (list.length === 0) return null;
        return Math.max(...list);
      },
      description: '返回列表中的最大值',
    });

    // sum - 求和
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.SUM,
      parameters: [{ name: 'list', type: 'list' }],
      returnType: 'number',
      implementation: (list: number[]) => {
        if (list.length === 0) return null;
        return list.reduce((sum, n) => sum + (n || 0), 0);
      },
      description: '返回列表中所有元素的和',
    });

    // product - 乘积
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.PRODUCT,
      parameters: [{ name: 'list', type: 'list' }],
      returnType: 'number',
      implementation: (list: number[]) => {
        if (list.length === 0) return null;
        return list.reduce((prod, n) => prod * (n || 1), 1);
      },
      description: '返回列表中所有元素的乘积',
    });

    // mean - 平均值
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.MEAN,
      parameters: [{ name: 'list', type: 'list' }],
      returnType: 'number',
      implementation: (list: number[]) => {
        if (list.length === 0) return null;
        return list.reduce((sum, n) => sum + (n || 0), 0) / list.length;
      },
      description: '返回列表中所有元素的平均值',
    });

    // median - 中位数
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.MEDIAN,
      parameters: [{ name: 'list', type: 'list' }],
      returnType: 'number',
      implementation: (list: number[]) => {
        if (list.length === 0) return null;
        const sorted = [...list].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      },
      description: '返回列表中所有元素的中位数',
    });

    // stddev - 标准差
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.STDDEV,
      parameters: [{ name: 'list', type: 'list' }],
      returnType: 'number',
      implementation: (list: number[]) => {
        if (list.length === 0) return null;
        const mean = list.reduce((sum, n) => sum + (n || 0), 0) / list.length;
        const squareDiffs = list.map((n) => Math.pow((n || 0) - mean, 2));
        const avgSquareDiff = squareDiffs.reduce((sum, n) => sum + n, 0) / list.length;
        return Math.sqrt(avgSquareDiff);
      },
      description: '返回列表中所有元素的标准差',
    });

    // mode - 众数
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.MODE,
      parameters: [{ name: 'list', type: 'list' }],
      returnType: 'list',
      implementation: (list: any[]) => {
        if (list.length === 0) return [];
        const counts = new Map<any, number>();
        list.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
        const maxCount = Math.max(...counts.values());
        return [...counts.entries()]
          .filter(([, count]) => count === maxCount)
          .map(([item]) => item);
      },
      description: '返回列表中出现次数最多的元素',
    });

    // and - 逻辑与
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.AND,
      parameters: [{ name: 'list', type: 'list' }],
      returnType: 'boolean',
      implementation: (list: boolean[]) => list.every((b) => b === true),
      description: '如果列表中所有元素都为true则返回true',
    });

    // or - 逻辑或
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.OR,
      parameters: [{ name: 'list', type: 'list' }],
      returnType: 'boolean',
      implementation: (list: boolean[]) => list.some((b) => b === true),
      description: '如果列表中有任何元素为true则返回true',
    });

    // sublist - 子列表
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.SUBLIST,
      parameters: [
        { name: 'list', type: 'list' },
        { name: 'start', type: 'number' },
        { name: 'length', type: 'number', optional: true },
      ],
      returnType: 'list',
      implementation: (list: any[], start: number, length?: number) => {
        // FEEL索引从1开始
        const startIndex = start - 1;
        if (length !== undefined) {
          return list.slice(startIndex, startIndex + length);
        }
        return list.slice(startIndex);
      },
      description: '返回列表的子列表',
    });

    // append - 追加
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.APPEND,
      parameters: [{ name: 'list', type: 'list' }, { name: 'items', type: 'any' }],
      returnType: 'list',
      implementation: (list: any[], ...items: any[]) => [...list, ...items],
      description: '返回追加了元素的新列表',
    });

    // concatenate - 连接列表
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.CONCATENATE,
      parameters: [{ name: 'lists', type: 'list' }],
      returnType: 'list',
      implementation: (...lists: any[][]) => lists.flat(),
      description: '连接多个列表',
    });

    // insert before - 在之前插入
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.INSERT_BEFORE,
      parameters: [{ name: 'list', type: 'list' }, { name: 'position', type: 'number' }, { name: 'newItem', type: 'any' }],
      returnType: 'list',
      implementation: (list: any[], position: number, newItem: any) => {
        // FEEL索引从1开始
        const index = position - 1;
        return [...list.slice(0, index), newItem, ...list.slice(index)];
      },
      description: '在指定位置插入元素',
    });

    // remove - 移除
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.REMOVE,
      parameters: [{ name: 'list', type: 'list' }, { name: 'position', type: 'number' }],
      returnType: 'list',
      implementation: (list: any[], position: number) => {
        // FEEL索引从1开始
        const index = position - 1;
        return [...list.slice(0, index), ...list.slice(index + 1)];
      },
      description: '移除指定位置的元素',
    });

    // reverse - 反转
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.REVERSE,
      parameters: [{ name: 'list', type: 'list' }],
      returnType: 'list',
      implementation: (list: any[]) => [...list].reverse(),
      description: '反转列表',
    });

    // index of - 索引
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.INDEX_OF,
      parameters: [{ name: 'list', type: 'list' }, { name: 'match', type: 'any' }],
      returnType: 'list',
      implementation: (list: any[], match: any) => {
        const indices: number[] = [];
        list.forEach((item, index) => {
          if (item === match) {
            // FEEL索引从1开始
            indices.push(index + 1);
          }
        });
        return indices;
      },
      description: '返回匹配元素的索引列表',
    });

    // union - 并集
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.UNION,
      parameters: [{ name: 'lists', type: 'list' }],
      returnType: 'list',
      implementation: (...lists: any[][]) => [...new Set(lists.flat())],
      description: '返回多个列表的并集',
    });

    // distinct values - 去重
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.DISTINCT_VALUES,
      parameters: [{ name: 'list', type: 'list' }],
      returnType: 'list',
      implementation: (list: any[]) => [...new Set(list)],
      description: '返回去重后的列表',
    });

    // flatten - 扁平化
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.FLATTEN,
      parameters: [{ name: 'list', type: 'list' }],
      returnType: 'list',
      implementation: (list: any[]) => list.flat(Infinity),
      description: '返回扁平化后的列表',
    });

    // sort - 排序
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.SORT,
      parameters: [{ name: 'list', type: 'list' }, { name: 'precedenceFunction', type: 'function', optional: true }],
      returnType: 'list',
      implementation: (list: any[], precedenceFunction?: (a: any, b: any) => number) => {
        if (precedenceFunction) {
          return [...list].sort(precedenceFunction);
        }
        return [...list].sort((a, b) => {
          if (typeof a === 'number' && typeof b === 'number') return a - b;
          if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
          return 0;
        });
      },
      description: '返回排序后的列表',
    });

    // join - 连接
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.JOIN,
      parameters: [{ name: 'list', type: 'list' }, { name: 'delimiter', type: 'string' }],
      returnType: 'string',
      implementation: (list: string[], delimiter: string) => list.join(delimiter),
      description: '使用分隔符连接列表元素',
    });
  }

  /**
   * 注册日期时间函数
   */
  private registerDateTimeFunctions(): void {
    // now - 当前时间
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.NOW,
      parameters: [],
      returnType: 'date-time',
      implementation: () => new Date(),
      description: '返回当前日期时间',
    });

    // today - 当前日期
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.TODAY,
      parameters: [],
      returnType: 'date',
      implementation: () => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      },
      description: '返回当前日期',
    });

    // date - 创建日期
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.DATE,
      parameters: [{ name: 'year', type: 'number' }, { name: 'month', type: 'number' }, { name: 'day', type: 'number' }],
      returnType: 'date',
      implementation: (year: number, month: number, day: number) => new Date(year, month - 1, day),
      description: '创建日期',
    });

    // time - 创建时间
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.TIME,
      parameters: [
        { name: 'hour', type: 'number' },
        { name: 'minute', type: 'number' },
        { name: 'second', type: 'number' },
        { name: 'offset', type: 'any', optional: true },
      ],
      returnType: 'time',
      implementation: (hour: number, minute: number, second: number) => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, second);
      },
      description: '创建时间',
    });

    // date and time - 创建日期时间
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.DATE_TIME,
      parameters: [{ name: 'date', type: 'any' }, { name: 'time', type: 'any', optional: true }],
      returnType: 'date-time',
      implementation: (date: any, time?: any) => {
        if (typeof date === 'string') {
          return new Date(date);
        }
        if (date instanceof Date && time instanceof Date) {
          return new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            time.getHours(),
            time.getMinutes(),
            time.getSeconds()
          );
        }
        return date;
      },
      description: '创建日期时间',
    });

    // duration - 创建持续时间
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.DURATION,
      parameters: [{ name: 'duration', type: 'string' }],
      returnType: 'duration',
      implementation: (duration: string) => {
        // 解析ISO 8601持续时间格式
        const match = duration.match(/P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/);
        if (!match) throw new Error(`无效的持续时间格式: ${duration}`);
        const [, years, months, days, hours, minutes, seconds] = match;
        return {
          years: parseInt(years) || 0,
          months: parseInt(months) || 0,
          days: parseInt(days) || 0,
          hours: parseInt(hours) || 0,
          minutes: parseInt(minutes) || 0,
          seconds: parseInt(seconds) || 0,
        };
      },
      description: '创建持续时间',
    });

    // years and months duration - 年月持续时间
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.YEARS_AND_MONTHS_DURATION,
      parameters: [{ name: 'from', type: 'date' }, { name: 'to', type: 'date' }],
      returnType: 'duration',
      implementation: (from: Date, to: Date) => {
        const years = to.getFullYear() - from.getFullYear();
        const months = to.getMonth() - from.getMonth();
        const totalMonths = years * 12 + months;
        return {
          years: Math.floor(totalMonths / 12),
          months: totalMonths % 12,
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
        };
      },
      description: '计算两个日期之间的年月持续时间',
    });
  }

  /**
   * 注册转换函数
   */
  private registerConversionFunctions(): void {
    // string - 转换为字符串
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.STRING,
      parameters: [{ name: 'from', type: 'any' }],
      returnType: 'string',
      implementation: (from: any) => {
        if (from === null) return 'null';
        if (from instanceof Date) return from.toISOString();
        return String(from);
      },
      description: '将值转换为字符串',
    });

    // boolean - 转换为布尔值
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.BOOLEAN,
      parameters: [{ name: 'from', type: 'any' }],
      returnType: 'boolean',
      implementation: (from: any) => {
        if (from === null || from === undefined) return false;
        if (typeof from === 'boolean') return from;
        if (typeof from === 'number') return from !== 0;
        if (typeof from === 'string') {
          const lower = from.toLowerCase();
          return lower === 'true' || lower === 'yes' || lower === '1';
        }
        return true;
      },
      description: '将值转换为布尔值',
    });
  }

  /**
   * 注册上下文函数
   */
  private registerContextFunctions(): void {
    // get entries - 获取条目
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.GET_ENTRIES,
      parameters: [{ name: 'context', type: 'context' }],
      returnType: 'list',
      implementation: (context: Record<string, any>) => {
        return Object.entries(context).map(([key, value]) => ({ key, value }));
      },
      description: '返回上下文的所有键值对',
    });

    // get value - 获取值
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.GET_VALUE,
      parameters: [{ name: 'context', type: 'context' }, { name: 'key', type: 'string' }],
      returnType: 'any',
      implementation: (context: Record<string, any>, key: string) => context[key],
      description: '返回上下文中指定键的值',
    });

    // context put - 设置值
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.CONTEXT_PUT,
      parameters: [
        { name: 'context', type: 'context' },
        { name: 'key', type: 'string' },
        { name: 'value', type: 'any' },
      ],
      returnType: 'context',
      implementation: (context: Record<string, any>, key: string, value: any) => ({
        ...context,
        [key]: value,
      }),
      description: '返回设置了新值的上下文',
    });

    // context merge - 合并上下文
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.CONTEXT_MERGE,
      parameters: [{ name: 'contexts', type: 'list' }],
      returnType: 'context',
      implementation: (contexts: Record<string, any>[]) => {
        return contexts.reduce((result, ctx) => ({ ...result, ...ctx }), {});
      },
      description: '合并多个上下文',
    });
  }

  /**
   * 注册范围函数
   */
  private registerRangeFunctions(): void {
    // before - 在之前
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.BEFORE,
      parameters: [{ name: 'point1', type: 'any' }, { name: 'point2', type: 'any' }],
      returnType: 'boolean',
      implementation: (point1: any, point2: any) => point1 < point2,
      description: '检查point1是否在point2之前',
    });

    // after - 在之后
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.AFTER,
      parameters: [{ name: 'point1', type: 'any' }, { name: 'point2', type: 'any' }],
      returnType: 'boolean',
      implementation: (point1: any, point2: any) => point1 > point2,
      description: '检查point1是否在point2之后',
    });

    // meets - 相接
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.MEETS,
      parameters: [{ name: 'range1', type: 'any' }, { name: 'range2', type: 'any' }],
      returnType: 'boolean',
      implementation: (range1: any, range2: any) => {
        if (range1.end !== undefined && range2.start !== undefined) {
          return range1.end === range2.start;
        }
        return false;
      },
      description: '检查range1的结束是否等于range2的开始',
    });

    // met by - 被相接
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.MET_BY,
      parameters: [{ name: 'range1', type: 'any' }, { name: 'range2', type: 'any' }],
      returnType: 'boolean',
      implementation: (range1: any, range2: any) => {
        if (range1.start !== undefined && range2.end !== undefined) {
          return range1.start === range2.end;
        }
        return false;
      },
      description: '检查range1的开始是否等于range2的结束',
    });

    // overlaps - 重叠
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.OVERLAPS,
      parameters: [{ name: 'range1', type: 'any' }, { name: 'range2', type: 'any' }],
      returnType: 'boolean',
      implementation: (range1: any, range2: any) => {
        const start1 = range1.start !== undefined ? range1.start : range1;
        const end1 = range1.end !== undefined ? range1.end : range1;
        const start2 = range2.start !== undefined ? range2.start : range2;
        const end2 = range2.end !== undefined ? range2.end : range2;
        return start1 < end2 && start2 < end1;
      },
      description: '检查两个范围是否重叠',
    });

    // overlaps before - 在之前重叠
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.OVERLAPPED_BY,
      parameters: [{ name: 'range1', type: 'any' }, { name: 'range2', type: 'any' }],
      returnType: 'boolean',
      implementation: (range1: any, range2: any) => {
        const start1 = range1.start !== undefined ? range1.start : range1;
        const end1 = range1.end !== undefined ? range1.end : range1;
        const start2 = range2.start !== undefined ? range2.start : range2;
        const end2 = range2.end !== undefined ? range2.end : range2;
        return start1 > start2 && end1 < end2;
      },
      description: '检查range1是否被range2重叠',
    });

    // finishes - 完成
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.FINISHES,
      parameters: [{ name: 'range1', type: 'any' }, { name: 'range2', type: 'any' }],
      returnType: 'boolean',
      implementation: (range1: any, range2: any) => {
        const end1 = range1.end !== undefined ? range1.end : range1;
        const end2 = range2.end !== undefined ? range2.end : range2;
        return end1 === end2;
      },
      description: '检查range1是否以range2的结束点结束',
    });

    // finished by - 被完成
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.FINISHED_BY,
      parameters: [{ name: 'range1', type: 'any' }, { name: 'range2', type: 'any' }],
      returnType: 'boolean',
      implementation: (range1: any, range2: any) => {
        const end1 = range1.end !== undefined ? range1.end : range1;
        const end2 = range2.end !== undefined ? range2.end : range2;
        return end1 === end2;
      },
      description: '检查range2是否以range1的结束点结束',
    });

    // includes - 包含
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.INCLUDES,
      parameters: [{ name: 'range', type: 'any' }, { name: 'point', type: 'any' }],
      returnType: 'boolean',
      implementation: (range: any, point: any) => {
        const start = range.start !== undefined ? range.start : range;
        const end = range.end !== undefined ? range.end : range;
        return point >= start && point <= end;
      },
      description: '检查范围是否包含点',
    });

    // during - 在期间
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.DURING,
      parameters: [{ name: 'range1', type: 'any' }, { name: 'range2', type: 'any' }],
      returnType: 'boolean',
      implementation: (range1: any, range2: any) => {
        const start1 = range1.start !== undefined ? range1.start : range1;
        const end1 = range1.end !== undefined ? range1.end : range1;
        const start2 = range2.start !== undefined ? range2.start : range2;
        const end2 = range2.end !== undefined ? range2.end : range2;
        return start1 >= start2 && end1 <= end2;
      },
      description: '检查range1是否在range2期间',
    });

    // starts - 开始
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.STARTS,
      parameters: [{ name: 'range1', type: 'any' }, { name: 'range2', type: 'any' }],
      returnType: 'boolean',
      implementation: (range1: any, range2: any) => {
        const start1 = range1.start !== undefined ? range1.start : range1;
        const start2 = range2.start !== undefined ? range2.start : range2;
        return start1 === start2;
      },
      description: '检查range1是否以range2的开始点开始',
    });

    // started by - 被开始
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.STARTED_BY,
      parameters: [{ name: 'range1', type: 'any' }, { name: 'range2', type: 'any' }],
      returnType: 'boolean',
      implementation: (range1: any, range2: any) => {
        const start1 = range1.start !== undefined ? range1.start : range1;
        const start2 = range2.start !== undefined ? range2.start : range2;
        return start1 === start2;
      },
      description: '检查range2是否以range1的开始点开始',
    });

    // coincides - 重合
    this.register({
      name: FEEL_BUILTIN_FUNCTIONS.COINCIDES,
      parameters: [{ name: 'point1', type: 'any' }, { name: 'point2', type: 'any' }],
      returnType: 'boolean',
      implementation: (point1: any, point2: any) => point1 === point2,
      description: '检查两个点是否重合',
    });
  }

  /**
   * 注册函数
   */
  private register(func: FeelFunction): void {
    const normalizedName = this.normalizeFunctionName(func.name);
    this.functions.set(normalizedName, func);
  }

  /**
   * 标准化函数名称
   */
  private normalizeFunctionName(name: string): string {
    // 将空格替换为下划线，并转换为小写
    return name.toLowerCase().replace(/\s+/g, '_');
  }
}
