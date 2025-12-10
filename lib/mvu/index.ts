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

export {
  generateSchema,
  getSchemaForPath,
  validateSet,
  validateInsert,
  validateDelete,
  reconcileSchema,
  cleanupMeta,
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
  getNodeVariables,
  processMessageVariables,
  saveNodeVariables,
  initCharacterVariables,
} from "./data/persistence";
