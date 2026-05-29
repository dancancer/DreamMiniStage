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
  IMPORTED_ASSET_BUNDLE_SCHEMA_VERSION,
  type AssetSource,
  type AssetSourceKind,
  type ExtensionArtifactKind,
  type FieldProvenance,
  type ImportedAssetBundle,
  type ImportedCharacterProfile,
  type ImportedExtensionArtifact,
  type ImportedPreset,
  type ImportedPromptFragment,
  type ImportedRegexScript,
  type ImportedWorldBook,
  type ImportedWorldBookEntry,
  type ImportDiagnostic,
  type ImportDiagnosticSeverity,
  type UnsupportedArtifact,
} from "./bundle-types";

export {
  createImportedAssetBundle,
  type CreateImportedAssetBundleInput,
} from "./bundle-builder";

export {
  diagnoseImportedAssetBundle,
  summarizeDiagnostics,
  type DiagnosticSummary,
  type ImportDiagnosticCode,
} from "./bundle-diagnostics";

export {
  HIGH_RISK_PATHS,
  REPAIR_RISK_RULES,
  RepairPatchValidationError,
  applyAutoRepairPatch,
  computeRepairRisk,
  importDiagnosticSchema,
  llmQaInputSchema,
  llmQaOutputSchema,
  repairOperationSchema,
  repairPatchSchema,
  repairRiskSchema,
  validateRepairOutput,
  validateRepairPatch,
  type LlmQaInput,
  type LlmQaOutput,
  type RepairOperation,
  type RepairPatch,
  type RepairRisk,
  type RepairRiskRule,
  type ValidatedRepairPatch,
} from "./repair-patch";

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
