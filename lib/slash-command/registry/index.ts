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
import * as CharacterHandlers from "./handlers/characters";
import * as GenerationHandlers from "./handlers/generation";
import * as OperatorHandlers from "./handlers/operators";
import * as JSSlashRunnerHandlers from "./handlers/js-slash-runner";
import * as ApiHandlers from "./handlers/api";
import * as FuzzyHandlers from "./handlers/fuzzy";
import * as ChatHandlers from "./handlers/chat";
import * as UtilityHandlers from "./handlers/utility";
import * as UiHandlers from "./handlers/ui";
import * as LoreHandlers from "./handlers/lore";
import * as DataBankHandlers from "./handlers/data-bank";
import * as ExpressionHandlers from "./handlers/expression";
import * as ExtensionHandlers from "./handlers/extensions";

/* ═══════════════════════════════════════════════════════════════════════════
   命令注册表 - 好品味：Map + 模块化
   ═══════════════════════════════════════════════════════════════════════════ */

export const COMMAND_REGISTRY: Map<string, CommandHandler> = new Map([
  // ─── 核心消息命令 ───
  ["send", CoreHandlers.handleSend],
  ["trigger", CoreHandlers.handleTrigger],
  ["sendas", CoreHandlers.handleSendAs],
  ["sys", CoreHandlers.handleSys],
  ["narrator", CoreHandlers.handleSys],
  ["impersonate", CoreHandlers.handleImpersonate],
  ["imp", CoreHandlers.handleImpersonate],
  ["continue", CoreHandlers.handleContinue],
  ["cont", CoreHandlers.handleContinue],
  ["swipe", CoreHandlers.handleSwipe],
  ["comment", CoreHandlers.handleSys],
  ["checkpoint-create", CoreHandlers.handleCheckpointCreate],
  ["branch-create", CoreHandlers.handleBranchCreate],
  ["checkpoint-get", CoreHandlers.handleCheckpointGet],
  ["checkpoint-list", CoreHandlers.handleCheckpointList],
  ["checkpoint-go", CoreHandlers.handleCheckpointGo],
  ["checkpoint-exit", CoreHandlers.handleCheckpointExit],
  ["checkpoint-parent", CoreHandlers.handleCheckpointParent],
  ["panels", UiHandlers.handlePanels],
  ["togglepanels", UiHandlers.handlePanels],
  ["bg", UiHandlers.handleBg],
  ["background", UiHandlers.handleBg],
  ["lockbg", UiHandlers.handleLockBg],
  ["bglock", UiHandlers.handleLockBg],
  ["unlockbg", UiHandlers.handleUnlockBg],
  ["bgunlock", UiHandlers.handleUnlockBg],
  ["autobg", UiHandlers.handleAutoBg],
  ["bgauto", UiHandlers.handleAutoBg],
  ["theme", UiHandlers.handleTheme],
  ["movingui", UiHandlers.handleMovingUi],
  ["css-var", UiHandlers.handleCssVar],
  ["vn", UiHandlers.handleVn],
  ["resetpanels", UiHandlers.handleResetPanels],
  ["resetui", UiHandlers.handleResetPanels],
  ["caption", UiHandlers.handleCaption],
  ["beep", UiHandlers.handleBeep],
  ["ding", UiHandlers.handleBeep],
  ["run", UtilityHandlers.handleRun],
  ["call", UtilityHandlers.handleRun],
  ["exec", UtilityHandlers.handleRun],
  ["closure-serialize", UtilityHandlers.handleClosureSerialize],
  ["closure-deserialize", UtilityHandlers.handleClosureDeserialize],
  ["lock", UtilityHandlers.handleLock],
  ["bind", UtilityHandlers.handleLock],
  ["trimtokens", UtilityHandlers.handleTrimTokens],
  ["reload-page", UtilityHandlers.handleReloadPage],
  ["delay", UtilityHandlers.handleDelay],
  ["wait", UtilityHandlers.handleDelay],
  ["sleep", UtilityHandlers.handleDelay],
  ["list-gallery", UtilityHandlers.handleListGallery],
  ["lg", UtilityHandlers.handleListGallery],
  ["clipboard-get", UtilityHandlers.handleClipboardGet],
  ["clipboard-set", UtilityHandlers.handleClipboardSet],
  ["data-bank", DataBankHandlers.handleDataBank],
  ["databank", DataBankHandlers.handleDataBank],
  ["db", DataBankHandlers.handleDataBank],
  ["data-bank-list", DataBankHandlers.handleDataBankList],
  ["databank-list", DataBankHandlers.handleDataBankList],
  ["db-list", DataBankHandlers.handleDataBankList],
  ["data-bank-get", DataBankHandlers.handleDataBankGet],
  ["databank-get", DataBankHandlers.handleDataBankGet],
  ["db-get", DataBankHandlers.handleDataBankGet],
  ["data-bank-add", DataBankHandlers.handleDataBankAdd],
  ["databank-add", DataBankHandlers.handleDataBankAdd],
  ["db-add", DataBankHandlers.handleDataBankAdd],
  ["data-bank-update", DataBankHandlers.handleDataBankUpdate],
  ["databank-update", DataBankHandlers.handleDataBankUpdate],
  ["db-update", DataBankHandlers.handleDataBankUpdate],
  ["data-bank-delete", DataBankHandlers.handleDataBankDelete],
  ["databank-delete", DataBankHandlers.handleDataBankDelete],
  ["db-delete", DataBankHandlers.handleDataBankDelete],
  ["data-bank-disable", DataBankHandlers.handleDataBankDisable],
  ["databank-disable", DataBankHandlers.handleDataBankDisable],
  ["db-disable", DataBankHandlers.handleDataBankDisable],
  ["data-bank-enable", DataBankHandlers.handleDataBankEnable],
  ["databank-enable", DataBankHandlers.handleDataBankEnable],
  ["db-enable", DataBankHandlers.handleDataBankEnable],
  ["data-bank-ingest", DataBankHandlers.handleDataBankIngest],
  ["databank-ingest", DataBankHandlers.handleDataBankIngest],
  ["db-ingest", DataBankHandlers.handleDataBankIngest],
  ["data-bank-purge", DataBankHandlers.handleDataBankPurge],
  ["databank-purge", DataBankHandlers.handleDataBankPurge],
  ["db-purge", DataBankHandlers.handleDataBankPurge],
  ["data-bank-search", DataBankHandlers.handleDataBankSearch],
  ["databank-search", DataBankHandlers.handleDataBankSearch],
  ["db-search", DataBankHandlers.handleDataBankSearch],
  ["api", ApiHandlers.handleApi],
  ["api-url", ApiHandlers.handleApiUrl],
  ["server", ApiHandlers.handleApiUrl],
  ["fuzzy", FuzzyHandlers.handleFuzzy],
  ["chat-manager", ChatHandlers.handleChatManager],
  ["chat-history", ChatHandlers.handleChatManager],
  ["manage-chats", ChatHandlers.handleChatManager],
  ["chat-reload", ChatHandlers.handleChatReload],
  ["getchatname", ChatHandlers.handleGetChatName],
  ["setinput", ChatHandlers.handleSetInput],
  ["member-get", ChatHandlers.handleGetMember],
  ["getmember", ChatHandlers.handleGetMember],
  ["memberget", ChatHandlers.handleGetMember],
  ["member-add", ChatHandlers.handleAddMember],
  ["addmember", ChatHandlers.handleAddMember],
  ["memberadd", ChatHandlers.handleAddMember],
  ["member-disable", ChatHandlers.handleDisableMember],
  ["disable", ChatHandlers.handleDisableMember],
  ["disablemember", ChatHandlers.handleDisableMember],
  ["memberdisable", ChatHandlers.handleDisableMember],
  ["member-enable", ChatHandlers.handleEnableMember],
  ["enable", ChatHandlers.handleEnableMember],
  ["enablemember", ChatHandlers.handleEnableMember],
  ["memberenable", ChatHandlers.handleEnableMember],
  ["addswipe", ChatHandlers.handleAddSwipe],
  ["reasoning-get", ChatHandlers.handleGetReasoning],
  ["get-reasoning", ChatHandlers.handleGetReasoning],
  ["reasoning-set", ChatHandlers.handleSetReasoning],
  ["set-reasoning", ChatHandlers.handleSetReasoning],
  ["listinjects", ChatHandlers.handleListInjects],
  ["chat-jump", ChatHandlers.handleChatJump],
  ["chat-scrollto", ChatHandlers.handleChatJump],
  ["chat-render", ChatHandlers.handleChatRender],
  ["delchat", ChatHandlers.handleDelChat],
  ["delmode", ChatHandlers.handleDelMode],
  ["delete", ChatHandlers.handleDelete],
  ["delname", ChatHandlers.handleDelName],
  ["cancel", ChatHandlers.handleDelName],
  ["delswipe", ChatHandlers.handleDelSwipe],
  ["swipedel", ChatHandlers.handleDelSwipe],
  ["expression-set", ExpressionHandlers.handleExpressionSet],
  ["sprite", ExpressionHandlers.handleExpressionSet],
  ["emote", ExpressionHandlers.handleExpressionSet],
  ["expression-folder-override", ExpressionHandlers.handleExpressionFolderOverride],
  ["spriteoverride", ExpressionHandlers.handleExpressionFolderOverride],
  ["costume", ExpressionHandlers.handleExpressionFolderOverride],
  ["expression-last", ExpressionHandlers.handleExpressionLast],
  ["lastsprite", ExpressionHandlers.handleExpressionLast],
  ["expression-list", ExpressionHandlers.handleExpressionList],
  ["expressions", ExpressionHandlers.handleExpressionList],
  ["expression-classify", ExpressionHandlers.handleExpressionClassify],
  ["classify", ExpressionHandlers.handleExpressionClassify],
  ["extension-enable", ExtensionHandlers.handleExtensionEnable],
  ["extension-disable", ExtensionHandlers.handleExtensionDisable],
  ["extension-toggle", ExtensionHandlers.handleExtensionToggle],
  ["extension-state", ExtensionHandlers.handleExtensionState],
  ["extension-exists", ExtensionHandlers.handleExtensionExists],
  ["extension-installed", ExtensionHandlers.handleExtensionExists],

  // ─── 工具命令 ───
  ["?", CoreHandlers.handleHelp],
  ["help", CoreHandlers.handleHelp],
  ["echo", CoreHandlers.handleEcho],
  ["pass", CoreHandlers.handlePass],
  ["return", CoreHandlers.handleReturn],

  // ─── 变量命令 ───
  ["setvar", VariableHandlers.handleSetVar],
  ["setchatvar", VariableHandlers.handleSetVar],
  ["setglobalvar", VariableHandlers.handleSetGlobalVar],
  ["getvar", VariableHandlers.handleGetVar],
  ["getchatvar", VariableHandlers.handleGetVar],
  ["getglobalvar", VariableHandlers.handleGetGlobalVar],
  ["delvar", VariableHandlers.handleDelVar],
  ["listvar", VariableHandlers.handleListVar],
  ["listchatvar", VariableHandlers.handleListVar],
  ["flushvar", VariableHandlers.handleFlushVar],
  ["flushchatvar", VariableHandlers.handleFlushVar],
  ["flushglobalvar", VariableHandlers.handleFlushGlobalVar],
  ["dumpvar", VariableHandlers.handleDumpVar],
  ["addvar", VariableHandlers.handleAddVar],
  ["addchatvar", VariableHandlers.handleAddVar],
  ["addglobalvar", VariableHandlers.handleAddGlobalVar],
  ["incvar", VariableHandlers.handleIncVar],
  ["incchatvar", VariableHandlers.handleIncVar],
  ["incglobalvar", VariableHandlers.handleIncGlobalVar],
  ["decvar", VariableHandlers.handleDecVar],
  ["decchatvar", VariableHandlers.handleDecVar],
  ["decglobalvar", VariableHandlers.handleDecGlobalVar],
  ["push", VariableHandlers.handlePush],

  // ─── 消息管理命令 ───
  ["getmessage", MessageHandlers.handleGetMessage],
  ["getmes", MessageHandlers.handleGetMessage],
  ["setmessage", MessageHandlers.handleEditMessage],
  ["setmes", MessageHandlers.handleEditMessage],
  ["editmessage", MessageHandlers.handleEditMessage],
  ["editmes", MessageHandlers.handleEditMessage],
  ["edit", MessageHandlers.handleEditMessage],
  ["delmessage", MessageHandlers.handleDelMessage],
  ["delmes", MessageHandlers.handleDelMessage],
  ["del", MessageHandlers.handleDelMessage],
  ["messages", MessageHandlers.handleMessages],
  ["mes", MessageHandlers.handleMessages],
  ["message", MessageHandlers.handleMessages],
  ["message-role", MessageHandlers.handleMessageRole],
  ["message-name", MessageHandlers.handleMessageName],
  ["messagecount", MessageHandlers.handleMessageCount],
  ["mescount", MessageHandlers.handleMessageCount],
  ["char", CharacterHandlers.handleCharacter],
  ["character", CharacterHandlers.handleCharacter],
  ["go", CharacterHandlers.handleCharacter],
  ["char-find", CharacterHandlers.handleCharacterFind],
  ["findchar", CharacterHandlers.handleCharacterFind],
  ["ask", CharacterHandlers.handleAsk],

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
  ["world", LoreHandlers.handleWorld],
  ["getcharbook", LoreHandlers.handleGetCharLore],
  ["getcharlore", LoreHandlers.handleGetCharLore],
  ["getcharwi", LoreHandlers.handleGetCharLore],
  ["getchatbook", LoreHandlers.handleGetChatLore],
  ["getchatlore", LoreHandlers.handleGetChatLore],
  ["getchatwi", LoreHandlers.handleGetChatLore],
  ["getglobalbooks", LoreHandlers.handleGetGlobalLore],
  ["getgloballore", LoreHandlers.handleGetGlobalLore],
  ["getglobalwi", LoreHandlers.handleGetGlobalLore],
  ["getpersonabook", LoreHandlers.handleGetPersonaLore],
  ["getpersonalore", LoreHandlers.handleGetPersonaLore],
  ["getpersonawi", LoreHandlers.handleGetPersonaLore],
  ["getlorefield", LoreHandlers.handleGetLoreField],
  ["getentryfield", LoreHandlers.handleGetLoreField],
  ["getwifield", LoreHandlers.handleGetLoreField],
  ["setlorefield", LoreHandlers.handleSetLoreField],
  ["setentryfield", LoreHandlers.handleSetLoreField],
  ["setwifield", LoreHandlers.handleSetLoreField],
  ["findentry", LoreHandlers.handleFindLore],
  ["findlore", LoreHandlers.handleFindLore],
  ["findwi", LoreHandlers.handleFindLore],
  ["createlore", LoreHandlers.handleCreateLore],
  ["createwi", LoreHandlers.handleCreateLore],
  ["vector-worldinfo-state", LoreHandlers.handleVectorWorldInfoState],

  // ─── 生成命令 ───
  ["gen", GenerationHandlers.handleGen],
  ["generate", GenerationHandlers.handleGen],
  ["genraw", GenerationHandlers.handleGenRaw],
  ["genq", GenerationHandlers.handleGenQuiet],
  ["generatequiet", GenerationHandlers.handleGenQuiet],
  ["generate-stop", GenerationHandlers.handleGenerateStop],
  ["inject", GenerationHandlers.handleInject],
  ["activatelore", GenerationHandlers.handleActivateLore],

  // ─── Preset 命令 ───
  ["preset", GenerationHandlers.handlePreset],
  ["context", GenerationHandlers.handleContext],
  ["listpresets", GenerationHandlers.handleListPresets],
  ["getpromptentry", GenerationHandlers.handleGetPromptEntry],
  ["getpromptentries", GenerationHandlers.handleGetPromptEntry],
  ["setpromptentry", GenerationHandlers.handleSetPromptEntry],
  ["setpromptentries", GenerationHandlers.handleSetPromptEntry],

  // ─── Regex 命令 ───
  ["regex", GenerationHandlers.handleRegex],
  ["regex-preset", GenerationHandlers.handleRegexPreset],
  ["regex-toggle", GenerationHandlers.handleRegexToggle],

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
  ["pow", OperatorHandlers.handlePow],
  ["max", OperatorHandlers.handleMax],
  ["min", OperatorHandlers.handleMin],
  ["rand", OperatorHandlers.handleRand],
  ["sin", OperatorHandlers.handleSin],
  ["cos", OperatorHandlers.handleCos],
  ["log", OperatorHandlers.handleLog],
  ["abs", OperatorHandlers.handleAbs],
  ["sqrt", OperatorHandlers.handleSqrt],
  ["round", OperatorHandlers.handleRound],
  ["len", OperatorHandlers.handleLen],
  ["trim", OperatorHandlers.handleTrim],
  ["split", OperatorHandlers.handleSplit],
  ["join", OperatorHandlers.handleJoin],
  ["replace", OperatorHandlers.handleReplace],
  ["re", OperatorHandlers.handleReplace],
  ["match", OperatorHandlers.handleMatch],

  // ─── JS-Slash-Runner 兼容命令 ───
  ["event-emit", JSSlashRunnerHandlers.handleEventEmit],
  ["eventemit", JSSlashRunnerHandlers.handleEventEmit],
  ["audioenable", JSSlashRunnerHandlers.handleAudioEnable],
  ["audioplay", JSSlashRunnerHandlers.handleAudioPlay],
  ["audioplaypause", JSSlashRunnerHandlers.handleAudioPlayPause],
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
