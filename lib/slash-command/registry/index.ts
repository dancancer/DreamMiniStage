/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command Registry                             ║
 * ║                                                                            ║
 * ║  好品味：用 Map 消灭 switch/case，模块化组织命令处理器                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "./types";

// 导入所有命令处理器
import * as CoreHandlers from "./handlers/core";
import * as VariableHandlers from "./handlers/variables";
import * as MessageHandlers from "./handlers/messages";
import * as GenerationHandlers from "./handlers/generation";
import * as OperatorHandlers from "./handlers/operators";
import * as JSSlashRunnerHandlers from "./handlers/js-slash-runner";

/* ═══════════════════════════════════════════════════════════════════════════
   命令注册表 - 好品味：Map + 模块化
   ═══════════════════════════════════════════════════════════════════════════ */

export const COMMAND_REGISTRY: Map<string, CommandHandler> = new Map([
  // ─── 核心消息命令 ───
  ["send", CoreHandlers.handleSend],
  ["trigger", CoreHandlers.handleTrigger],
  ["sendas", CoreHandlers.handleSendAs],
  ["sys", CoreHandlers.handleSys],
  ["impersonate", CoreHandlers.handleImpersonate],
  ["continue", CoreHandlers.handleContinue],
  ["cont", CoreHandlers.handleContinue],
  ["swipe", CoreHandlers.handleSwipe],

  // ─── 工具命令 ───
  ["echo", CoreHandlers.handleEcho],
  ["pass", CoreHandlers.handlePass],
  ["return", CoreHandlers.handleReturn],

  // ─── 变量命令 ───
  ["setvar", VariableHandlers.handleSetVar],
  ["getvar", VariableHandlers.handleGetVar],
  ["delvar", VariableHandlers.handleDelVar],
  ["listvar", VariableHandlers.handleListVar],
  ["flushvar", VariableHandlers.handleFlushVar],
  ["dumpvar", VariableHandlers.handleDumpVar],
  ["incvar", VariableHandlers.handleIncVar],
  ["decvar", VariableHandlers.handleDecVar],
  ["push", VariableHandlers.handlePush],

  // ─── 消息管理命令 ───
  ["getmessage", MessageHandlers.handleGetMessage],
  ["getmes", MessageHandlers.handleGetMessage],
  ["editmessage", MessageHandlers.handleEditMessage],
  ["editmes", MessageHandlers.handleEditMessage],
  ["delmessage", MessageHandlers.handleDelMessage],
  ["delmes", MessageHandlers.handleDelMessage],
  ["messagecount", MessageHandlers.handleMessageCount],
  ["mescount", MessageHandlers.handleMessageCount],

  // ─── World Book 命令 ───
  ["getentry", GenerationHandlers.handleGetEntry],
  ["searchentry", GenerationHandlers.handleSearchEntry],
  ["setentry", GenerationHandlers.handleSetEntry],
  ["createentry", GenerationHandlers.handleCreateEntry],
  ["deleteentry", GenerationHandlers.handleDeleteEntry],
  ["delentry", GenerationHandlers.handleDeleteEntry],
  ["activateentry", GenerationHandlers.handleActivateEntry],
  ["listentries", GenerationHandlers.handleListEntries],
  ["worldbook", GenerationHandlers.handleWorldBook],
  ["wb", GenerationHandlers.handleWorldBook],

  // ─── 生成命令 ───
  ["gen", GenerationHandlers.handleGen],
  ["generate", GenerationHandlers.handleGen],
  ["genq", GenerationHandlers.handleGenQuiet],
  ["generatequiet", GenerationHandlers.handleGenQuiet],
  ["inject", GenerationHandlers.handleInject],
  ["activatelore", GenerationHandlers.handleActivateLore],

  // ─── Preset 命令 ───
  ["preset", GenerationHandlers.handlePreset],
  ["listpresets", GenerationHandlers.handleListPresets],

  // ─── Regex 命令 ───
  ["regex", GenerationHandlers.handleRegex],

  // ─── Audio 命令 ───
  ["audio", GenerationHandlers.handleAudio],
  ["play", GenerationHandlers.handlePlay],
  ["stop", GenerationHandlers.handleStop],

  // ─── 算子命令 ───
  ["add", OperatorHandlers.handleAdd],
  ["sub", OperatorHandlers.handleSub],
  ["mul", OperatorHandlers.handleMul],
  ["div", OperatorHandlers.handleDiv],
  ["mod", OperatorHandlers.handleMod],
  ["rand", OperatorHandlers.handleRand],
  ["len", OperatorHandlers.handleLen],
  ["trim", OperatorHandlers.handleTrim],
  ["split", OperatorHandlers.handleSplit],
  ["join", OperatorHandlers.handleJoin],
  ["replace", OperatorHandlers.handleReplace],
  ["re", OperatorHandlers.handleReplace],

  // ─── JS-Slash-Runner 兼容命令 ───
  ["event-emit", JSSlashRunnerHandlers.handleEventEmit],
  ["eventemit", JSSlashRunnerHandlers.handleEventEmit],
  ["audioenable", JSSlashRunnerHandlers.handleAudioEnable],
  ["audioplay", JSSlashRunnerHandlers.handleAudioPlay],
  ["audioimport", JSSlashRunnerHandlers.handleAudioImport],
  ["audioselect", JSSlashRunnerHandlers.handleAudioSelect],
  ["audiomode", JSSlashRunnerHandlers.handleAudioMode],
  ["audiopause", JSSlashRunnerHandlers.handleAudioPause],
  ["audioresume", JSSlashRunnerHandlers.handleAudioResume],
  ["audiostop", JSSlashRunnerHandlers.handleAudioStop],
  ["audiovolume", JSSlashRunnerHandlers.handleAudioVolume],
  ["audioqueue", JSSlashRunnerHandlers.handleAudioQueue],
  ["audioclear", JSSlashRunnerHandlers.handleAudioClear],
]);

/* ═══════════════════════════════════════════════════════════════════════════
   注册表操作 - 好品味：简洁直接的API
   ═══════════════════════════════════════════════════════════════════════════ */

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
