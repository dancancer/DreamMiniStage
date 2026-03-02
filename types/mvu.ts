/**
 * @input  lib/mvu/types
 * @output (re-export) JSONPrimitive, ValueWithDescription, StatData, MvuData, MvuCommand, CommandResult, MVU_EVENTS ...
 * @pos    类型重导出层 - 对外暴露 MVU 系统的公共类型定义
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 公共类型导出                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

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
} from "@/lib/mvu/types";

export { MVU_EVENTS } from "@/lib/mvu/types";
