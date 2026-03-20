/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 模块入口                                       ║
 * ║                                                                            ║
 * ║  MagVarUpdate 变量管理系统                                                  ║
 * ║  统一导出所有公共 API                                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              类型导出
// ============================================================================

export type {
  JSONPrimitive,
  ValueWithDescription,
  ValueWithDescriptionArray,
  ValueWithDescriptionUnion,
  StatData,
  StatDataMeta,
  SchemaNode,
  ObjectSchemaNode,
  ArraySchemaNode,
  PrimitiveSchemaNode,
  MvuData,
  CommandName,
  MvuCommand,
  CommandResult,
  MvuEventName,
} from "./types";

export {
  MVU_EVENTS,
  isValueWithDescription,
  isValueWithDescriptionArray,
  isValueWithDescriptionObject,
  getVWDValue,
  getVWDDescription,
  setVWDValue,
  isArraySchema,
  isObjectSchema,
  isPrimitiveSchema,
} from "./types";

// ============================================================================
//                              核心模块导出
// ============================================================================

export {
  extractCommands,
  parseCommandValue,
  fixPath,
  trimQuotes,
} from "./core/parser";

export type { UpdateResult } from "./core/executor";

export {
  updateVariablesFromMessage,
  updateSingleVariable,
} from "./core/executor";

export type { ValidationResult } from "./core/schema";

export {
  generateSchema,
  getSchemaForPath,
  validateSet,
  validateInsert,
  validateDelete,
  reconcileSchema,
  cleanupMeta,
  inferType,
  validateValue,
  toJsonSchema,
  fromJsonSchema,
} from "./core/schema";

// ============================================================================
//                              数据模块导出
// ============================================================================

export type { TemplateType, ApplyTemplateOptions } from "./data/template";

export { applyTemplate } from "./data/template";

export {
  useMvuStore,
  getSessionKey,
  safeGetValue,
} from "./data/store";

export {
  getCharacterVariables,
  getCurrentMvuTrace,
  getNodeVariables,
  getNodeMvuTrace,
  processMessageVariables,
  saveNodeVariables,
  initCharacterVariables,
  initMvuVariablesFromWorldBooks,
} from "./data/persistence";

// ============================================================================
//                              额外模型解析导出
// ============================================================================

export type {
  ExtraModelConfig,
  ExtraModelRequestOptions,
  ExtraModelResponse,
  GenerateOptions,
  ToolCallResult,
} from "./extra-model";

export {
  ExtraModelParser,
  createExtraModelParser,
  hasVariableUpdateMarker,
  hasPlotMarker,
  shouldUseExtraModel,
  buildExtraModelPrompt,
  MVU_FUNCTION_SCHEMA,
  EXTRA_MODEL_PROMPT,
  DEFAULT_EXTRA_MODEL_CONFIG,
} from "./extra-model";

// ============================================================================
//                              函数调用模式导出
// ============================================================================

export type {
  ToolFunction,
  OpenAITool,
  ToolCall,
  ToolCallBatch,
  ToolCallBatches,
  MvuFunctionCallArgs,
  FunctionCallResult,
  FunctionCallManagerConfig,
} from "./function-call";

export {
  MVU_FUNCTION_NAME,
  MVU_VARIABLE_UPDATE_FUNCTION,
  getMvuTool,
  extractMvuToolCall,
  functionCallToUpdateContent,
  executeMvuFunctionCall,
  FunctionCallManager,
  createFunctionCallManager,
  isFunctionCallingSupported,
  buildFunctionCallRequest,
} from "./function-call";

// ============================================================================
//                              JSON Patch 导出
// ============================================================================

export type {
  PatchOperation,
  AddOperation,
  RemoveOperation,
  ReplaceOperation,
  MoveOperation,
  CopyOperation,
  TestOperation,
  PatchResult,
  ApplyPatchResult,
} from "./json-patch";

export {
  parseJsonPointer,
  toJsonPointer,
  dotPathToPointer,
  pointerToDotPath,
  getValueByPointer,
  applyOperation,
  applyPatch,
  validatePatch,
  extractJsonPatch,
  patchToMvuCommands,
  createPatch,
} from "./json-patch";

// ============================================================================
//                              变量快照导出
// ============================================================================

export type {
  VariableSnapshot,
  SnapshotDiff,
  DiffEntry,
  SnapshotManagerConfig,
} from "./snapshot";

export {
  SnapshotManager,
  createSnapshotManager,
  quickSnapshot,
  quickDiff,
  hasChanges,
  formatDiff,
} from "./snapshot";

// ============================================================================
//                              数学表达式求值导出
// ============================================================================

export type { EvalResult, VariableContext } from "./math-eval";

export {
  evaluate,
  safeEvaluate,
  isValidExpression,
  buildContext,
  replaceExpressions,
} from "./math-eval";

// ============================================================================
//                              自动清理导出
// ============================================================================

export type {
  CleanupConfig,
  CleanupResult,
  FloorVariableRecord,
} from "./auto-cleanup";

export {
  DEFAULT_CLEANUP_CONFIG,
  AutoCleanupManager,
  createCleanupManager,
  cleanupOldFloors,
  isVariableExpired,
} from "./auto-cleanup";

// ============================================================================
//                              变量初始化导出
// ============================================================================

export type {
  WorldBookEntry,
  InitResult,
  InitConfig,
} from "./variable-init";

export {
  isInitVarEntry,
  extractInitVarFromEntry,
  extractInitVarFromWorldBook,
  extractInitVarFromGreeting,
  hasInitVarBlock,
  createEmptyMvuData,
  loadInitVarFromWorldBooks,
  applyGreetingOverride,
  initializeVariables,
  updateDescriptions,
  isVariablesInitialized,
  getInitializedWorldBooks,
  isWorldBookInitialized,
} from "./variable-init";

// ============================================================================
//                              世界书过滤导出
// ============================================================================

export type {
  WorldBookFilterConfig,
  FilteredWorldBookResult,
} from "./worldbook-filter";

export {
  MVU_MARKERS,
  hasMarker,
  filterWorldBookForMainModel,
  filterWorldBookForExtraModel,
  filterWorldBook,
  shouldUseExtraModelByWorldBook,
  extractMarkersFromEntry,
} from "./worldbook-filter";

// ============================================================================
//                              楼层重演导出
// ============================================================================

export type {
  FloorMessage,
  ReplayConfig,
  ReplayResult,
  FloorOperation,
  FloorManagerConfig,
} from "./floor-replay";

export {
  replayFloors,
  findLastValidSnapshot,
  FloorManager,
  createFloorManager,
} from "./floor-replay";

// ============================================================================
//                              楼层管理 UI 导出
// ============================================================================

export type {
  FloorDisplayInfo,
  FloorOperationContext,
  FloorOperationResult,
  ReplayProgressCallback,
  FloorManagementState,
} from "./floor-management";

export {
  getFloorDisplayInfo,
  getAllFloorDisplayInfo,
  recalculateFromFloor,
  resetToFloor,
  compareFloorVariables,
  createInitialFloorManagementState,
  canReplayFromFloor,
  getFloorVariableSummary,
  formatVariableForDisplay,
  createUIFloorManager,
} from "./floor-management";
