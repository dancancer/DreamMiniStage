/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 数学表达式求值                                 ║
 * ║                                                                            ║
 * ║  安全的数学表达式求值，支持基础运算和常用函数                                  ║
 * ║  不依赖 mathjs，使用内置实现保持轻量                                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              类型定义
// ============================================================================

/** 表达式求值结果 */
export interface EvalResult {
  success: boolean;
  value?: number;
  error?: string;
}

/** 变量上下文 */
export type VariableContext = Record<string, number>;

// ============================================================================
//                              内置函数
// ============================================================================

const MATH_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  sqrt: Math.sqrt,
  pow: Math.pow,
  min: Math.min,
  max: Math.max,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: Math.log,
  log10: Math.log10,
  exp: Math.exp,
  random: Math.random,
  sign: Math.sign,
  trunc: Math.trunc,
  clamp: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),
  lerp: (a: number, b: number, t: number) => a + (b - a) * t,
};

const MATH_CONSTANTS: Record<string, number> = {
  PI: Math.PI,
  E: Math.E,
  LN2: Math.LN2,
  LN10: Math.LN10,
  SQRT2: Math.SQRT2,
};

// ============================================================================
//                              词法分析
// ============================================================================

type TokenType =
  | "NUMBER"
  | "IDENTIFIER"
  | "OPERATOR"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "EOF";

interface Token {
  type: TokenType;
  value: string | number;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const char = expr[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (/\d/.test(char) || (char === "." && /\d/.test(expr[i + 1]))) {
      let num = "";
      while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === ".")) {
        num += expr[i++];
      }
      tokens.push({ type: "NUMBER", value: parseFloat(num) });
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let id = "";
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i++];
      }
      tokens.push({ type: "IDENTIFIER", value: id });
      continue;
    }

    if ("+-*/%^".includes(char)) {
      tokens.push({ type: "OPERATOR", value: char });
      i++;
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
      i++;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
      i++;
      continue;
    }

    if (char === ",") {
      tokens.push({ type: "COMMA", value: "," });
      i++;
      continue;
    }

    throw new Error(`未知字符: ${char}`);
  }

  tokens.push({ type: "EOF", value: "" });
  return tokens;
}

// ============================================================================
//                              语法分析与求值
// ============================================================================

class Parser {
  private tokens: Token[];
  private pos = 0;
  private context: VariableContext;

  constructor(tokens: Token[], context: VariableContext = {}) {
    this.tokens = tokens;
    this.context = context;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private consume(type?: TokenType): Token {
    const token = this.current();
    if (type && token.type !== type) {
      throw new Error(`期望 ${type}，实际 ${token.type}`);
    }
    this.pos++;
    return token;
  }

  parse(): number {
    const result = this.expression();
    if (this.current().type !== "EOF") {
      throw new Error("表达式未完全解析");
    }
    return result;
  }

  private expression(): number {
    return this.additive();
  }

  private additive(): number {
    let left = this.multiplicative();

    while (this.current().type === "OPERATOR" &&
           (this.current().value === "+" || this.current().value === "-")) {
      const op = this.consume().value as string;
      const right = this.multiplicative();
      left = op === "+" ? left + right : left - right;
    }

    return left;
  }

  private multiplicative(): number {
    let left = this.power();

    while (this.current().type === "OPERATOR" &&
           (this.current().value === "*" || this.current().value === "/" || this.current().value === "%")) {
      const op = this.consume().value as string;
      const right = this.power();
      if (op === "*") left = left * right;
      else if (op === "/") left = left / right;
      else left = left % right;
    }

    return left;
  }

  private power(): number {
    let left = this.unary();

    if (this.current().type === "OPERATOR" && this.current().value === "^") {
      this.consume();
      const right = this.power();
      left = Math.pow(left, right);
    }

    return left;
  }

  private unary(): number {
    if (this.current().type === "OPERATOR" && this.current().value === "-") {
      this.consume();
      return -this.unary();
    }
    if (this.current().type === "OPERATOR" && this.current().value === "+") {
      this.consume();
      return this.unary();
    }
    return this.primary();
  }

  private primary(): number {
    const token = this.current();

    if (token.type === "NUMBER") {
      this.consume();
      return token.value as number;
    }

    if (token.type === "IDENTIFIER") {
      const name = token.value as string;
      this.consume();

      if (this.current().type === "LPAREN") {
        return this.functionCall(name);
      }

      if (name in MATH_CONSTANTS) {
        return MATH_CONSTANTS[name];
      }

      if (name in this.context) {
        return this.context[name];
      }

      throw new Error(`未定义的变量: ${name}`);
    }

    if (token.type === "LPAREN") {
      this.consume();
      const result = this.expression();
      this.consume("RPAREN");
      return result;
    }

    throw new Error(`意外的 token: ${token.type}`);
  }

  private functionCall(name: string): number {
    this.consume("LPAREN");
    const args: number[] = [];

    if (this.current().type !== "RPAREN") {
      args.push(this.expression());
      while (this.current().type === "COMMA") {
        this.consume();
        args.push(this.expression());
      }
    }

    this.consume("RPAREN");

    const fn = MATH_FUNCTIONS[name];
    if (!fn) {
      throw new Error(`未定义的函数: ${name}`);
    }

    return fn(...args);
  }
}

// ============================================================================
//                              主函数
// ============================================================================

/**
 * 求值数学表达式
 */
export function evaluate(expr: string, context: VariableContext = {}): EvalResult {
  try {
    const tokens = tokenize(expr);
    const parser = new Parser(tokens, context);
    const value = parser.parse();

    if (!isFinite(value)) {
      return { success: false, error: "结果不是有限数" };
    }

    return { success: true, value };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 安全求值，失败时返回默认值
 */
export function safeEvaluate(expr: string, context: VariableContext = {}, defaultValue = 0): number {
  const result = evaluate(expr, context);
  return result.success ? result.value! : defaultValue;
}

/**
 * 检查表达式是否有效
 */
export function isValidExpression(expr: string): boolean {
  return evaluate(expr).success;
}

/**
 * 从变量数据构建上下文
 */
export function buildContext(data: Record<string, unknown>, prefix = ""): VariableContext {
  const context: VariableContext = {};

  for (const [key, value] of Object.entries(data)) {
    if (key === "$meta") continue;

    const fullKey = prefix ? `${prefix}_${key}` : key;

    if (typeof value === "number") {
      context[fullKey] = value;
    } else if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
      context[fullKey] = value[0];
    } else if (typeof value === "object" && value !== null) {
      Object.assign(context, buildContext(value as Record<string, unknown>, fullKey));
    }
  }

  return context;
}

/**
 * 替换字符串中的数学表达式
 * 格式: ${expr} 或 $[expr]
 */
export function replaceExpressions(
  text: string,
  context: VariableContext = {},
): string {
  return text.replace(/\$[{[]([^}\]]+)[}\]]/g, (_, expr) => {
    const result = evaluate(expr.trim(), context);
    return result.success ? String(result.value) : `[ERROR: ${result.error}]`;
  });
}
