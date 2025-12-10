/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         生成控制 Handlers                                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { v4 as uuidv4 } from "uuid";
import { useModelStore } from "@/lib/store/model-store";
import { handleCharacterChatRequest } from "@/function/dialogue/chat";
import type { ApiCallContext, ApiHandlerMap } from "./types";

// ============================================================================
//                              生成控制器管理
// ============================================================================

const generationControllers = new Map<string, AbortController>();

// ============================================================================
//                              生成操作
// ============================================================================

async function generate(args: unknown[], ctx: ApiCallContext) {
  const [config] = args as [Record<string, any>];
  const generationId = config?.generation_id || uuidv4();
  const controller = new AbortController();
  generationControllers.set(generationId, controller);

  try {
    if (!ctx.characterId) {
      throw new Error("Character id is required for generation");
    }

    // 从 injects 或 user_input 中提取消息内容
    let message = config?.user_input || "";
    if (!message && Array.isArray(config?.injects)) {
      const userInject = config.injects.find(
        (inject: { role?: string; content?: string }) => inject.role === "user"
      );
      message = userInject?.content || "";
    }

    const activeConfig = useModelStore.getState().getActiveConfig();
    const customApi = config?.custom_api;
    const effectiveConfig = customApi
      ? {
          type: "openai" as const,
          baseUrl: customApi.apiurl || activeConfig?.baseUrl || "",
          model: customApi.model || activeConfig?.model || "",
          apiKey: customApi.key || activeConfig?.apiKey || "",
        }
      : activeConfig;

    if (!effectiveConfig) {
      throw new Error("No active API configuration");
    }

    const abortPromise = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => reject(new Error("Generation aborted")),
        { once: true }
      );
    });

    const response = await Promise.race([
      handleCharacterChatRequest({
        characterId: ctx.characterId,
        message,
        modelName: effectiveConfig.model,
        baseUrl: effectiveConfig.baseUrl,
        apiKey: effectiveConfig.apiKey || "",
        llmType: effectiveConfig.type,
        streaming: Boolean(config?.should_stream ?? config?.stream),
        language: "zh",
        number: customApi?.max_tokens || 200,
        nodeId: generationId,
        fastModel: false,
      }),
      abortPromise,
    ]);

    if (!response.ok) {
      console.error("error:", response);
      throw new Error("Failed to generate response");
    }

    const result = await response.json();
    if (controller.signal.aborted) {
      throw new Error("Generation aborted");
    }

    if (!result.success) {
      throw new Error(result.message || "Generation failed");
    }

    return {
      generationId,
      content: result.content || "",
      thinkingContent: result.thinkingContent || "",
      parsedContent: result.parsedContent,
    };
  } finally {
    generationControllers.delete(generationId);
  }
}

function stopGenerationById(args: unknown[]): boolean {
  const [generationId] = args as [string];
  if (!generationId) return false;
  const controller = generationControllers.get(generationId);
  if (controller) {
    controller.abort();
    generationControllers.delete(generationId);
    return true;
  }
  return false;
}

function stopAllGeneration(): boolean {
  generationControllers.forEach((controller) => controller.abort());
  generationControllers.clear();
  return true;
}

// ============================================================================
//                              导出 Handler Map
// ============================================================================

export const generationHandlers: ApiHandlerMap = {
  "generate": generate,
  "generateRaw": generate,
  "stopGenerationById": stopGenerationById,
  "stopAllGeneration": stopAllGeneration,
};
