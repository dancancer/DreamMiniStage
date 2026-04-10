/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║            WorldBook & Generation Command Handlers                        ║
 * ║                                                                           ║
 * ║  WorldBook命令 + 生成命令 (preset/regex/audio/gen等)                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

/* ─── WorldBook ─── */
export {
  handleGetEntry,
  handleSearchEntry,
  handleSetEntry,
  handleCreateEntry,
  handleDeleteEntry,
  handleActivateEntry,
  handleListEntries,
  handleWorldBook,
} from "./worldbook";

/* ─── Image / Model / Config / Regex ─── */
export {
  handleImagine,
  handleImagineSource,
  handleImagineStyle,
  handleImagineComfyWorkflow,
  handlePreset,
  handleStopStrings,
  handleModel,
  handleStartReplyWith,
  handleRerollPick,
  handleReasoningTemplate,
  handleInstruct,
  handleInstructOn,
  handleInstructOff,
  handleInstructState,
  handleContext,
  handleRegexPreset,
  handleRegex,
  handleRegexToggle,
} from "./model-config";

/* ─── Prompt Entry / Audio / Generation Core ─── */
export {
  handleListPresets,
  handleGetPromptEntry,
  handleSetPromptEntry,
  handleAudio,
  handlePlay,
  handleStop,
  handleGen,
  handleGenQuiet,
  handleGenRaw,
  handleSummarize,
  handleGenerateStop,
  handleInject,
  handleActivateLore,
} from "./core";
