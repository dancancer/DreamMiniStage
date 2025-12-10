/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 类型定义                                       ║
 * ║                                                                            ║
 * ║  MagVarUpdate 变量管理系统的核心类型                                         ║
 * ║  设计原则：类型即文档，让数据结构自解释                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              基础类型
// ============================================================================

/** JSON 原始类型 */
export type JSONPrimitive = string | number | boolean | null;

/** 带描述的值 - [实际值, 更新条件描述] */
export type ValueWithDescription<T> = [T, string];

// ============================================================================
//                              状态数据类型
// ============================================================================

/** 状态数据元信息 */
export type StatDataMeta = {
  extensible?: boolean;
  recursiveExtensible?: boolean;
  required?: string[];
  template?: StatData | StatData[];
};

/** 状态数据 - 支持嵌套对象和数组 */
export type StatData = {
  [key: string]: StatData | JSONPrimitive | (StatData | JSONPrimitive)[];
} & {
  $meta?: StatDataMeta;
};

// ============================================================================
//                              Schema 类型
// ============================================================================

export type SchemaNode = ObjectSchemaNode | ArraySchemaNode | PrimitiveSchemaNode;

export type ObjectSchemaNode = {
  type: "object";
  properties: Record<string, SchemaNode & { required?: boolean }>;
  extensible?: boolean;
  template?: StatData | StatData[];
  recursiveExtensible?: boolean;
};

export type ArraySchemaNode = {
  type: "array";
  elementType: SchemaNode;
  extensible?: boolean;
  template?: StatData | StatData[];
  recursiveExtensible?: boolean;
};

export type PrimitiveSchemaNode = {
  type: "string" | "number" | "boolean" | "any";
};

// ============================================================================
//                              MVU 数据结构
// ============================================================================

/** MVU 完整数据结构 */
export interface MvuData {
  /** 已初始化的世界书列表 */
  initialized_lorebooks?: Record<string, unknown[]>;

  /** 状态数据 - 存储实际的变量值 */
  stat_data: StatData;

  /** 显示数据 - 变量变化的可视化表示 */
  display_data?: Record<string, unknown>;

  /** 增量数据 - 本次更新中发生变化的变量 */
  delta_data?: Record<string, unknown>;

  /** 数据结构模式 */
  schema?: ObjectSchemaNode;
}

// ============================================================================
//                              命令类型
// ============================================================================

/** 支持的命令名称 */
export type CommandName = "set" | "insert" | "assign" | "remove" | "unset" | "delete" | "add";

/** 解析后的命令 */
export interface MvuCommand {
  type: CommandName;
  fullMatch: string;
  args: string[];
  reason: string;
}

/** 命令执行结果 */
export interface CommandResult {
  success: boolean;
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
  error?: string;
}

// ============================================================================
//                              事件类型
// ============================================================================

export const MVU_EVENTS = {
  VARIABLE_INITIALIZED: "mvu:variable_initialized",
  VARIABLE_UPDATED: "mvu:variable_updated",
  UPDATE_STARTED: "mvu:update_started",
  UPDATE_ENDED: "mvu:update_ended",
  COMMAND_PARSED: "mvu:command_parsed",
} as const;

export type MvuEventName = typeof MVU_EVENTS[keyof typeof MVU_EVENTS];

// ============================================================================
//                              类型守卫
// ============================================================================

export function isValueWithDescription(value: unknown): value is ValueWithDescription<unknown> {
  return Array.isArray(value) && value.length === 2 && typeof value[1] === "string";
}

export function isArraySchema(node: SchemaNode): node is ArraySchemaNode {
  return node.type === "array";
}

export function isObjectSchema(node: SchemaNode): node is ObjectSchemaNode {
  return node.type === "object";
}

export function isPrimitiveSchema(node: SchemaNode): node is PrimitiveSchemaNode {
  return ["string", "number", "boolean", "any"].includes(node.type);
}
