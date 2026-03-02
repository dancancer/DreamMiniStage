/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command 模块入口                             ║
 * ║                                                                            ║
 * ║  统一导出解析器、执行器、注册表、调试监控                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// 类型导出
export type {
  SlashCommand,
  ParseResult,
  ExecutionResult,
  ExecutionContext,
  SendOptions,
  CommandHandler,
} from "./types";

export type {
  SlashDebugEvent,
  CommandStartEvent,
  CommandEndEvent,
  ControlSignalEvent,
  ScopeChangeEvent,
  ScriptLifecycleEvent,
  CommandStats,
} from "./core/debug";

// 解析器
export { parseSlashCommands, stringifySlashCommands } from "./parser";
export { parseKernelScript } from "./core/parser";

// 执行器
export { executeSlashCommands, executeSlashCommandScript, createMinimalContext } from "./executor";

// 注册表
export {
  COMMAND_REGISTRY,
  getCommandHandler,
  registerCommand,
  hasCommand,
  getRegisteredCommands,
} from "./registry";

// 调试监控
export {
  SlashDebugMonitor,
  getDebugMonitor,
  createDebugMonitor,
  createConsoleHandler,
  formatDebugEvent,
} from "./core/debug";
