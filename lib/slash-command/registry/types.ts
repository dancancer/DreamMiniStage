/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  Slash Command Registry Types                             ║
 * ║                                                                           ║
 * ║  类型定义 - 从 types.ts 导入，保持兼容                                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";

export type { CommandHandler, ExecutionContext } from "../types";
export type CommandEntry = [name: string, handler: CommandHandler];
