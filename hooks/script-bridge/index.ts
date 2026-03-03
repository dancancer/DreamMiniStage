/**
 * @input  hooks/script-bridge/types, hooks/script-bridge/*-handlers
 * @output handleApiCall, ApiCallContext, ApiHandler, ApiHandlerMap, ScriptTool, ToolCallRequest, ToolCallResponse
 * @pos    脚本桥接注册表 - 统一的 API Handler 注册与调用入口
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Script Bridge Handler Registry                     ║
 * ║                                                                            ║
 * ║  统一的 API Handler 注册表                                                  ║
 * ║  好品味：用数据结构消灭分支，新增 API 只需在对应文件添加 handler              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiCallContext, ApiHandler, ApiHandlerMap } from "./types";
import { variableHandlers } from "./variable-handlers";
import { worldbookHandlers } from "./worldbook-handlers";
import { lorebookHandlers } from "./lorebook-handlers";
import { presetHandlers } from "./preset-handlers";
import { generationHandlers } from "./generation-handlers";
import { messageHandlers } from "./message-handlers";
import { mvuHandlers } from "./mvu-handlers";
import { slashHandlers } from "./slash-handlers";
import { eventHandlers } from "./event-handlers";
import { extensionHandlers } from "./extension-handlers";
import { quickReplyHandlers } from "./quickreply-handlers";
import { characterHandlers } from "./character-handlers";
import { audioHandlers } from "./audio-handlers";
import { toolHandlers } from "./tool-handlers";
import { compatHandlers } from "./compat-handlers";

// ============================================================================
//                              Handler 注册表
// ============================================================================

const API_HANDLERS: ApiHandlerMap = {
  ...variableHandlers,
  ...worldbookHandlers,
  ...lorebookHandlers,
  ...presetHandlers,
  ...generationHandlers,
  ...messageHandlers,
  ...mvuHandlers,
  ...slashHandlers,
  ...eventHandlers,
  ...extensionHandlers,
  ...quickReplyHandlers,
  ...characterHandlers,
  ...audioHandlers,
  ...toolHandlers,
  ...compatHandlers,
};

// ============================================================================
//                              统一调用入口
// ============================================================================

export async function handleApiCall(
  method: string,
  args: unknown[],
  context: ApiCallContext
): Promise<unknown> {
  const handler: ApiHandler | undefined = API_HANDLERS[method];
  console.log("[handleApiCall] method:", method, "handler存在:", !!handler, "已注册的方法:", Object.keys(API_HANDLERS));
  if (!handler) {
    console.warn("[handleApiCall] 未找到 handler:", method);
    return undefined;
  }
  const result = await handler(args, context);
  console.log("[handleApiCall] 执行完成:", method, "result:", result);
  return result;
}

// ============================================================================
//                              类型导出
// ============================================================================

export type { ApiCallContext, ApiHandler, ApiHandlerMap } from "./types";

// ============================================================================
//                              脚本工具导出
// ============================================================================

export {
  getRegisteredScriptTools,
  getScriptToolsAsOpenAI,
  findScriptTool,
  clearIframeTools,
  invokeScriptTool,
  handleToolCallResponse,
} from "./tool-handlers";

export type {
  ScriptTool,
  ToolCallRequest,
  ToolCallResponse,
} from "./tool-handlers";

// ============================================================================
//                              iframe 生命周期管理
// ============================================================================

export { clearIframeListeners } from "./event-handlers";
