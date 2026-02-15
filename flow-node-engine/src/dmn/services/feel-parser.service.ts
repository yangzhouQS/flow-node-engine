import { Injectable, Logger } from '@nestjs/common';
import {
  FeelExpression,
  FeelExpressionType,
  FeelLiteralExpression,
  FeelVariableExpression,
  FeelBinaryExpression,
  FeelUnaryExpression,
  FeelBetweenExpression,
  FeelRangeExpression,
  FeelListExpression,
  FeelInExpression,
  FeelIfExpression,
  FeelFunctionCallExpression,
  FeelParseOptions,
  FeelParseResult,
  FeelParseError,
  FeelPropertyAccessExpression,
  FeelContextExpression,
  FeelFilterExpression,
  FeelConcatenationExpression,
} from '../interfaces/feel-expression.interface';

/**
 * Token类型
 */
enum TokenType {
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  NULL = 'NULL',
  IDENTIFIER = 'IDENTIFIER',
  OPERATOR = 'OPERATOR',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  COMMA = 'COMMA',
  DOT = 'DOT',
  COLON = 'COLON',
  RANGE = 'RANGE',
  EOF = 'EOF',
}

/**
 * Token结构
 */
interface Token {
  type: TokenType;
  value: string | number;
  position: number;
  line: number;
  column: number;
}

/**
 * FEEL表达式解析器服务
 * 实现DMN 1.3 FEEL语法解析
 */
@Injectable()
export class FeelParserService {
  private readonly logger = new Logger(FeelParserService.name);

  /**
   * 解析FEEL表达式字符串
   */
  parse(expression: string, options?: FeelParseOptions): FeelParseResult {
    const errors: FeelParseError[] = [];
    const warnings: string[] = [];

    try {
      const tokens = this.tokenize(expression, errors);
      if (errors.length > 0) {
        return { success: false, errors, warnings };
      }

      const parser = new TokenParser(tokens, expression);
      const ast = parser.parse();

      if (parser.hasErrors()) {
        return { success: false, errors: parser.getErrors(), warnings };
      }

      return { success: true, expression: ast, errors: [], warnings };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({ message: `解析错误: ${errorMessage}` });
      return { success: false, errors, warnings };
    }
  }

  /**
   * 验证FEEL表达式语法
   */
  validate(expression: string): { valid: boolean; errors: FeelParseError[] } {
    const result = this.parse(expression);
    return { valid: result.success, errors: result.errors };
  }

  /**
   * 将表达式字符串转换为Token列表
   */
  private tokenize(expression: string, errors: FeelParseError[]): Token[] {
    const tokens: Token[] = [];
    let pos = 0;
    let line = 1;
    let column = 1;

    const input = expression.trim();

    while (pos < input.length) {
      // 跳过空白字符
      if (/\s/.test(input[pos])) {
        if (input[pos] === '\n') {
          line++;
          column = 1;
        } else {
          column++;
        }
        pos++;
        continue;
      }

      const startPos = pos;
      const startColumn = column;

      // 数字
      if (/[0-9]/.test(input[pos]) || (input[pos] === '-' && /[0-9]/.test(input[pos + 1]))) {
        let numStr = '';
        if (input[pos] === '-') {
          numStr += input[pos];
          pos++;
          column++;
        }
        while (pos < input.length && /[0-9.]/.test(input[pos])) {
          numStr += input[pos];
          pos++;
          column++;
        }
        tokens.push({
          type: TokenType.NUMBER,
          value: parseFloat(numStr),
          position: startPos,
          line,
          column: startColumn,
        });
        continue;
      }

      // 字符串（双引号）
      if (input[pos] === '"') {
        pos++;
        column++;
        let str = '';
        while (pos < input.length && input[pos] !== '"') {
          if (input[pos] === '\\' && pos + 1 < input.length) {
            pos++;
            column++;
            str += this.unescapeChar(input[pos]);
          } else {
            str += input[pos];
          }
          pos++;
          column++;
        }
        if (pos >= input.length) {
          errors.push({ message: '未闭合的字符串', position: startPos, line, column: startColumn });
        } else {
          pos++;
          column++;
        }
        tokens.push({
          type: TokenType.STRING,
          value: str,
          position: startPos,
          line,
          column: startColumn,
        });
        continue;
      }

      // 布尔值和null
      if (/true|false|null/i.test(input.substring(pos, pos + 5))) {
        const match = input.substring(pos).match(/^(true|false|null)/i);
        if (match) {
          const value = match[0].toLowerCase();
          tokens.push({
            type: value === 'null' ? TokenType.NULL : TokenType.BOOLEAN,
            value: value === 'true' ? true : value === 'false' ? false : null,
            position: startPos,
            line,
            column: startColumn,
          });
          pos += match[0].length;
          column += match[0].length;
          continue;
        }
      }

      // 范围运算符
      if (input.substring(pos, pos + 2) === '..') {
        tokens.push({
          type: TokenType.RANGE,
          value: '..',
          position: startPos,
          line,
          column: startColumn,
        });
        pos += 2;
        column += 2;
        continue;
      }

      // 运算符
      if (/[+\-*\/<>=!]/.test(input[pos])) {
        let op = input[pos];
        pos++;
        column++;
        if (pos < input.length && /[=*\/]/.test(input[pos])) {
          op += input[pos];
          pos++;
          column++;
        }
        tokens.push({
          type: TokenType.OPERATOR,
          value: op,
          position: startPos,
          line,
          column: startColumn,
        });
        continue;
      }

      // 括号
      if (input[pos] === '(') {
        tokens.push({ type: TokenType.LPAREN, value: '(', position: startPos, line, column: startColumn });
        pos++;
        column++;
        continue;
      }
      if (input[pos] === ')') {
        tokens.push({ type: TokenType.RPAREN, value: ')', position: startPos, line, column: startColumn });
        pos++;
        column++;
        continue;
      }

      // 方括号
      if (input[pos] === '[') {
        tokens.push({ type: TokenType.LBRACKET, value: '[', position: startPos, line, column: startColumn });
        pos++;
        column++;
        continue;
      }
      if (input[pos] === ']') {
        tokens.push({ type: TokenType.RBRACKET, value: ']', position: startPos, line, column: startColumn });
        pos++;
        column++;
        continue;
      }

      // 花括号
      if (input[pos] === '{') {
        tokens.push({ type: TokenType.LBRACE, value: '{', position: startPos, line, column: startColumn });
        pos++;
        column++;
        continue;
      }
      if (input[pos] === '}') {
        tokens.push({ type: TokenType.RBRACE, value: '}', position: startPos, line, column: startColumn });
        pos++;
        column++;
        continue;
      }

      // 逗号
      if (input[pos] === ',') {
        tokens.push({ type: TokenType.COMMA, value: ',', position: startPos, line, column: startColumn });
        pos++;
        column++;
        continue;
      }

      // 点号
      if (input[pos] === '.') {
        tokens.push({ type: TokenType.DOT, value: '.', position: startPos, line, column: startColumn });
        pos++;
        column++;
        continue;
      }

      // 冒号
      if (input[pos] === ':') {
        tokens.push({ type: TokenType.COLON, value: ':', position: startPos, line, column: startColumn });
        pos++;
        column++;
        continue;
      }

      // 标识符
      if (/[a-zA-Z_]/.test(input[pos])) {
        let identifier = '';
        while (pos < input.length && /[a-zA-Z0-9_]/.test(input[pos])) {
          identifier += input[pos];
          pos++;
          column++;
        }
        tokens.push({
          type: TokenType.IDENTIFIER,
          value: identifier,
          position: startPos,
          line,
          column: startColumn,
        });
        continue;
      }

      // 未知字符
      errors.push({
        message: `未知字符: ${input[pos]}`,
        position: startPos,
        line,
        column: startColumn,
      });
      pos++;
      column++;
    }

    tokens.push({ type: TokenType.EOF, value: '', position: pos, line, column });
    return tokens;
  }

  /**
   * 转义字符处理
   */
  private unescapeChar(char: string): string {
    const escapeMap: Record<string, string> = {
      n: '\n',
      t: '\t',
      r: '\r',
      '\\': '\\',
      '"': '"',
    };
    return escapeMap[char] || char;
  }
}

/**
 * Token解析器
 * 将Token列表转换为AST
 */
class TokenParser {
  private tokens: Token[];
  private pos = 0;
  private errors: FeelParseError[] = [];
  private source: string;

  constructor(tokens: Token[], source: string) {
    this.tokens = tokens;
    this.source = source;
  }

  /**
   * 解析表达式
   */
  parse(): FeelExpression {
    return this.parseExpression();
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrors(): FeelParseError[] {
    return this.errors;
  }

  /**
   * 解析表达式（入口）
   */
  private parseExpression(): FeelExpression {
    if (this.check(TokenType.IDENTIFIER) && this.peek().value === 'if') {
      return this.parseIfExpression();
    }

    if (this.check(TokenType.IDENTIFIER) && (this.peek().value === 'some' || this.peek().value === 'every')) {
      return this.parseQuantifiedExpression();
    }

    if (this.check(TokenType.IDENTIFIER) && this.peek().value === 'for') {
      return this.parseForExpression();
    }

    return this.parseOrExpression();
  }

  /**
   * 解析if表达式
   */
  private parseIfExpression(): FeelExpression {
    this.consume(TokenType.IDENTIFIER, 'if');
    const condition = this.parseExpression();
    this.consume(TokenType.IDENTIFIER, 'then');
    const thenExpression = this.parseExpression();
    this.consume(TokenType.IDENTIFIER, 'else');
    const elseExpression = this.parseExpression();

    return {
      type: FeelExpressionType.IF,
      condition,
      thenExpression,
      elseExpression,
      source: this.source,
    } as FeelIfExpression;
  }

  /**
   * 解析量化表达式（some/every）
   */
  private parseQuantifiedExpression(): FeelExpression {
    const quantifier = this.consume(TokenType.IDENTIFIER).value as string;
    const iterator = this.consume(TokenType.IDENTIFIER).value as string;
    this.consume(TokenType.IDENTIFIER, 'in');
    const iterable = this.parseExpression();
    this.consume(TokenType.IDENTIFIER, 'satisfies');
    const condition = this.parseExpression();

    return {
      type: quantifier === 'some' ? FeelExpressionType.SOME : FeelExpressionType.EVERY,
      iterator,
      iterable,
      condition,
      source: this.source,
    };
  }

  /**
   * 解析for表达式
   */
  private parseForExpression(): FeelExpression {
    this.consume(TokenType.IDENTIFIER, 'for');
    const iterator = this.consume(TokenType.IDENTIFIER).value as string;
    this.consume(TokenType.IDENTIFIER, 'in');
    const iterable = this.parseExpression();
    this.consume(TokenType.IDENTIFIER, 'return');
    const body = this.parseExpression();

    return {
      type: FeelExpressionType.FOR,
      iterator,
      iterable,
      body,
      source: this.source,
    };
  }

  /**
   * 解析or表达式
   */
  private parseOrExpression(): FeelExpression {
    let left = this.parseAndExpression();

    while (this.check(TokenType.IDENTIFIER) && this.peek().value === 'or') {
      this.consume(TokenType.IDENTIFIER, 'or');
      const right = this.parseAndExpression();
      left = {
        type: FeelExpressionType.OR,
        left,
        right,
        source: this.source,
      } as FeelBinaryExpression;
    }

    return left;
  }

  /**
   * 解析and表达式
   */
  private parseAndExpression(): FeelExpression {
    let left = this.parseComparisonExpression();

    while (this.check(TokenType.IDENTIFIER) && this.peek().value === 'and') {
      this.consume(TokenType.IDENTIFIER, 'and');
      const right = this.parseComparisonExpression();
      left = {
        type: FeelExpressionType.AND,
        left,
        right,
        source: this.source,
      } as FeelBinaryExpression;
    }

    return left;
  }

  /**
   * 解析比较表达式
   */
  private parseComparisonExpression(): FeelExpression {
    const left = this.parseBetweenExpression();

    if (this.check(TokenType.IDENTIFIER) && this.peek().value === 'in') {
      this.consume(TokenType.IDENTIFIER, 'in');
      const right = this.parseAdditiveExpression();
      return {
        type: FeelExpressionType.IN,
        value: left,
        list: right,
        source: this.source,
      } as FeelInExpression;
    }

    return left;
  }

  /**
   * 解析between表达式
   */
  private parseBetweenExpression(): FeelExpression {
    const value = this.parseAdditiveExpression();

    if (this.check(TokenType.IDENTIFIER) && this.peek().value === 'between') {
      this.consume(TokenType.IDENTIFIER, 'between');
      const low = this.parseAdditiveExpression();
      this.consume(TokenType.IDENTIFIER, 'and');
      const high = this.parseAdditiveExpression();
      return {
        type: FeelExpressionType.BETWEEN,
        value,
        low,
        high,
        source: this.source,
      } as FeelBetweenExpression;
    }

    return value;
  }

  /**
   * 解析加法表达式
   */
  private parseAdditiveExpression(): FeelExpression {
    let left = this.parseMultiplicativeExpression();

    while (this.check(TokenType.OPERATOR) && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.consume(TokenType.OPERATOR).value as string;
      const right = this.parseMultiplicativeExpression();
      left = {
        type: op === '+' ? FeelExpressionType.ADDITION : FeelExpressionType.SUBTRACTION,
        left,
        right,
        source: this.source,
      } as FeelBinaryExpression;
    }

    return left;
  }

  /**
   * 解析乘法表达式
   */
  private parseMultiplicativeExpression(): FeelExpression {
    let left = this.parsePowerExpression();

    while (
      this.check(TokenType.OPERATOR) &&
      (this.peek().value === '*' || this.peek().value === '/')
    ) {
      const op = this.consume(TokenType.OPERATOR).value as string;
      const right = this.parsePowerExpression();
      left = {
        type: op === '*' ? FeelExpressionType.MULTIPLICATION : FeelExpressionType.DIVISION,
        left,
        right,
        source: this.source,
      } as FeelBinaryExpression;
    }

    return left;
  }

  /**
   * 解析幂运算表达式
   */
  private parsePowerExpression(): FeelExpression {
    let left = this.parseUnaryExpression();

    if (this.check(TokenType.OPERATOR) && this.peek().value === '**') {
      this.consume(TokenType.OPERATOR);
      const right = this.parsePowerExpression();
      return {
        type: FeelExpressionType.EXPONENTIATION,
        left,
        right,
        source: this.source,
      } as FeelBinaryExpression;
    }

    return left;
  }

  /**
   * 解析一元表达式
   */
  private parseUnaryExpression(): FeelExpression {
    if (this.check(TokenType.OPERATOR) && this.peek().value === '-') {
      this.consume(TokenType.OPERATOR);
      const operand = this.parseUnaryExpression();
      return {
        type: FeelExpressionType.NEGATION,
        operand,
        source: this.source,
      } as FeelUnaryExpression;
    }

    if (this.check(TokenType.IDENTIFIER) && this.peek().value === 'not') {
      this.consume(TokenType.IDENTIFIER, 'not');
      const operand = this.parseUnaryExpression();
      return {
        type: FeelExpressionType.NOT,
        operand,
        source: this.source,
      } as FeelUnaryExpression;
    }

    return this.parsePostfixExpression();
  }

  /**
   * 解析后缀表达式（属性访问、函数调用、过滤）
   */
  private parsePostfixExpression(): FeelExpression {
    let expr = this.parsePrimaryExpression();

    while (true) {
      if (this.check(TokenType.DOT)) {
        this.consume(TokenType.DOT);
        const property = this.consume(TokenType.IDENTIFIER).value as string;
        expr = {
          type: FeelExpressionType.PROPERTY_ACCESS,
          object: expr,
          property,
          source: this.source,
        } as FeelPropertyAccessExpression;
      } else if (this.check(TokenType.LPAREN)) {
        expr = this.parseFunctionCall(expr);
      } else if (this.check(TokenType.LBRACKET)) {
        expr = this.parseFilterExpression(expr);
      } else {
        break;
      }
    }

    return expr;
  }

  /**
   * 解析函数调用
   */
  private parseFunctionCall(funcExpr: FeelExpression): FeelExpression {
    this.consume(TokenType.LPAREN);
    const parameters: FeelExpression[] = [];

    if (!this.check(TokenType.RPAREN)) {
      parameters.push(this.parseExpression());
      while (this.check(TokenType.COMMA)) {
        this.consume(TokenType.COMMA);
        parameters.push(this.parseExpression());
      }
    }

    this.consume(TokenType.RPAREN);

    return {
      type: FeelExpressionType.FUNCTION_CALL,
      functionName:
        funcExpr.type === FeelExpressionType.VARIABLE
          ? (funcExpr as FeelVariableExpression).name
          : 'anonymous',
      parameters,
      source: this.source,
    } as FeelFunctionCallExpression;
  }

  /**
   * 解析过滤表达式
   */
  private parseFilterExpression(list: FeelExpression): FeelExpression {
    this.consume(TokenType.LBRACKET);
    const filter = this.parseExpression();
    this.consume(TokenType.RBRACKET);

    return {
      type: FeelExpressionType.FILTER,
      list,
      filter,
      source: this.source,
    } as FeelFilterExpression;
  }

  /**
   * 解析主表达式
   */
  private parsePrimaryExpression(): FeelExpression {
    // 数字
    if (this.check(TokenType.NUMBER)) {
      const value = this.consume(TokenType.NUMBER).value;
      return {
        type: FeelExpressionType.NUMBER,
        value,
        source: this.source,
      } as FeelLiteralExpression;
    }

    // 字符串
    if (this.check(TokenType.STRING)) {
      const value = this.consume(TokenType.STRING).value;
      return {
        type: FeelExpressionType.STRING,
        value,
        source: this.source,
      } as FeelLiteralExpression;
    }

    // 布尔值
    if (this.check(TokenType.BOOLEAN)) {
      const value = this.consume(TokenType.BOOLEAN).value;
      return {
        type: FeelExpressionType.BOOLEAN,
        value,
        source: this.source,
      } as FeelLiteralExpression;
    }

    // null
    if (this.check(TokenType.NULL)) {
      this.consume(TokenType.NULL);
      return {
        type: FeelExpressionType.NULL,
        value: null,
        source: this.source,
      } as FeelLiteralExpression;
    }

    // 括号表达式
    if (this.check(TokenType.LPAREN)) {
      this.consume(TokenType.LPAREN);
      const expr = this.parseExpression();
      this.consume(TokenType.RPAREN);
      return expr;
    }

    // 列表表达式
    if (this.check(TokenType.LBRACKET)) {
      return this.parseListExpression();
    }

    // 上下文表达式
    if (this.check(TokenType.LBRACE)) {
      return this.parseContextExpression();
    }

    // 范围表达式
    if (this.check(TokenType.LBRACKET) || this.check(TokenType.RANGE)) {
      return this.parseRangeExpression();
    }

    // 标识符（变量或函数名）
    if (this.check(TokenType.IDENTIFIER)) {
      const name = this.consume(TokenType.IDENTIFIER).value as string;
      return {
        type: FeelExpressionType.VARIABLE,
        name,
        source: this.source,
      } as FeelVariableExpression;
    }

    this.errors.push({
      message: `意外的token: ${this.peek().value}`,
      position: this.peek().position,
      line: this.peek().line,
      column: this.peek().column,
    });

    return {
      type: FeelExpressionType.NULL,
      value: null,
      source: this.source,
    } as FeelLiteralExpression;
  }

  /**
   * 解析列表表达式
   */
  private parseListExpression(): FeelExpression {
    this.consume(TokenType.LBRACKET);
    const elements: FeelExpression[] = [];

    if (!this.check(TokenType.RBRACKET)) {
      elements.push(this.parseExpression());
      while (this.check(TokenType.COMMA)) {
        this.consume(TokenType.COMMA);
        elements.push(this.parseExpression());
      }
    }

    this.consume(TokenType.RBRACKET);

    return {
      type: FeelExpressionType.LIST,
      elements,
      source: this.source,
    } as FeelListExpression;
  }

  /**
   * 解析上下文表达式
   */
  private parseContextExpression(): FeelExpression {
    this.consume(TokenType.LBRACE);
    const entries: Record<string, FeelExpression> = {};

    if (!this.check(TokenType.RBRACE)) {
      const key = this.consume(TokenType.IDENTIFIER).value as string;
      this.consume(TokenType.COLON);
      const value = this.parseExpression();
      entries[key] = value;

      while (this.check(TokenType.COMMA)) {
        this.consume(TokenType.COMMA);
        const k = this.consume(TokenType.IDENTIFIER).value as string;
        this.consume(TokenType.COLON);
        const v = this.parseExpression();
        entries[k] = v;
      }
    }

    this.consume(TokenType.RBRACE);

    return {
      type: FeelExpressionType.CONTEXT,
      entries,
      source: this.source,
    } as FeelContextExpression;
  }

  /**
   * 解析范围表达式
   */
  private parseRangeExpression(): FeelExpression {
    const startInclusive = !this.check(TokenType.LPAREN);
    if (this.check(TokenType.LBRACKET)) {
      this.consume(TokenType.LBRACKET);
    } else if (this.check(TokenType.LPAREN)) {
      this.consume(TokenType.LPAREN);
    }

    const start = this.parseExpression();
    this.consume(TokenType.RANGE);
    const end = this.parseExpression();

    const endInclusive = !this.check(TokenType.RPAREN);
    if (this.check(TokenType.RBRACKET)) {
      this.consume(TokenType.RBRACKET);
    } else if (this.check(TokenType.RPAREN)) {
      this.consume(TokenType.RPAREN);
    }

    return {
      type: FeelExpressionType.RANGE,
      start,
      end,
      startInclusive,
      endInclusive,
      source: this.source,
    } as FeelRangeExpression;
  }

  /**
   * 检查当前token类型
   */
  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  /**
   * 查看当前token
   */
  private peek(): Token {
    return this.tokens[this.pos];
  }

  /**
   * 消费token
   */
  private consume(type?: TokenType, expected?: string): Token {
    const token = this.peek();

    if (type && token.type !== type) {
      this.errors.push({
        message: `期望 ${expected || type}，但得到 ${token.type}`,
        position: token.position,
        line: token.line,
        column: token.column,
      });
    }

    if (type === TokenType.IDENTIFIER && expected && token.value !== expected) {
      this.errors.push({
        message: `期望关键字 "${expected}"，但得到 "${token.value}"`,
        position: token.position,
        line: token.line,
        column: token.column,
      });
    }

    this.pos++;
    return token;
  }
}
