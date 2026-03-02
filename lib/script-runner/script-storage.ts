/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Script Storage                                    ║
 * ║                                                                           ║
 * ║  三层脚本存储系统：                                                         ║
 * ║  • global     - 全局脚本（所有会话可用）                                     ║
 * ║  • preset     - 预设脚本（特定预设绑定）                                     ║
 * ║  • character  - 角色脚本（特定角色绑定）                                     ║
 * ║                                                                           ║
 * ║  脚本激活优先级：character > preset > global                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              类型定义
// ============================================================================

export type ScriptScope = "global" | "preset" | "character";

export interface ScriptMetadata {
  id: string;
  name: string;
  description?: string;
  scope: ScriptScope;
  scopeId?: string;
  enabled: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface StoredScript extends ScriptMetadata {
  content: string;
}

export interface ScriptButton {
  id: string;
  scriptId: string;
  label: string;
  icon?: string;
  visible: boolean;
  order: number;
}

export interface ScriptContext {
  characterId?: string;
  presetId?: string;
}

// ============================================================================
//                              存储管理器
// ============================================================================

const STORAGE_KEY = "DreamMiniStage:scripts";
const BUTTONS_STORAGE_KEY = "DreamMiniStage:script-buttons";

interface ScriptStore {
  global: Record<string, StoredScript>;
  preset: Record<string, Record<string, StoredScript>>;
  character: Record<string, Record<string, StoredScript>>;
}

interface ButtonStore {
  buttons: Record<string, ScriptButton[]>;
}

class ScriptStorageManager {
  private store: ScriptStore = {
    global: {},
    preset: {},
    character: {},
  };

  private buttonStore: ButtonStore = { buttons: {} };

  constructor() {
    this.loadFromStorage();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  持久化
  // ─────────────────────────────────────────────────────────────────────────

  private loadFromStorage(): void {
    if (typeof window === "undefined") return;
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) this.store = JSON.parse(data);

      const buttonData = localStorage.getItem(BUTTONS_STORAGE_KEY);
      if (buttonData) this.buttonStore = JSON.parse(buttonData);
    } catch (e) {
      console.warn("[ScriptStorage] 加载存储失败:", e);
    }
  }

  private saveToStorage(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    } catch (e) {
      console.warn("[ScriptStorage] 保存脚本失败:", e);
    }
  }

  private saveButtonsToStorage(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(BUTTONS_STORAGE_KEY, JSON.stringify(this.buttonStore));
    } catch (e) {
      console.warn("[ScriptStorage] 保存按钮失败:", e);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  脚本 CRUD
  // ─────────────────────────────────────────────────────────────────────────

  createScript(script: Omit<StoredScript, "id" | "createdAt" | "updatedAt" | "order">): StoredScript {
    const now = Date.now();
    const id = `script_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const order = this.getScriptsForScope(script.scope, script.scopeId).length;

    const newScript: StoredScript = {
      ...script,
      id,
      order,
      createdAt: now,
      updatedAt: now,
    };

    this.setScriptInStore(newScript);
    this.saveToStorage();
    return newScript;
  }

  getScript(id: string): StoredScript | undefined {
    // 搜索所有作用域
    if (this.store.global[id]) return this.store.global[id];

    for (const scopeScripts of Object.values(this.store.preset)) {
      if (scopeScripts[id]) return scopeScripts[id];
    }

    for (const scopeScripts of Object.values(this.store.character)) {
      if (scopeScripts[id]) return scopeScripts[id];
    }

    return undefined;
  }

  updateScript(id: string, updates: Partial<Omit<StoredScript, "id" | "createdAt">>): boolean {
    const script = this.getScript(id);
    if (!script) return false;

    const updated: StoredScript = {
      ...script,
      ...updates,
      id: script.id,
      createdAt: script.createdAt,
      updatedAt: Date.now(),
    };

    this.setScriptInStore(updated);
    this.saveToStorage();
    return true;
  }

  deleteScript(id: string): boolean {
    const script = this.getScript(id);
    if (!script) return false;

    this.removeScriptFromStore(script);
    this.saveToStorage();
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  作用域查询
  // ─────────────────────────────────────────────────────────────────────────

  getScriptsForScope(scope: ScriptScope, scopeId?: string): StoredScript[] {
    let scripts: StoredScript[];

    switch (scope) {
    case "global":
      scripts = Object.values(this.store.global);
      break;
    case "preset":
      scripts = scopeId ? Object.values(this.store.preset[scopeId] || {}) : [];
      break;
    case "character":
      scripts = scopeId ? Object.values(this.store.character[scopeId] || {}) : [];
      break;
    default:
      scripts = [];
    }

    return scripts.sort((a, b) => a.order - b.order);
  }

  getActiveScripts(ctx: ScriptContext): StoredScript[] {
    const active: StoredScript[] = [];

    // 全局脚本
    active.push(...this.getScriptsForScope("global").filter((s) => s.enabled));

    // 预设脚本
    if (ctx.presetId) {
      active.push(...this.getScriptsForScope("preset", ctx.presetId).filter((s) => s.enabled));
    }

    // 角色脚本
    if (ctx.characterId) {
      active.push(...this.getScriptsForScope("character", ctx.characterId).filter((s) => s.enabled));
    }

    return active.sort((a, b) => a.order - b.order);
  }

  toggleScript(id: string, enabled: boolean): boolean {
    return this.updateScript(id, { enabled });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  按钮管理
  // ─────────────────────────────────────────────────────────────────────────

  getButtons(ctx: ScriptContext): ScriptButton[] {
    const activeScripts = this.getActiveScripts(ctx);
    const buttons: ScriptButton[] = [];

    for (const script of activeScripts) {
      const scriptButtons = this.buttonStore.buttons[script.id] || [];
      buttons.push(...scriptButtons.filter((b) => b.visible));
    }

    return buttons.sort((a, b) => a.order - b.order);
  }

  setButtons(scriptId: string, buttons: ScriptButton[]): void {
    this.buttonStore.buttons[scriptId] = buttons;
    this.saveButtonsToStorage();
  }

  appendButton(scriptId: string, button: Omit<ScriptButton, "id" | "scriptId" | "order">): ScriptButton {
    const existing = this.buttonStore.buttons[scriptId] || [];
    const newButton: ScriptButton = {
      ...button,
      id: `btn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      scriptId,
      order: existing.length,
    };

    this.buttonStore.buttons[scriptId] = [...existing, newButton];
    this.saveButtonsToStorage();
    return newButton;
  }

  removeButton(scriptId: string, buttonId: string): boolean {
    const buttons = this.buttonStore.buttons[scriptId];
    if (!buttons) return false;

    this.buttonStore.buttons[scriptId] = buttons.filter((b) => b.id !== buttonId);
    this.saveButtonsToStorage();
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  内部辅助
  // ─────────────────────────────────────────────────────────────────────────

  private setScriptInStore(script: StoredScript): void {
    switch (script.scope) {
    case "global":
      this.store.global[script.id] = script;
      break;
    case "preset":
      if (!script.scopeId) break;
      this.store.preset[script.scopeId] ??= {};
      this.store.preset[script.scopeId][script.id] = script;
      break;
    case "character":
      if (!script.scopeId) break;
      this.store.character[script.scopeId] ??= {};
      this.store.character[script.scopeId][script.id] = script;
      break;
    }
  }

  private removeScriptFromStore(script: StoredScript): void {
    switch (script.scope) {
    case "global":
      delete this.store.global[script.id];
      break;
    case "preset":
      if (script.scopeId && this.store.preset[script.scopeId]) {
        delete this.store.preset[script.scopeId][script.id];
      }
      break;
    case "character":
      if (script.scopeId && this.store.character[script.scopeId]) {
        delete this.store.character[script.scopeId][script.id];
      }
      break;
    }

    // 清理按钮
    delete this.buttonStore.buttons[script.id];
    this.saveButtonsToStorage();
  }
}

// ============================================================================
//                              单例导出
// ============================================================================

export const scriptStorage = new ScriptStorageManager();

// ============================================================================
//                              便捷函数
// ============================================================================

export function getActiveScripts(ctx: ScriptContext): StoredScript[] {
  return scriptStorage.getActiveScripts(ctx);
}

export function getScriptButtons(ctx: ScriptContext): ScriptButton[] {
  return scriptStorage.getButtons(ctx);
}
