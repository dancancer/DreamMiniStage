/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  Slash Command Registry - Re-export                       ║
 * ║                                                                           ║
 * ║  向后兼容导出 - 保持原有 API 不变                                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

export * from "./registry/index";
export {
  COMMAND_REGISTRY,
  getCommandHandler,
  registerCommand,
  hasCommand,
  getRegisteredCommands,
} from "./registry/index";
