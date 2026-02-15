/**
 * FEEL (Friendly Enough Expression Language) 接口定义
 * 基于DMN 1.3标准
 * 与Flowable FEEL实现兼容
 */

/**
 * FEEL表达式类型
 */
export enum FeelExpressionType {
  // 字面量
  LITERAL = 'LITERAL',
  BOOLEAN = 'BOOLEAN',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  DATE = 'DATE',
  TIME = 'TIME',
  DATE_TIME = 'DATE_TIME',
  DURATION = 'DURATION',
  NULL = 'NULL',

  // 变量引用
  VARIABLE = 'VARIABLE',
  PROPERTY_ACCESS = 'PROPERTY_ACCESS',

  // 算术运算
  ADDITION = 'ADDITION',
  SUBTRACTION = 'SUBTRACTION',
  MULTIPLICATION = 'MULTIPLICATION',
  DIVISION = 'DIVISION',
  EXPONENTIATION = 'EXPONENTIATION',
  NEGATION = 'NEGATION',

  // 比较运算
  EQUAL = 'EQUAL',
  NOT_EQUAL = 'NOT_EQUAL',
  LESS_THAN = 'LESS_THAN',
  LESS_THAN_OR_EQUAL = 'LESS_THAN_OR_EQUAL',
  GREATER_THAN = 'GREATER_THAN',
  GREATER_THAN_OR_EQUAL = 'GREATER_THAN_OR_EQUAL',
  BETWEEN = 'BETWEEN',

  // 逻辑运算
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',

  // 区间表达式
  RANGE = 'RANGE',
  OPEN_RANGE = 'OPEN_RANGE',

  // 列表表达式
  LIST = 'LIST',
  IN = 'IN',
  NOT_IN = 'NOT_IN',

  // 条件表达式
  IF = 'IF',
  CASE = 'CASE',

  // 函数调用
  FUNCTION_CALL = 'FUNCTION_CALL',
  LAMBDA = 'LAMBDA',

  // 量化表达式
  FOR = 'FOR',
  SOME = 'SOME',
  EVERY = 'EVERY',

  // 过滤和投影
  FILTER = 'FILTER',
  PROJECTION = 'PROJECTION',

  // 字符串操作
  CONCATENATION = 'CONCATENATION',

  // 上下文表达式
  CONTEXT = 'CONTEXT',
}

/**
 * FEEL表达式基类
 */
export interface FeelExpression {
  type: FeelExpressionType;
  source?: string;
}

/**
 * 字面量表达式
 */
export interface FeelLiteralExpression extends FeelExpression {
  type: FeelExpressionType.LITERAL | FeelExpressionType.NUMBER | FeelExpressionType.STRING | FeelExpressionType.BOOLEAN | FeelExpressionType.NULL;
  value: any;
  dataType?: FeelDataType;
}

/**
 * 日期表达式
 */
export interface FeelDateExpression extends FeelExpression {
  type: FeelExpressionType.DATE | FeelExpressionType.TIME | FeelExpressionType.DATE_TIME | FeelExpressionType.DURATION;
  value: Date | string;
  format?: string;
}

/**
 * 变量引用表达式
 */
export interface FeelVariableExpression extends FeelExpression {
  type: FeelExpressionType.VARIABLE;
  name: string;
}

/**
 * 属性访问表达式
 */
export interface FeelPropertyAccessExpression extends FeelExpression {
  type: FeelExpressionType.PROPERTY_ACCESS;
  object: FeelExpression;
  property: string;
}

/**
 * 二元运算表达式
 */
export interface FeelBinaryExpression extends FeelExpression {
  type:
    | FeelExpressionType.ADDITION
    | FeelExpressionType.SUBTRACTION
    | FeelExpressionType.MULTIPLICATION
    | FeelExpressionType.DIVISION
    | FeelExpressionType.EXPONENTIATION
    | FeelExpressionType.EQUAL
    | FeelExpressionType.NOT_EQUAL
    | FeelExpressionType.LESS_THAN
    | FeelExpressionType.LESS_THAN_OR_EQUAL
    | FeelExpressionType.GREATER_THAN
    | FeelExpressionType.GREATER_THAN_OR_EQUAL
    | FeelExpressionType.AND
    | FeelExpressionType.OR;
  left: FeelExpression;
  right: FeelExpression;
}

/**
 * 一元运算表达式
 */
export interface FeelUnaryExpression extends FeelExpression {
  type: FeelExpressionType.NEGATION | FeelExpressionType.NOT;
  operand: FeelExpression;
}

/**
 * Between表达式
 */
export interface FeelBetweenExpression extends FeelExpression {
  type: FeelExpressionType.BETWEEN;
  value: FeelExpression;
  low: FeelExpression;
  high: FeelExpression;
}

/**
 * 区间表达式
 */
export interface FeelRangeExpression extends FeelExpression {
  type: FeelExpressionType.RANGE | FeelExpressionType.OPEN_RANGE;
  start: FeelExpression;
  end: FeelExpression;
  startInclusive: boolean;
  endInclusive: boolean;
}

/**
 * 列表表达式
 */
export interface FeelListExpression extends FeelExpression {
  type: FeelExpressionType.LIST;
  elements: FeelExpression[];
}

/**
 * In表达式
 */
export interface FeelInExpression extends FeelExpression {
  type: FeelExpressionType.IN | FeelExpressionType.NOT_IN;
  value: FeelExpression;
  list: FeelExpression;
}

/**
 * 条件表达式
 */
export interface FeelIfExpression extends FeelExpression {
  type: FeelExpressionType.IF;
  condition: FeelExpression;
  thenExpression: FeelExpression;
  elseExpression: FeelExpression;
}

/**
 * Case表达式
 */
export interface FeelCaseExpression extends FeelExpression {
  type: FeelExpressionType.CASE;
  cases: Array<{
    condition: FeelExpression;
    result: FeelExpression;
  }>;
  defaultResult?: FeelExpression;
}

/**
 * 函数调用表达式
 */
export interface FeelFunctionCallExpression extends FeelExpression {
  type: FeelExpressionType.FUNCTION_CALL;
  functionName: string;
  parameters: FeelExpression[];
  namedParameters?: Record<string, FeelExpression>;
}

/**
 * Lambda表达式
 */
export interface FeelLambdaExpression extends FeelExpression {
  type: FeelExpressionType.LAMBDA;
  parameters: string[];
  body: FeelExpression;
}

/**
 * For表达式
 */
export interface FeelForExpression extends FeelExpression {
  type: FeelExpressionType.FOR;
  iterator: string;
  iterable: FeelExpression;
  body: FeelExpression;
}

/**
 * Some表达式（存在量词）
 */
export interface FeelSomeExpression extends FeelExpression {
  type: FeelExpressionType.SOME;
  iterator: string;
  iterable: FeelExpression;
  condition: FeelExpression;
}

/**
 * Every表达式（全称量词）
 */
export interface FeelEveryExpression extends FeelExpression {
  type: FeelExpressionType.EVERY;
  iterator: string;
  iterable: FeelExpression;
  condition: FeelExpression;
}

/**
 * 过滤表达式
 */
export interface FeelFilterExpression extends FeelExpression {
  type: FeelExpressionType.FILTER;
  list: FeelExpression;
  filter: FeelExpression;
}

/**
 * 投影表达式
 */
export interface FeelProjectionExpression extends FeelExpression {
  type: FeelExpressionType.PROJECTION;
  context: FeelExpression;
  properties: string[];
}

/**
 * 字符串拼接表达式
 */
export interface FeelConcatenationExpression extends FeelExpression {
  type: FeelExpressionType.CONCATENATION;
  parts: FeelExpression[];
}

/**
 * 上下文表达式
 */
export interface FeelContextExpression extends FeelExpression {
  type: FeelExpressionType.CONTEXT;
  entries: Record<string, FeelExpression>;
}

/**
 * FEEL数据类型
 */
export enum FeelDataType {
  NUMBER = 'number',
  STRING = 'string',
  BOOLEAN = 'boolean',
  DATE = 'date',
  TIME = 'time',
  DATE_TIME = 'date-time',
  DURATION = 'duration',
  LIST = 'list',
  CONTEXT = 'context',
  FUNCTION = 'function',
  ANY = 'any',
}

/**
 * FEEL求值上下文
 */
export interface FeelEvaluationContext {
  variables: Record<string, any>;
  functions: Record<string, FeelFunction>;
  currentDateTime?: Date;
  locale?: string;
  timeZone?: string;
}

/**
 * FEEL函数定义
 */
export interface FeelFunction {
  name: string;
  parameters: Array<{
    name: string;
    type?: FeelDataType;
    optional?: boolean;
    defaultValue?: any;
  }>;
  returnType?: FeelDataType;
  implementation: (...args: any[]) => any;
  description?: string;
}

/**
 * FEEL求值结果
 */
export interface FeelEvaluationResult {
  success: boolean;
  value?: any;
  error?: string;
  errorType?: FeelErrorType;
  warnings?: string[];
}

/**
 * FEEL错误类型
 */
export enum FeelErrorType {
  SYNTAX_ERROR = 'SYNTAX_ERROR',
  TYPE_ERROR = 'TYPE_ERROR',
  VARIABLE_NOT_FOUND = 'VARIABLE_NOT_FOUND',
  FUNCTION_NOT_FOUND = 'FUNCTION_NOT_FOUND',
  INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',
  DIVISION_BY_ZERO = 'DIVISION_BY_ZERO',
  NULL_VALUE = 'NULL_VALUE',
  RUNTIME_ERROR = 'RUNTIME_ERROR',
}

/**
 * FEEL解析选项
 */
export interface FeelParseOptions {
  strictMode?: boolean;
  allowExtensions?: boolean;
}

/**
 * FEEL解析结果
 */
export interface FeelParseResult {
  success: boolean;
  expression?: FeelExpression;
  errors: FeelParseError[];
  warnings?: string[];
}

/**
 * FEEL解析错误
 */
export interface FeelParseError {
  message: string;
  line?: number;
  column?: number;
  position?: number;
  length?: number;
}

/**
 * FEEL内置函数名称
 */
export const FEEL_BUILTIN_FUNCTIONS = {
  // 数值函数
  ABS: 'abs',
  CEILING: 'ceiling',
  FLOOR: 'floor',
  INTEGER: 'integer',
  MODULO: 'modulo',
  POWER: 'power',
  ROUND: 'round',
  SQRT: 'sqrt',
  NUMBER: 'number',
  DECIMAL: 'decimal',

  // 字符串函数
  SUBSTRING: 'substring',
  STRING_LENGTH: 'string length',
  UPPER_CASE: 'upper case',
  LOWER_CASE: 'lower case',
  SUBSTRING_BEFORE: 'substring before',
  SUBSTRING_AFTER: 'substring after',
  REPLACE: 'replace',
  CONTAINS: 'contains',
  STARTS_WITH: 'starts with',
  ENDS_WITH: 'ends with',
  MATCHES: 'matches',
  SPLIT: 'split',
  CONCAT: 'concat',

  // 列表函数
  LIST_CONTAINS: 'list contains',
  COUNT: 'count',
  MIN: 'min',
  MAX: 'max',
  SUM: 'sum',
  PRODUCT: 'product',
  MEAN: 'mean',
  MEDIAN: 'median',
  STDDEV: 'stddev',
  MODE: 'mode',
  AND: 'and',
  OR: 'or',
  SUBLIST: 'sublist',
  APPEND: 'append',
  CONCATENATE: 'concatenate',
  INSERT_BEFORE: 'insert before',
  REMOVE: 'remove',
  REVERSE: 'reverse',
  INDEX_OF: 'index of',
  UNION: 'union',
  DISTINCT_VALUES: 'distinct values',
  FLATTEN: 'flatten',
  SORT: 'sort',
  JOIN: 'join',

  // 日期时间函数
  NOW: 'now',
  TODAY: 'today',
  DATE: 'date',
  TIME: 'time',
  DATE_TIME: 'date and time',
  DURATION: 'duration',
  YEARS_AND_MONTHS_DURATION: 'years and months duration',

  // 转换函数
  STRING: 'string',
  BOOLEAN: 'boolean',

  // 上下文函数
  GET_ENTRIES: 'get entries',
  GET_VALUE: 'get value',
  CONTEXT_PUT: 'context put',
  CONTEXT_MERGE: 'context merge',

  // 范围函数
  BEFORE: 'before',
  AFTER: 'after',
  MEETS: 'meets',
  MET_BY: 'met by',
  OVERLAPS: 'overlaps',
  OVERLAPPED_BY: 'overlapped by',
  FINISHES: 'finishes',
  FINISHED_BY: 'finished by',
  INCLUDES: 'includes',
  DURING: 'during',
  STARTS: 'starts',
  STARTED_BY: 'started by',
  COINCIDES: 'coincides',
} as const;

/**
 * FEEL运算符映射
 */
export const FEEL_OPERATORS = {
  // 算术运算符
  ADD: '+',
  SUBTRACT: '-',
  MULTIPLY: '*',
  DIVIDE: '/',
  POWER: '**',

  // 比较运算符
  EQ: '=',
  NE: '!=',
  LT: '<',
  LE: '<=',
  GT: '>',
  GE: '>=',

  // 逻辑运算符
  AND: 'and',
  OR: 'or',
  NOT: 'not',

  // 区间运算符
  BETWEEN: 'between',
  IN: 'in',

  // 范围运算符
  RANGE_INCLUSIVE: '..',
  RANGE_EXCLUSIVE_START: '.>',
  RANGE_EXCLUSIVE_END: '<.',
  RANGE_EXCLUSIVE: '<>',

  // 其他
  COMMA: ',',
  DOT: '.',
  COLON: ':',
  SEMICOLON: ';',
  LPAREN: '(',
  RPAREN: ')',
  LBRACKET: '[',
  RBRACKET: ']',
  LBRACE: '{',
  RBRACE: '}',
} as const;
