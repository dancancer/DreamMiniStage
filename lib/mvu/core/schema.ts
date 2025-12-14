/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU Schema 系统                                    ║
 * ║                                                                            ║
 * ║  数据结构验证与模式生成                                                      ║
 * ║  设计原则：Schema 即契约，防止非法修改                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  SchemaNode,
  ObjectSchemaNode,
  ArraySchemaNode,
  StatData,
  MvuData,
} from "../types";
import { isArraySchema, isObjectSchema } from "../types";

// ============================================================================
//                              Schema 生成
// ============================================================================

/**
 * 从数据生成 Schema
 * 递归遍历数据结构，推断类型并生成对应的 Schema 节点
 */
export function generateSchema(
  data: unknown,
  oldSchema?: SchemaNode,
  parentRecursiveExtensible = false,
): SchemaNode {
  // 数组类型
  if (Array.isArray(data)) {
    return generateArraySchema(data, oldSchema, parentRecursiveExtensible);
  }

  // 对象类型
  if (isPlainObject(data)) {
    return generateObjectSchema(data as StatData, oldSchema, parentRecursiveExtensible);
  }

  // 原始类型
  return generatePrimitiveSchema(data);
}

/** 生成数组 Schema */
function generateArraySchema(
  data: unknown[],
  oldSchema?: SchemaNode,
  parentRecursiveExtensible = false,
): ArraySchemaNode {
  let extensible = parentRecursiveExtensible;
  let recursiveExtensible = parentRecursiveExtensible;
  let oldElementType: SchemaNode | undefined;
  let template: StatData | StatData[] | undefined;

  // 继承旧 Schema 的元数据
  if (oldSchema && isArraySchema(oldSchema)) {
    extensible = oldSchema.extensible ?? extensible;
    recursiveExtensible = oldSchema.recursiveExtensible ?? recursiveExtensible;
    oldElementType = oldSchema.elementType;
    template = oldSchema.template;
  }

  // 检查 $meta 元素
  const metaIndex = data.findIndex(
    (item) => isPlainObject(item) && "$arrayMeta" in item && "$meta" in item,
  );

  if (metaIndex !== -1) {
    const metaElement = data[metaIndex] as { $meta: StatData };
    if (metaElement.$meta.extensible !== undefined) {
      extensible = Boolean(metaElement.$meta.extensible);
    }
    if (metaElement.$meta.template !== undefined) {
      template = metaElement.$meta.template as StatData | StatData[];
    }
    data.splice(metaIndex, 1);
  }

  const childExtensible = extensible && recursiveExtensible;

  return {
    type: "array",
    extensible: extensible || parentRecursiveExtensible,
    recursiveExtensible,
    elementType: data.length > 0
      ? generateSchema(data[0], oldElementType, childExtensible)
      : { type: "any" },
    ...(template && { template }),
  };
}

/** 生成对象 Schema */
function generateObjectSchema(
  data: StatData,
  oldSchema?: SchemaNode,
  parentRecursiveExtensible = false,
): ObjectSchemaNode {
  let extensible = parentRecursiveExtensible;
  let recursiveExtensible = parentRecursiveExtensible;
  let oldProperties: ObjectSchemaNode["properties"] | undefined;
  let template: StatData | StatData[] | undefined;

  // 继承旧 Schema
  if (oldSchema && isObjectSchema(oldSchema)) {
    extensible = oldSchema.extensible ?? extensible;
    recursiveExtensible = oldSchema.recursiveExtensible ?? recursiveExtensible;
    oldProperties = oldSchema.properties;
    template = oldSchema.template;
  }

  // 读取 $meta
  const meta = data.$meta;
  if (meta) {
    if (meta.extensible !== undefined) extensible = Boolean(meta.extensible);
    if (meta.recursiveExtensible !== undefined) {
      recursiveExtensible = Boolean(meta.recursiveExtensible);
      extensible = extensible || recursiveExtensible;
    }
    if (meta.template !== undefined) {
      template = meta.template as StatData | StatData[];
    }
  }

  const properties: ObjectSchemaNode["properties"] = {};
  const requiredKeys = Array.isArray(meta?.required) ? meta.required : [];

  // 遍历属性生成子 Schema
  for (const key of Object.keys(data)) {
    if (key === "$meta") continue;

    const oldChildSchema = oldProperties?.[key];
    const childRecursiveExtensible = extensible && recursiveExtensible;
    const childSchema = generateSchema(data[key], oldChildSchema, childRecursiveExtensible);

    // 确定是否必需
    let required = !extensible;
    if (requiredKeys.includes(key)) required = true;
    if (oldChildSchema?.required === false) required = false;
    if (oldChildSchema?.required === true) required = true;

    properties[key] = { ...childSchema, required };
  }

  return {
    type: "object",
    properties,
    extensible,
    recursiveExtensible,
    ...(template && { template }),
  };
}

/** 生成原始类型 Schema */
function generatePrimitiveSchema(data: unknown): SchemaNode {
  const dataType = typeof data;
  if (dataType === "string" || dataType === "number" || dataType === "boolean") {
    return { type: dataType };
  }
  return { type: "any" };
}

// ============================================================================
//                              Schema 查询
// ============================================================================

/**
 * 获取路径对应的 Schema 节点
 * 支持数组索引和对象属性访问
 */
export function getSchemaForPath(
  schema: SchemaNode | null | undefined,
  path: string,
): SchemaNode | null {
  if (!path || !schema) return schema || null;

  const segments = toPathSegments(path);
  let current: SchemaNode | null = schema;

  for (const segment of segments) {
    if (!current) return null;

    // 数组索引
    if (/^\d+$/.test(segment)) {
      if (isArraySchema(current)) {
        current = current.elementType;
      } else {
        return null;
      }
    }
    // 对象属性
    else if (isObjectSchema(current) && current.properties[segment]) {
      current = current.properties[segment];
    } else {
      return null;
    }
  }

  return current;
}

// ============================================================================
//                              Schema 验证
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** 验证 set 操作 */
export function validateSet(
  schema: SchemaNode | null,
  _path: string,
  _newValue: unknown,
): ValidationResult {
  // 无 Schema 时允许所有操作
  if (!schema) return { valid: true };
  // set 操作只修改已存在的路径，通常是允许的
  return { valid: true };
}

/** 验证 insert 操作 */
export function validateInsert(
  schema: SchemaNode | null,
  path: string,
  keyOrIndex: string | number,
): ValidationResult {
  if (!schema) return { valid: true };

  if (isObjectSchema(schema)) {
    if (schema.extensible === false) {
      // 检查是否是已存在的属性
      const keyStr = String(keyOrIndex);
      if (!schema.properties[keyStr]) {
        return {
          valid: false,
          error: `不能向不可扩展的对象 '${path}' 添加新属性 '${keyStr}'`,
        };
      }
    }
  } else if (isArraySchema(schema)) {
    if (schema.extensible === false) {
      return {
        valid: false,
        error: `不能向不可扩展的数组 '${path}' 添加元素`,
      };
    }
  }

  return { valid: true };
}

/** 验证 delete 操作 */
export function validateDelete(
  schema: SchemaNode | null,
  path: string,
  keyOrIndex?: string | number,
): ValidationResult {
  if (!schema) return { valid: true };

  if (isObjectSchema(schema) && keyOrIndex !== undefined) {
    const keyStr = String(keyOrIndex);
    const propSchema = schema.properties[keyStr];
    if (propSchema?.required === true) {
      return {
        valid: false,
        error: `不能删除必需属性 '${keyStr}' (路径: ${path})`,
      };
    }
  } else if (isArraySchema(schema)) {
    if (schema.extensible === false) {
      return {
        valid: false,
        error: `不能从不可扩展的数组 '${path}' 删除元素`,
      };
    }
  }

  return { valid: true };
}

// ============================================================================
//                              Schema 调和
// ============================================================================

/** 调和 Schema - 在数据变更后重新生成 Schema */
export function reconcileSchema(variables: MvuData): void {
  const dataClone = JSON.parse(JSON.stringify(variables.stat_data));
  const newSchema = generateSchema(dataClone, variables.schema);

  if (isObjectSchema(newSchema)) {
    variables.schema = newSchema;
  }

  // 清理 $meta
  cleanupMeta(variables.stat_data);
}

/** 递归清理 $meta 元数据 */
export function cleanupMeta(data: unknown): void {
  if (Array.isArray(data)) {
    // 移除 $arrayMeta 元素
    for (let i = data.length - 1; i >= 0; i--) {
      const item = data[i];
      if (isPlainObject(item) && "$arrayMeta" in item) {
        data.splice(i, 1);
      } else {
        cleanupMeta(item);
      }
    }
  } else if (isPlainObject(data)) {
    const obj = data as Record<string, unknown>;
    delete obj.$meta;
    for (const key of Object.keys(obj)) {
      cleanupMeta(obj[key]);
    }
  }
}

// ============================================================================
//                              Schema 类型推断增强
// ============================================================================

/** 推断值的精确类型 */
export function inferType(value: unknown): SchemaNode {
  if (value === null) return { type: "any" };
  if (Array.isArray(value)) {
    if (value.length === 0) return { type: "array", elementType: { type: "any" }, extensible: true };
    const elementTypes = value.map(inferType);
    const unified = unifyTypes(elementTypes);
    return { type: "array", elementType: unified, extensible: true };
  }
  if (isPlainObject(value)) {
    const properties: ObjectSchemaNode["properties"] = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "$meta") continue;
      properties[k] = { ...inferType(v), required: true };
    }
    return { type: "object", properties, extensible: false };
  }
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return { type: t };
  return { type: "any" };
}

/** 统一多个类型为一个兼容类型 */
function unifyTypes(types: SchemaNode[]): SchemaNode {
  if (types.length === 0) return { type: "any" };
  if (types.length === 1) return types[0];

  const typeSet = new Set(types.map((t) => t.type));
  if (typeSet.size === 1) {
    const first = types[0];
    if (isObjectSchema(first)) {
      return mergeObjectSchemas(types.filter(isObjectSchema));
    }
    if (isArraySchema(first)) {
      const elementTypes = types.filter(isArraySchema).map((t) => t.elementType);
      return { type: "array", elementType: unifyTypes(elementTypes), extensible: true };
    }
    return first;
  }

  return { type: "any" };
}

/** 合并多个对象 Schema */
function mergeObjectSchemas(schemas: ObjectSchemaNode[]): ObjectSchemaNode {
  const allKeys = new Set<string>();
  schemas.forEach((s) => Object.keys(s.properties).forEach((k) => allKeys.add(k)));

  const properties: ObjectSchemaNode["properties"] = {};
  for (const key of allKeys) {
    const keySchemas = schemas
      .filter((s) => key in s.properties)
      .map((s) => s.properties[key]);

    if (keySchemas.length === 0) continue;

    const unified = unifyTypes(keySchemas);
    const required = keySchemas.length === schemas.length && keySchemas.every((s) => s.required);
    properties[key] = { ...unified, required };
  }

  return { type: "object", properties, extensible: true };
}

/** 检查值是否符合 Schema */
export function validateValue(value: unknown, schema: SchemaNode): ValidationResult {
  if (schema.type === "any") return { valid: true };

  if (schema.type === "string") {
    return typeof value === "string"
      ? { valid: true }
      : { valid: false, error: `期望 string，实际 ${typeof value}` };
  }
  if (schema.type === "number") {
    return typeof value === "number"
      ? { valid: true }
      : { valid: false, error: `期望 number，实际 ${typeof value}` };
  }
  if (schema.type === "boolean") {
    return typeof value === "boolean"
      ? { valid: true }
      : { valid: false, error: `期望 boolean，实际 ${typeof value}` };
  }

  if (isArraySchema(schema)) {
    if (!Array.isArray(value)) {
      return { valid: false, error: `期望 array，实际 ${typeof value}` };
    }
    for (let i = 0; i < value.length; i++) {
      const result = validateValue(value[i], schema.elementType);
      if (!result.valid) {
        return { valid: false, error: `数组索引 ${i}: ${result.error}` };
      }
    }
    return { valid: true };
  }

  if (isObjectSchema(schema)) {
    if (!isPlainObject(value)) {
      return { valid: false, error: `期望 object，实际 ${typeof value}` };
    }
    const obj = value as Record<string, unknown>;

    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (propSchema.required && !(key in obj)) {
        return { valid: false, error: `缺少必需属性 '${key}'` };
      }
      if (key in obj) {
        const result = validateValue(obj[key], propSchema);
        if (!result.valid) {
          return { valid: false, error: `属性 '${key}': ${result.error}` };
        }
      }
    }

    if (!schema.extensible) {
      for (const key of Object.keys(obj)) {
        if (!(key in schema.properties) && key !== "$meta") {
          return { valid: false, error: `不允许的属性 '${key}'` };
        }
      }
    }

    return { valid: true };
  }

  return { valid: true };
}

/** 生成 Schema 的 JSON Schema 格式 (用于 AI 函数调用) */
export function toJsonSchema(schema: SchemaNode): Record<string, unknown> {
  if (schema.type === "string" || schema.type === "number" || schema.type === "boolean") {
    return { type: schema.type };
  }

  if (schema.type === "any") {
    return {};
  }

  if (isArraySchema(schema)) {
    return {
      type: "array",
      items: toJsonSchema(schema.elementType),
    };
  }

  if (isObjectSchema(schema)) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, propSchema] of Object.entries(schema.properties)) {
      properties[key] = toJsonSchema(propSchema);
      if (propSchema.required) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      ...(required.length > 0 && { required }),
      ...(schema.extensible && { additionalProperties: true }),
    };
  }

  return {};
}

/** 从 JSON Schema 创建 SchemaNode */
export function fromJsonSchema(jsonSchema: Record<string, unknown>): SchemaNode {
  const type = jsonSchema.type as string;

  if (type === "string" || type === "number" || type === "boolean") {
    return { type };
  }

  if (type === "array") {
    const items = jsonSchema.items as Record<string, unknown> | undefined;
    return {
      type: "array",
      elementType: items ? fromJsonSchema(items) : { type: "any" },
      extensible: true,
    };
  }

  if (type === "object") {
    const properties: ObjectSchemaNode["properties"] = {};
    const jsonProps = jsonSchema.properties as Record<string, Record<string, unknown>> | undefined;
    const requiredKeys = (jsonSchema.required as string[]) || [];

    if (jsonProps) {
      for (const [key, propSchema] of Object.entries(jsonProps)) {
        properties[key] = {
          ...fromJsonSchema(propSchema),
          required: requiredKeys.includes(key),
        };
      }
    }

    return {
      type: "object",
      properties,
      extensible: jsonSchema.additionalProperties !== false,
    };
  }

  return { type: "any" };
}

// ============================================================================
//                              工具函数
// ============================================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 将路径字符串转换为段数组 */
function toPathSegments(path: string): string[] {
  const segments: string[] = [];
  let current = "";
  let inBracket = false;

  for (let i = 0; i < path.length; i++) {
    const char = path[i];

    if (char === "[" && !inBracket) {
      if (current) {
        segments.push(current);
        current = "";
      }
      inBracket = true;
    } else if (char === "]" && inBracket) {
      // 去除引号
      const cleaned = current.replace(/^["']|["']$/g, "");
      segments.push(cleaned);
      current = "";
      inBracket = false;
    } else if (char === "." && !inBracket) {
      if (current) {
        segments.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) segments.push(current);
  return segments;
}
