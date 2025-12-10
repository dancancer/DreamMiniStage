/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command 模块入口                             ║
 * ║                                                                            ║
 * ║  统一导出解析器、执行器、注册表                                              ║
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
