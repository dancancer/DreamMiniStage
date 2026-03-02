/**
 * SillyTavern 宏替换引擎
 *
 * 实现三阶段管线架构：
 * 1. preEnvMacros - 预处理宏（变量宏、工具宏）
 * 2. envMacros - 环境宏（用户名、角色名、注册宏）
 * 3. postEnvMacros - 后处理宏（时间、消息、随机选择）
 */

import type { MacroEnv, MacroHandler, MacroRegistry } from "./st-preset-types";

/* ═══════════════════════════════════════════════════════════════════════════
   宏替换引擎类
   ═══════════════════════════════════════════════════════════════════════════ */

export class STMacroEvaluator {
  private registeredMacros: MacroRegistry = new Map();
  private localVariables: Map<string, string | number> = new Map();
  private globalVariables: Map<string, string | number> = new Map();

  constructor() {
    this.registerBuiltinMacros();
  }

  /* ─────────────────────────────────────────────────────────────────────────
     主入口：执行宏替换
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * 执行完整的宏替换管线
   */
  evaluate(content: string, env: MacroEnv): string {
    if (!content) {
      return content;
    }

    /* ─────────────────────────────────────────────────────────────────────────
       模板噪声清理：始终执行
       - 去除 <content>/<length>/<word_count> 等模板标签
       - 去除 ${...} 包裹
       这些不是宏，但需要在任何内容中清理
       ───────────────────────────────────────────────────────────────────────── */
    let result = this.stripTemplateNoise(content);

    /* ─────────────────────────────────────────────────────────────────────────
       短路检查：只检查现代宏格式 {{
       - 不再处理 Legacy 占位符 (<USER>, <BOT>)
       - 运行时只处理 {{...}} 格式
       ───────────────────────────────────────────────────────────────────────── */
    if (!result.includes("{{")) {
      return result;
    }

    result = this.evaluatePreEnvMacros(result, env);
    result = this.evaluateEnvMacros(result, env);
    result = this.evaluatePostEnvMacros(result, env);

    return result;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     第一阶段：preEnv 宏
     ───────────────────────────────────────────────────────────────────────── */

  private evaluatePreEnvMacros(content: string, env: MacroEnv): string {
    let result = content;

    /* ─────────────────────────────────────────────────────────────────────────
       注意：Legacy 占位符 (<USER>, <BOT>) 不再支持
       运行时仅处理现代 {{...}} 宏格式，以简化管线并提升性能

       注意：stripTemplateNoise 已移至主入口，确保无宏内容也能清理噪声
       ───────────────────────────────────────────────────────────────────────── */

    result = this.replaceVariableMacros(result, env);
    result = this.replaceToolMacros(result);
    result = this.replaceRollMacro(result);

    return result;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     注意：replaceLegacyPlaceholders() 已移除
     Legacy 占位符 (<USER>, <BOT>) 不再支持
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * 替换变量宏 (setvar, getvar, incvar, decvar 等)
   */
  private replaceVariableMacros(content: string, env: MacroEnv): string {
    let result = content;

    result = result.replace(
      /\{\{setvar::([^:}]+)::([^}]*)\}\}/gi,
      (_, name, value) => {
        this.localVariables.set(name, value);
        return "";
      },
    );

    result = result.replace(
      /\{\{setglobalvar::([^:}]+)::([^}]*)\}\}/gi,
      (_, name, value) => {
        this.globalVariables.set(name, value);
        return "";
      },
    );

    result = result.replace(/\{\{getvar::([^}]+)\}\}/gi, (_, name) => {
      const value = this.localVariables.get(name);
      return value !== undefined ? String(value) : "";
    });

    result = result.replace(/\{\{getglobalvar::([^}]+)\}\}/gi, (_, name) => {
      const value = this.globalVariables.get(name);
      return value !== undefined ? String(value) : "";
    });

    result = result.replace(/\{\{incvar::([^}]+)\}\}/gi, (_, name) => {
      const current = this.localVariables.get(name);
      const num = typeof current === "number" ? current : Number(current) || 0;
      this.localVariables.set(name, num + 1);
      return "";
    });

    result = result.replace(/\{\{decvar::([^}]+)\}\}/gi, (_, name) => {
      const current = this.localVariables.get(name);
      const num = typeof current === "number" ? current : Number(current) || 0;
      this.localVariables.set(name, num - 1);
      return "";
    });

    result = result.replace(/\{\{incglobalvar::([^}]+)\}\}/gi, (_, name) => {
      const current = this.globalVariables.get(name);
      const num = typeof current === "number" ? current : Number(current) || 0;
      this.globalVariables.set(name, num + 1);
      return "";
    });

    result = result.replace(/\{\{decglobalvar::([^}]+)\}\}/gi, (_, name) => {
      const current = this.globalVariables.get(name);
      const num = typeof current === "number" ? current : Number(current) || 0;
      this.globalVariables.set(name, num - 1);
      return "";
    });

    result = result.replace(
      /\{\{addvar::([^:}]+)::([^}]*)\}\}/gi,
      (_, name, value) => {
        const current = this.localVariables.get(name);
        if (current === undefined) {
          this.localVariables.set(name, value);
        } else if (this.isNumericValue(current) && this.isNumericValue(value)) {
          // 两边都是数字时才做数值加法
          this.localVariables.set(name, Number(current) + Number(value));
        } else {
          // 否则做字符串拼接
          this.localVariables.set(name, String(current) + value);
        }
        return "";
      },
    );

    result = result.replace(
      /\{\{addglobalvar::([^:}]+)::([^}]*)\}\}/gi,
      (_, name, value) => {
        const current = this.globalVariables.get(name);
        if (current === undefined) {
          this.globalVariables.set(name, value);
        } else if (this.isNumericValue(current) && this.isNumericValue(value)) {
          this.globalVariables.set(name, Number(current) + Number(value));
        } else {
          this.globalVariables.set(name, String(current) + value);
        }
        return "";
      },
    );

    return result;
  }

  /**
   * 判断值是否为有效数字（排除空白字符串）
   * 
   * JavaScript 的 Number(" ") 返回 0，这会导致空格被误判为数字
   * 此方法确保只有真正的数字才返回 true
   */
  private isNumericValue(value: string | number | undefined): boolean {
    if (value === undefined) return false;
    if (typeof value === "number") return true;
    // 排除空字符串和纯空白字符串
    const trimmed = String(value).trim();
    if (trimmed === "") return false;
    return !isNaN(Number(trimmed));
  }

  /**
   * 替换工具宏 (newline, trim, noop, input)
   */
  private replaceToolMacros(content: string): string {
    let result = content;

    result = result.replace(/\{\{newline\}\}/gi, "\n");
    result = result.replace(/\{\{noop\}\}/gi, "");

    // SillyTavern: /(?:\r?\n)*{{trim}}(?:\r?\n)*/gi - 删除 {{trim}} 及周围换行符
    result = result.replace(/(?:\r?\n)*\{\{trim\}\}(?:\r?\n)*/gi, "");

    return result;
  }

  /**
   * 替换骰子宏 {{roll X}}
   */
  private replaceRollMacro(content: string): string {
    return content.replace(/\{\{roll\s+(\d+)\}\}/gi, (_, sides) => {
      const max = parseInt(sides, 10);
      if (isNaN(max) || max < 1) return "";
      return String(Math.floor(Math.random() * max) + 1);
    });
  }

  /**
   * 清理模板噪声标签与占位符
   * - 去除 <content>/<length>/<word_count>/<context> 标签
   * - 去除 ${...} 包裹
   */
  private stripTemplateNoise(content: string): string {
    const withoutTags = content.replace(/<\/?(content|length|word_count|context)>/gi, "");
    return withoutTags.replace(/\$\{([^}]+)\}/g, "$1");
  }

  /* ─────────────────────────────────────────────────────────────────────────
     第二阶段：env 宏
     ───────────────────────────────────────────────────────────────────────── */

  private evaluateEnvMacros(content: string, env: MacroEnv): string {
    let result = content;

    // SillyTavern 使用 'gi' 标志（大小写不敏感）
    result = result.replace(/\{\{(\w+)\}\}/gi, (match, key) => {
      const lowerKey = key.toLowerCase();

      // 1. 优先检查局部变量（通过 setvar/addvar 设置的）
      if (this.localVariables.has(key)) {
        const value = this.localVariables.get(key);
        return value !== undefined ? String(value) : "";
      }
      // 也检查小写版本
      if (this.localVariables.has(lowerKey)) {
        const value = this.localVariables.get(lowerKey);
        return value !== undefined ? String(value) : "";
      }

      // 2. 检查全局变量
      if (this.globalVariables.has(key)) {
        const value = this.globalVariables.get(key);
        return value !== undefined ? String(value) : "";
      }
      if (this.globalVariables.has(lowerKey)) {
        const value = this.globalVariables.get(lowerKey);
        return value !== undefined ? String(value) : "";
      }

      // 3. 检查注册的宏（大小写不敏感）
      if (this.registeredMacros.has(lowerKey)) {
        const handler = this.registeredMacros.get(lowerKey)!;
        const value = handler([], env);
        return value !== undefined ? value : match;
      }

      // 4. 检查环境变量（大小写不敏感）
      for (const envKey of Object.keys(env)) {
        if (envKey.toLowerCase() === lowerKey) {
          const envValue = env[envKey];
          if (envValue !== undefined && envValue !== null) {
            return String(envValue);
          }
        }
      }

      return match;
    });

    return result;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     第三阶段：postEnv 宏
     ───────────────────────────────────────────────────────────────────────── */

  private evaluatePostEnvMacros(content: string, env: MacroEnv): string {
    let result = content;

    result = this.replaceTimeMacros(result);
    result = this.replaceMessageMacros(result, env);
    result = this.replaceRandomMacros(result);
    result = this.replaceCommentMacros(result);
    result = this.replaceReverseMacro(result);

    return result;
  }

  /**
   * 替换时间宏
   */
  private replaceTimeMacros(content: string): string {
    const now = new Date();

    return content
      .replace(/\{\{time\}\}/gi, () =>
        now.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        }),
      )
      .replace(/\{\{date\}\}/gi, () =>
        now.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      )
      .replace(/\{\{weekday\}\}/gi, () =>
        now.toLocaleDateString(undefined, { weekday: "long" }),
      )
      .replace(/\{\{isotime\}\}/gi, () =>
        now.toTimeString().split(" ")[0],
      )
      .replace(/\{\{isodate\}\}/gi, () =>
        now.toISOString().split("T")[0],
      )
      .replace(/\{\{datetimeformat\s+([^}]+)\}\}/gi, (_, format) => {
        try {
          return new Intl.DateTimeFormat(undefined, JSON.parse(format)).format(
            now,
          );
        } catch {
          return now.toISOString();
        }
      });
  }

  /**
   * 替换消息宏
   */
  private replaceMessageMacros(content: string, env: MacroEnv): string {
    return content
      .replace(/\{\{lastMessage\}\}/gi, () => env.lastMessage || "")
      .replace(/\{\{lastUserMessage\}\}/gi, () => env.lastUserMessage || "")
      .replace(/\{\{lastCharMessage\}\}/gi, () => env.lastCharMessage || "")
      .replace(/\{\{lastMessageId\}\}/gi, () =>
        env.lastMessageId !== undefined ? String(env.lastMessageId) : "",
      );
  }

  /**
   * 替换随机宏 {{random::a::b::c}} 或 {{random a,b,c}}
   */
  private replaceRandomMacros(content: string): string {
    let result = content;

    result = result.replace(/\{\{random::([^}]+)\}\}/gi, (_, options) => {
      const parts = options.split("::");
      if (parts.length === 0) return "";
      return parts[Math.floor(Math.random() * parts.length)];
    });

    result = result.replace(/\{\{random\s+([^}]+)\}\}/gi, (_, options) => {
      const parts = options.split(",").map((s: string) => s.trim());
      if (parts.length === 0) return "";
      return parts[Math.floor(Math.random() * parts.length)];
    });

    result = result.replace(/\{\{pick::([^}]+)\}\}/gi, (_, options) => {
      const parts = options.split("::");
      if (parts.length === 0) return "";
      const hash = this.simpleHash(options);
      return parts[hash % parts.length];
    });

    result = result.replace(/\{\{pick\s+([^}]+)\}\}/gi, (_, options) => {
      const parts = options.split(",").map((s: string) => s.trim());
      if (parts.length === 0) return "";
      const hash = this.simpleHash(options);
      return parts[hash % parts.length];
    });

    return result;
  }

  /**
   * 替换注释宏 {{// ...}}
   */
  private replaceCommentMacros(content: string): string {
    return content.replace(/\{\{\/\/[^}]*\}\}/g, "");
  }

  /**
   * 替换反转宏 {{reverse:TEXT}}
   */
  private replaceReverseMacro(content: string): string {
    return content.replace(/\{\{reverse:([^}]+)\}\}/gi, (_, text) => {
      return text.split("").reverse().join("");
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     宏注册
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * 注册自定义宏（SillyTavern 使用小写 key 存储）
   */
  registerMacro(name: string, handler: MacroHandler): void {
    this.registeredMacros.set(name.toLowerCase(), handler);
  }

  /**
   * 注销宏
   */
  unregisterMacro(name: string): boolean {
    return this.registeredMacros.delete(name.toLowerCase());
  }

  /**
   * 注册内置宏
   */
  private registerBuiltinMacros(): void {
    this.registerMacro("user", (_, env) => env.user);
    this.registerMacro("char", (_, env) => env.char);
    this.registerMacro("description", (_, env) => env.description);
    this.registerMacro("personality", (_, env) => env.personality);
    this.registerMacro("scenario", (_, env) => env.scenario);
    this.registerMacro("persona", (_, env) => env.persona);
    this.registerMacro("mesExamples", (_, env) => env.mesExamples);
    this.registerMacro("wiBefore", (_, env) => env.wiBefore);
    this.registerMacro("wiAfter", (_, env) => env.wiAfter);
    this.registerMacro("chatHistory", (_, env) => env.chatHistory);
    this.registerMacro("group", (_, env) => env.group);
    this.registerMacro("system", (_, env) => env.system);
    this.registerMacro("anchorBefore", (_, env) => env.anchorBefore);
    this.registerMacro("anchorAfter", (_, env) => env.anchorAfter);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     变量管理
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * 设置局部变量
   */
  setLocalVariable(name: string, value: string | number): void {
    this.localVariables.set(name, value);
  }

  /**
   * 获取局部变量
   */
  getLocalVariable(name: string): string | number | undefined {
    return this.localVariables.get(name);
  }

  /**
   * 设置全局变量
   */
  setGlobalVariable(name: string, value: string | number): void {
    this.globalVariables.set(name, value);
  }

  /**
   * 获取全局变量
   */
  getGlobalVariable(name: string): string | number | undefined {
    return this.globalVariables.get(name);
  }

  /**
   * 清空局部变量
   */
  clearLocalVariables(): void {
    this.localVariables.clear();
  }

  /**
   * 导出所有变量 (用于持久化)
   */
  exportVariables(): {
      local: Record<string, string | number>;
      global: Record<string, string | number>;
      } {
    return {
      local: Object.fromEntries(this.localVariables),
      global: Object.fromEntries(this.globalVariables),
    };
  }

  /**
   * 导入变量 (用于恢复)
   */
  importVariables(data: {
    local?: Record<string, string | number>;
    global?: Record<string, string | number>;
  }): void {
    if (data.local) {
      this.localVariables = new Map(Object.entries(data.local));
    }
    if (data.global) {
      this.globalVariables = new Map(Object.entries(data.global));
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     工具函数
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * 简单哈希函数 (用于 pick 宏的稳定选择)
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Handlebars 模板支持
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 简化的 Handlebars 条件渲染
 * 支持 {{#if var}}...{{/if}} 语法
 */
export function evaluateHandlebarsConditions(
  content: string,
  env: MacroEnv,
): string {
  let result = content;

  const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

  result = result.replace(ifRegex, (_, varName, innerContent) => {
    const value = env[varName];
    if (value !== undefined && value !== null && value !== "" && value !== false) {
      return innerContent;
    }
    return "";
  });

  const unlessRegex = /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g;

  result = result.replace(unlessRegex, (_, varName, innerContent) => {
    const value = env[varName];
    if (value === undefined || value === null || value === "" || value === false) {
      return innerContent;
    }
    return "";
  });

  return result;
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出单例和工厂函数
   ═══════════════════════════════════════════════════════════════════════════ */

let defaultEvaluator: STMacroEvaluator | null = null;

/**
 * 获取默认宏替换器实例
 */
export function getDefaultMacroEvaluator(): STMacroEvaluator {
  if (!defaultEvaluator) {
    defaultEvaluator = new STMacroEvaluator();
  }
  return defaultEvaluator;
}

/**
 * 创建新的宏替换器实例
 */
export function createMacroEvaluator(): STMacroEvaluator {
  return new STMacroEvaluator();
}

/**
 * 便捷函数：直接执行宏替换
 */
export function evaluateMacros(content: string, env: MacroEnv): string {
  return getDefaultMacroEvaluator().evaluate(content, env);
}
