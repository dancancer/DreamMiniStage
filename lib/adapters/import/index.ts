/* ═══════════════════════════════════════════════════════════════════════════
   导入适配器模块导出
   ═══════════════════════════════════════════════════════════════════════════ */

export {
  ImportError,
  NoAdapterMatchError,
  type ImportAdapter,
  type ImportPipeline,
  createImportPipeline,
  isNonNullObject,
  hasArrayProperty,
} from "./types";

export {
  regexImportPipeline,
  importRegexScripts,
  canImportRegexScripts,
  arrayAdapter as regexArrayAdapter,
  scriptsWrapperAdapter as regexScriptsWrapperAdapter,
  regexScriptsWrapperAdapter as regexRegexScriptsWrapperAdapter,
  singleScriptAdapter as regexSingleScriptAdapter,
} from "./regex-import";

export {
  presetImportPipeline,
  importPreset,
  canImportPreset,
  convertLegacyPlaceholders,
  hasLegacyPlaceholders,
  convertPromptOrder,
  normalizePreset,
  standardPresetAdapter,
  type NormalizedPreset,
  type NormalizedPresetPrompt,
} from "./preset-import";

export {
  worldBookImportPipeline,
  importWorldBookEntries,
  canImportWorldBook,
  normalizeWorldBookEntry,
  hasLegacyFields,
  entriesWrapperAdapter,
  arrayAdapter as worldBookArrayAdapter,
  worldBookWrapperAdapter,
  singleEntryAdapter,
  type NormalizedWorldBookEntry,
} from "./worldbook-import";
