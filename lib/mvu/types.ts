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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ValueWithDescription 格式兼容性说明
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * MagVarUpdate 使用数组格式：[value, description]
 * 例如：["03月15日", "今天的日期，格式为 mm月dd日"]
 *
 * 为了完全兼容 MagVarUpdate，我们支持两种格式：
 * 1. 数组格式（MagVarUpdate 原生）：[value, description]
 * 2. 对象格式（可选）：{ value, description }
 *
 * 数组格式检查：Array.isArray(v) && v.length === 2 && typeof v[1] === 'string'
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 带描述的值 - 对象格式（可选） */
export interface ValueWithDescription<T = unknown> {
  value: T;
  description: string;
}

/**
 * 带描述的值 - 数组格式（MagVarUpdate 兼容）
 * [value, description]
 */
export type ValueWithDescriptionArray<T = unknown> = [T, string];

/**
 * 统一类型：支持两种格式
 */
export type ValueWithDescriptionUnion<T = unknown> =
  | ValueWithDescription<T>
  | ValueWithDescriptionArray<T>;

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
  /** 命令类型（内部使用） */
  type: CommandName;
  /** 命令名称（SillyTavern 兼容别名，同 type） */
  name: CommandName;
  /** 原始匹配文本 */
  fullMatch: string;
  /** 原始参数数组 */
  args: string[];
  /** 注释/原因 */
  reason: string;
  // ═══════════════════════════════════════════════════════════════════════════
  // SillyTavern 兼容字段（从 args 解析）
  // ═══════════════════════════════════════════════════════════════════════════
  /** 变量路径 */
  path: string;
  /** 旧值（set 命令的第二个参数，如果有三个参数的话） */
  oldValue?: unknown;
  /** 新值（set 命令的最后一个参数） */
  newValue?: unknown;
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

/**
 * 检查是否为 ValueWithDescription（数组格式 - MagVarUpdate 兼容）
 * 格式：[value, description]
 */
export function isValueWithDescriptionArray(value: unknown): value is ValueWithDescriptionArray<unknown> {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[1] === "string" &&
    // 确保不是空数组或特殊数组，value[0] 不能是 object（避免误判普通数组）
    (typeof value[0] !== "object" || value[0] === null || value[0] instanceof Date)
  );
}

/**
 * 检查是否为 ValueWithDescription（对象格式）
 */
export function isValueWithDescriptionObject(value: unknown): value is ValueWithDescription<unknown> {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return "value" in candidate && "description" in candidate && typeof candidate.description === "string";
}

/**
 * 检查是否为 ValueWithDescription（任意格式）
 * 优先检查数组格式（MagVarUpdate 主要格式）
 */
export function isValueWithDescription(value: unknown): value is ValueWithDescriptionUnion<unknown> {
  return isValueWithDescriptionArray(value) || isValueWithDescriptionObject(value);
}

/**
 * 获取 ValueWithDescription 的实际值（兼容两种格式）
 */
export function getVWDValue(vwd: ValueWithDescriptionUnion<unknown>): unknown {
  if (Array.isArray(vwd)) return vwd[0];
  return vwd.value;
}

/**
 * 获取 ValueWithDescription 的描述（兼容两种格式）
 */
export function getVWDDescription(vwd: ValueWithDescriptionUnion<unknown>): string {
  if (Array.isArray(vwd)) return vwd[1];
  return vwd.description;
}

/**
 * 设置 ValueWithDescription 的值（兼容两种格式）
 */
export function setVWDValue(vwd: ValueWithDescriptionUnion<unknown>, newValue: unknown): void {
  if (Array.isArray(vwd)) {
    vwd[0] = newValue;
  } else {
    vwd.value = newValue;
  }
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
