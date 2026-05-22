/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command Registry                           ║
 * ║                                                                           ║
 * ║  命令清单按业务域拆分，index 只负责组装和公开注册表 API。                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "./types";
import { FOUNDATION_COMMAND_ENTRIES } from "./command-group-foundation";
import { CONVERSATION_COMMAND_ENTRIES } from "./command-group-conversation";
import { GENERATION_COMMAND_ENTRIES } from "./command-group-generation";
import { OPERATOR_COMMAND_ENTRIES } from "./command-group-operators";

const COMMAND_ENTRIES = [
  ...FOUNDATION_COMMAND_ENTRIES,
  ...CONVERSATION_COMMAND_ENTRIES,
  ...GENERATION_COMMAND_ENTRIES,
  ...OPERATOR_COMMAND_ENTRIES,
];

export const COMMAND_REGISTRY: Map<string, CommandHandler> = new Map(COMMAND_ENTRIES);

/** 获取命令处理器 */
export function getCommandHandler(name: string): CommandHandler | undefined {
  return COMMAND_REGISTRY.get(name.toLowerCase());
}

/** 注册新命令 */
export function registerCommand(name: string, handler: CommandHandler): void {
  COMMAND_REGISTRY.set(name.toLowerCase(), handler);
}

/** 检查命令是否存在 */
export function hasCommand(name: string): boolean {
  return COMMAND_REGISTRY.has(name.toLowerCase());
}

/** 获取所有已注册命令名 */
export function getRegisteredCommands(): string[] {
  return Array.from(COMMAND_REGISTRY.keys());
}
