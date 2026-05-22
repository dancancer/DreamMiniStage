/**
 * Instruction Mode 模块
 *
 * 为本地模型提供 chat format template 支持
 */

export type { InstructTemplate } from "./templates";
export { getBuiltinTemplates, getTemplateById } from "./templates";
export { formatMessagesAsPrompt, applyTemplateToMessages } from "./apply";
