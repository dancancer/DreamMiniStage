/**
 * SillyTavern 宏替换引擎
 *
 * 实现三阶段管线架构：
 * 1. preEnvMacros - 预处理宏（变量宏、工具宏）
 * 2. envMacros - 环境宏（用户名、角色名、注册宏）
 * 3. postEnvMacros - 后处理宏（时间、消息、随机选择）
 */

import type { MacroEnv, MacroHandler, MacroRegistry } from "./st-preset-types";

import {
  replaceVariableMacros,
  replaceToolMacros,
  replaceRollMacro,
  stripTemplateNoise,
  replaceTimeMacros,
  replaceMessageMacros,
  replaceRandomMacros,
  replaceCommentMacros,
  replaceReverseMacro,
  simpleHash,
} from "./st-macro-handlers";

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
    let result = stripTemplateNoise(content);

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

    result = replaceVariableMacros(result, env, this.localVariables, this.globalVariables);
    result = replaceToolMacros(result);
    result = replaceRollMacro(result);

    return result;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     注意：replaceLegacyPlaceholders() 已移除
     Legacy 占位符 (<USER>, <BOT>) 不再支持
     ───────────────────────────────────────────────────────────────────────── */

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

    result = replaceTimeMacros(result);
    result = replaceMessageMacros(result, env);
    result = replaceRandomMacros(result, simpleHash);
    result = replaceCommentMacros(result);
    result = replaceReverseMacro(result);

    return result;
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
