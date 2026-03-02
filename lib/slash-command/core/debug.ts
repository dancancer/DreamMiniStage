/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command 调试/监控                            ║
 * ║                                                                            ║
 * ║  提供命令执行的调试事件、错误追踪和性能监控                                    ║
 * ║  设计原则：非侵入式，通过事件系统与执行器解耦                                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { AstNode, ControlSignal } from "./types";

// ============================================================================
//                              事件类型
// ============================================================================

/**
 * 命令执行开始事件
 */
export interface CommandStartEvent {
  type: "command:start";
  timestamp: number;
  commandName: string;
  args: string[];
  namedArgs: Record<string, string>;
  pipe: string;
  raw: string;
}

/**
 * 命令执行完成事件
 */
export interface CommandEndEvent {
  type: "command:end";
  timestamp: number;
  commandName: string;
  duration: number;
  pipe: string;
  success: boolean;
  error?: string;
}

/**
 * 控制信号事件
 */
export interface ControlSignalEvent {
  type: "control:signal";
  timestamp: number;
  signal: ControlSignal;
  node: AstNode;
}

/**
 * 作用域变化事件
 */
export interface ScopeChangeEvent {
  type: "scope:push" | "scope:pop";
  timestamp: number;
  depth: number;
}

/**
 * 脚本执行开始/结束事件
 */
export interface ScriptLifecycleEvent {
  type: "script:start" | "script:end";
  timestamp: number;
  nodeCount?: number;
  totalDuration?: number;
  finalPipe?: string;
  aborted?: boolean;
}

export type SlashDebugEvent =
  | CommandStartEvent
  | CommandEndEvent
  | ControlSignalEvent
  | ScopeChangeEvent
  | ScriptLifecycleEvent;

// ============================================================================
//                              调试监视器
// ============================================================================

export type DebugEventHandler = (event: SlashDebugEvent) => void;

/**
 * 调试监视器
 * 收集命令执行过程中的各类事件
 */
export class SlashDebugMonitor {
  private handlers: DebugEventHandler[] = [];
  private enabled = false;
  private events: SlashDebugEvent[] = [];
  private maxEvents = 1000;

  /** 启用调试 */
  enable(): void {
    this.enabled = true;
  }

  /** 禁用调试 */
  disable(): void {
    this.enabled = false;
  }

  /** 检查是否启用 */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** 添加事件处理器 */
  addHandler(handler: DebugEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) this.handlers.splice(index, 1);
    };
  }

  /** 发射事件 */
  emit(event: SlashDebugEvent): void {
    if (!this.enabled) return;

    // 记录事件
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // 通知处理器
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error("[SlashDebugMonitor] Handler error:", err);
      }
    }
  }

  /** 获取最近的事件 */
  getRecentEvents(count = 100): SlashDebugEvent[] {
    return this.events.slice(-count);
  }

  /** 清空事件记录 */
  clearEvents(): void {
    this.events = [];
  }

  /** 获取命令执行统计 */
  getStats(): CommandStats {
    const stats: CommandStats = {
      totalCommands: 0,
      successCount: 0,
      errorCount: 0,
      avgDuration: 0,
      commandCounts: {},
    };

    let totalDuration = 0;
    for (const event of this.events) {
      if (event.type === "command:end") {
        stats.totalCommands++;
        totalDuration += event.duration;
        if (event.success) {
          stats.successCount++;
        } else {
          stats.errorCount++;
        }
        stats.commandCounts[event.commandName] =
          (stats.commandCounts[event.commandName] || 0) + 1;
      }
    }

    if (stats.totalCommands > 0) {
      stats.avgDuration = totalDuration / stats.totalCommands;
    }

    return stats;
  }
}

export interface CommandStats {
  totalCommands: number;
  successCount: number;
  errorCount: number;
  avgDuration: number;
  commandCounts: Record<string, number>;
}

// ============================================================================
//                              全局监视器实例
// ============================================================================

let globalMonitor: SlashDebugMonitor | null = null;

/**
 * 获取全局调试监视器
 */
export function getDebugMonitor(): SlashDebugMonitor {
  if (!globalMonitor) {
    globalMonitor = new SlashDebugMonitor();
  }
  return globalMonitor;
}

/**
 * 创建新的调试监视器
 */
export function createDebugMonitor(): SlashDebugMonitor {
  return new SlashDebugMonitor();
}

// ============================================================================
//                              辅助函数
// ============================================================================

/**
 * 创建命令开始事件
 */
export function createCommandStartEvent(
  commandName: string,
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
  raw: string,
): CommandStartEvent {
  return {
    type: "command:start",
    timestamp: Date.now(),
    commandName,
    args,
    namedArgs,
    pipe,
    raw,
  };
}

/**
 * 创建命令结束事件
 */
export function createCommandEndEvent(
  commandName: string,
  startTime: number,
  pipe: string,
  success: boolean,
  error?: string,
): CommandEndEvent {
  return {
    type: "command:end",
    timestamp: Date.now(),
    commandName,
    duration: Date.now() - startTime,
    pipe,
    success,
    error,
  };
}

/**
 * 创建控制信号事件
 */
export function createControlSignalEvent(
  signal: ControlSignal,
  node: AstNode,
): ControlSignalEvent {
  return {
    type: "control:signal",
    timestamp: Date.now(),
    signal,
    node,
  };
}

/**
 * 创建作用域变化事件
 */
export function createScopeChangeEvent(
  type: "scope:push" | "scope:pop",
  depth: number,
): ScopeChangeEvent {
  return {
    type,
    timestamp: Date.now(),
    depth,
  };
}

/**
 * 创建脚本生命周期事件
 */
export function createScriptLifecycleEvent(
  type: "script:start" | "script:end",
  options?: {
    nodeCount?: number;
    totalDuration?: number;
    finalPipe?: string;
    aborted?: boolean;
  },
): ScriptLifecycleEvent {
  return {
    type,
    timestamp: Date.now(),
    ...options,
  };
}

// ============================================================================
//                              控制台输出格式化
// ============================================================================

/**
 * 格式化调试事件为控制台输出
 */
export function formatDebugEvent(event: SlashDebugEvent): string {
  const time = new Date(event.timestamp).toISOString().split("T")[1].slice(0, 12);

  switch (event.type) {
  case "command:start":
    return `[${time}] ▶ /${event.commandName} ${event.args.join(" ")}`;
  case "command:end":
    return `[${time}] ${event.success ? "✓" : "✗"} /${event.commandName} (${event.duration}ms)${event.error ? ` - ${event.error}` : ""}`;
  case "control:signal":
    return `[${time}] ⚡ Signal: ${event.signal.kind}${event.signal.value ? ` = ${event.signal.value}` : ""}`;
  case "scope:push":
    return `[${time}] ↓ Scope push (depth: ${event.depth})`;
  case "scope:pop":
    return `[${time}] ↑ Scope pop (depth: ${event.depth})`;
  case "script:start":
    return `[${time}] ▶▶ Script start (${event.nodeCount || 0} nodes)`;
  case "script:end":
    return `[${time}] ◼◼ Script end (${event.totalDuration || 0}ms)${event.aborted ? " [ABORTED]" : ""}`;
  default:
    return `[${time}] Unknown event`;
  }
}

/**
 * 创建控制台日志处理器
 */
export function createConsoleHandler(): DebugEventHandler {
  return (event) => {
    console.log(formatDebugEvent(event));
  };
}
