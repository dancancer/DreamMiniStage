/**
 * @input  (无外部依赖)
 * @output ScopedVariableManager, scopedVariables, parseVariableKey, VariableScope
 * @pos    多作用域变量管理 - 六层作用域优先级查找系统
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         多作用域变量管理                                    ║
 * ║                                                                            ║
 * ║  SillyTavern 兼容的变量作用域系统：                                          ║
 * ║  • global     - 全局变量（所有会话共享）                                     ║
 * ║  • character  - 角色变量（角色专属）                                        ║
 * ║  • chat       - 会话变量（当前对话专属）                                     ║
 * ║  • preset     - 预设变量（随预设保存）                                       ║
 * ║  • message    - 消息变量（特定消息专属）                                     ║
 * ║  • script     - 脚本变量（执行期间临时）                                     ║
 * ║                                                                            ║
 * ║  查找优先级：script > message > chat > character > preset > global         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              类型定义
// ============================================================================

/**
 * 变量作用域类型
 * 优先级从高到低排列
 */
export type VariableScope =
  | "script"     // 脚本临时变量（执行期间有效）
  | "message"    // 消息级变量
  | "chat"       // 会话级变量
  | "character"  // 角色级变量
  | "preset"     // 预设级变量
  | "global";    // 全局变量

/**
 * 作用域存储结构
 */
export interface ScopedVariableStore {
  global: Record<string, unknown>;
  preset: Record<string, Record<string, unknown>>;    // presetName -> vars
  character: Record<string, Record<string, unknown>>; // characterId -> vars
  chat: Record<string, Record<string, unknown>>;      // chatId -> vars
  message: Record<string, Record<string, unknown>>;   // messageId -> vars
  script: Record<string, unknown>;                    // 临时脚本变量
}

/**
 * 变量上下文（用于确定当前作用域）
 */
export interface VariableContext {
  characterId?: string;
  chatId?: string;
  messageId?: string;
  presetName?: string;
}

// ============================================================================
//                              作用域优先级
// ============================================================================

const SCOPE_PRIORITY: VariableScope[] = [
  "script",
  "message",
  "chat",
  "character",
  "preset",
  "global",
];

// ============================================================================
//                              作用域管理器
// ============================================================================

/**
 * 多作用域变量管理器
 * 好品味：用数据结构（优先级数组）消灭 if-else 分支
 */
export class ScopedVariableManager {
  private store: ScopedVariableStore = {
    global: {},
    preset: {},
    character: {},
    chat: {},
    message: {},
    script: {},
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  获取变量
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 获取变量值（按优先级查找）
   * @param key 变量名
   * @param ctx 上下文（用于确定作用域）
   * @param scope 指定作用域（可选，默认按优先级查找）
   */
  get(key: string, ctx: VariableContext, scope?: VariableScope): unknown {
    if (scope) {
      return this.getFromScope(key, scope, ctx);
    }

    // 按优先级遍历所有作用域
    for (const s of SCOPE_PRIORITY) {
      const value = this.getFromScope(key, s, ctx);
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  }

  /**
   * 从指定作用域获取变量
   */
  private getFromScope(key: string, scope: VariableScope, ctx: VariableContext): unknown {
    switch (scope) {
      case "global":
        return this.store.global[key];
      case "preset":
        return ctx.presetName ? this.store.preset[ctx.presetName]?.[key] : undefined;
      case "character":
        return ctx.characterId ? this.store.character[ctx.characterId]?.[key] : undefined;
      case "chat":
        return ctx.chatId ? this.store.chat[ctx.chatId]?.[key] : undefined;
      case "message":
        return ctx.messageId ? this.store.message[ctx.messageId]?.[key] : undefined;
      case "script":
        return this.store.script[key];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  设置变量
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 设置变量值
   * @param key 变量名
   * @param value 变量值
   * @param scope 作用域（默认 global）
   * @param ctx 上下文（用于确定作用域）
   */
  set(key: string, value: unknown, scope: VariableScope = "global", ctx: VariableContext = {}): boolean {
    switch (scope) {
      case "global":
        this.store.global[key] = value;
        return true;

      case "preset":
        if (!ctx.presetName) return false;
        this.store.preset[ctx.presetName] ??= {};
        this.store.preset[ctx.presetName][key] = value;
        return true;

      case "character":
        if (!ctx.characterId) return false;
        this.store.character[ctx.characterId] ??= {};
        this.store.character[ctx.characterId][key] = value;
        return true;

      case "chat":
        if (!ctx.chatId) return false;
        this.store.chat[ctx.chatId] ??= {};
        this.store.chat[ctx.chatId][key] = value;
        return true;

      case "message":
        if (!ctx.messageId) return false;
        this.store.message[ctx.messageId] ??= {};
        this.store.message[ctx.messageId][key] = value;
        return true;

      case "script":
        this.store.script[key] = value;
        return true;

      default:
        return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  删除变量
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 删除变量
   * @param key 变量名
   * @param scope 作用域（默认 global）
   * @param ctx 上下文
   */
  delete(key: string, scope: VariableScope = "global", ctx: VariableContext = {}): boolean {
    switch (scope) {
      case "global":
        delete this.store.global[key];
        return true;

      case "preset":
        if (!ctx.presetName || !this.store.preset[ctx.presetName]) return false;
        delete this.store.preset[ctx.presetName][key];
        return true;

      case "character":
        if (!ctx.characterId || !this.store.character[ctx.characterId]) return false;
        delete this.store.character[ctx.characterId][key];
        return true;

      case "chat":
        if (!ctx.chatId || !this.store.chat[ctx.chatId]) return false;
        delete this.store.chat[ctx.chatId][key];
        return true;

      case "message":
        if (!ctx.messageId || !this.store.message[ctx.messageId]) return false;
        delete this.store.message[ctx.messageId][key];
        return true;

      case "script":
        delete this.store.script[key];
        return true;

      default:
        return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  批量操作
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 获取指定作用域的所有变量
   */
  getAll(scope: VariableScope, ctx: VariableContext): Record<string, unknown> {
    switch (scope) {
      case "global":
        return { ...this.store.global };
      case "preset":
        return ctx.presetName ? { ...this.store.preset[ctx.presetName] } : {};
      case "character":
        return ctx.characterId ? { ...this.store.character[ctx.characterId] } : {};
      case "chat":
        return ctx.chatId ? { ...this.store.chat[ctx.chatId] } : {};
      case "message":
        return ctx.messageId ? { ...this.store.message[ctx.messageId] } : {};
      case "script":
        return { ...this.store.script };
    }
  }

  /**
   * 获取合并后的所有变量（按优先级覆盖）
   */
  getMerged(ctx: VariableContext): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // 从低优先级到高优先级合并（高优先级覆盖低优先级）
    for (let i = SCOPE_PRIORITY.length - 1; i >= 0; i--) {
      const scope = SCOPE_PRIORITY[i];
      Object.assign(result, this.getAll(scope, ctx));
    }

    return result;
  }

  /**
   * 清空指定作用域
   */
  clear(scope: VariableScope, ctx: VariableContext = {}): void {
    switch (scope) {
      case "global":
        this.store.global = {};
        break;
      case "preset":
        if (ctx.presetName) {
          delete this.store.preset[ctx.presetName];
        }
        break;
      case "character":
        if (ctx.characterId) {
          delete this.store.character[ctx.characterId];
        }
        break;
      case "chat":
        if (ctx.chatId) {
          delete this.store.chat[ctx.chatId];
        }
        break;
      case "message":
        if (ctx.messageId) {
          delete this.store.message[ctx.messageId];
        }
        break;
      case "script":
        this.store.script = {};
        break;
    }
  }

  /**
   * 清空脚本变量（每次脚本执行结束后调用）
   */
  clearScriptScope(): void {
    this.store.script = {};
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  快照与恢复
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 获取存储快照（用于持久化）
   */
  getSnapshot(): ScopedVariableStore {
    return JSON.parse(JSON.stringify(this.store));
  }

  /**
   * 从快照恢复
   */
  restoreFromSnapshot(snapshot: ScopedVariableStore): void {
    this.store = JSON.parse(JSON.stringify(snapshot));
  }
}

// ============================================================================
//                              单例实例
// ============================================================================

export const scopedVariables = new ScopedVariableManager();

// ============================================================================
//                              工具函数
// ============================================================================

/**
 * 解析作用域字符串
 * 支持 SillyTavern 风格的 scope:key 格式
 * 例如: "global:myVar", "chat:counter", "myVar"（默认 global）
 */
export function parseVariableKey(input: string): { scope: VariableScope; key: string } {
  const colonIndex = input.indexOf(":");
  if (colonIndex === -1) {
    return { scope: "global", key: input };
  }

  const scopeStr = input.slice(0, colonIndex).toLowerCase();
  const key = input.slice(colonIndex + 1);

  const validScopes: VariableScope[] = ["global", "preset", "character", "chat", "message", "script"];
  if (validScopes.includes(scopeStr as VariableScope)) {
    return { scope: scopeStr as VariableScope, key };
  }

  // 无效作用域，整体作为 key
  return { scope: "global", key: input };
}
