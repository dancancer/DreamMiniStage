/**
 * @input  lib/data/roleplay/character-dialogue-operation, lib/workflow/examples/DialogueWorkflow, lib/vector-memory/manager, lib/streaming, lib/mvu
 * @output handleCharacterChatRequest
 * @pos    对话核心处理 - 用户消息处理与 LLM 响应生成
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { PresetOperations } from "@/lib/data/roleplay/preset-operation";
import { ParsedResponse } from "@/lib/models/parsed-response";
import { DialogueWorkflow, DialogueWorkflowParams } from "@/lib/workflow/examples/DialogueWorkflow";
import { getCurrentSystemPresetType } from "@/function/preset/download";
import { getVectorMemoryManager } from "@/lib/vector-memory/manager";
import { prepareOpeningGreeting, type OpeningPayload } from "@/function/dialogue/opening";
import {
  createSSEResponse,
  formatSSEData,
  formatSSEDone,
} from "@/lib/streaming";
import { resolveModelAdvancedSettings } from "@/lib/model-runtime";
import type { ModelAdvancedSettings } from "@/lib/model-runtime";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  Dialogue Workflow Result Interface                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
interface DialogueWorkflowResult {
  outputData: {
    thinkingContent?: string;
    screenContent: string;
    fullResponse: string;
    nextPrompts?: string[];
    event?: unknown;
  };
}

/**
 * 类型守卫：检查 workflow 结果是否符合预期结构
 */
function isDialogueWorkflowResult(result: unknown): result is DialogueWorkflowResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "outputData" in result &&
    typeof (result as DialogueWorkflowResult).outputData === "object" &&
    (result as DialogueWorkflowResult).outputData !== null
  );
}

export async function handleCharacterChatRequest(payload: {
  username?: string;
  dialogueId: string;  // 对话树 ID（sessionId）
  characterId: string;
  message: string;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  llmType?: "openai" | "ollama" | "gemini";
  streaming?: boolean;
  language?: "zh" | "en";
  number?: number;
  nodeId: string;
  fastModel: boolean;
  advanced?: ModelAdvancedSettings;
  openingMessage?: OpeningPayload;
  parentNodeId?: string;
}): Promise<Response> {
  try {
    const {
      username,
      dialogueId,
      characterId,
      message,
      modelName,
      baseUrl,
      apiKey,
      llmType = "openai",
      language = "zh",
      number = 200,
      nodeId,
      fastModel = false,
      streaming = false,
      advanced,
      openingMessage,
      parentNodeId,
    } = payload;

    if (!dialogueId || !characterId || !message) {
      return new Response(JSON.stringify({ error: "Missing required parameters" }), { status: 400 });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 输入净化：去除 <input_message> 包裹，保持与基线一致的纯文本 user 输入
    // ════════════════════════════════════════════════════════════════════════
    const sanitizedMessage = message
      .replace(/<input_message>/gi, "")
      .replace(/<\/input_message>/gi, "")
      .trim();

    try {
      const presetSampling = await PresetOperations.getActivePresetSampling();
      const resolvedAdvanced = resolveModelAdvancedSettings({
        request: advanced,
        preset: presetSampling,
      });
      const responseStreaming = streaming;
      const modelStreaming = resolvedAdvanced.streaming ?? responseStreaming;
      const effectiveStreamUsage = resolvedAdvanced.streamUsage ?? true;

      await ensureDialogueTreeWithOpening({
        dialogueId,
        characterId,
        language,
        username,
        openingMessage,
      });

      await appendPendingUserTurn({
        dialogueId,
        message,
        nodeId,
        parentNodeId,
      });

      // ═══════════════════════════════════════════════════════════════════════════
      // 流式响应模式：返回 SSE 流
      // ═══════════════════════════════════════════════════════════════════════════
      if (responseStreaming) {
        return handleStreamingResponse({
          dialogueId,
          characterId,
          message: sanitizedMessage,
          originalMessage: message,
          username,
          modelName,
          baseUrl,
          apiKey,
          llmType,
          language,
          number,
          fastModel,
          advanced: resolvedAdvanced,
          nodeId,
        });
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // 非流式响应模式：使用完整 workflow
      // ═══════════════════════════════════════════════════════════════════════════
      const workflow = new DialogueWorkflow();
      const workflowParams: DialogueWorkflowParams = {
        dialogueKey: dialogueId,  // 会话隔离：使用 sessionId
        characterId,
        userInput: sanitizedMessage,
        language,
        username,
        modelName,
        apiKey,
        baseUrl,
        llmType: llmType as "openai" | "ollama" | "gemini",
        temperature: resolvedAdvanced.temperature,
        maxTokens: resolvedAdvanced.maxTokens ?? number,
        timeout: resolvedAdvanced.timeout,
        maxRetries: resolvedAdvanced.maxRetries,
        topP: resolvedAdvanced.topP,
        frequencyPenalty: resolvedAdvanced.frequencyPenalty,
        presencePenalty: resolvedAdvanced.presencePenalty,
        topK: resolvedAdvanced.topK,
        repeatPenalty: resolvedAdvanced.repeatPenalty,
        contextWindow: resolvedAdvanced.contextWindow,
        streaming: modelStreaming,
        streamUsage: effectiveStreamUsage, // 确保token usage追踪
        number,
        fastModel,  
        systemPresetType: getCurrentSystemPresetType(),
      };
      const workflowResult = await workflow.execute(workflowParams);

      // ═══════════════════════════════════════════════════════════════════════════
      // 类型守卫：确保 workflow 返回符合预期的结构
      // ═══════════════════════════════════════════════════════════════════════════
      if (!isDialogueWorkflowResult(workflowResult)) {
        throw new Error("No response returned from workflow");
      }

      const {
        thinkingContent,
        screenContent,
        fullResponse,
        nextPrompts,
        event,
      } = workflowResult.outputData;

      // ═══════════════════════════════════════════════════════════════════════════
      // 后处理：提供默认值以满足下游函数的类型要求
      // ═══════════════════════════════════════════════════════════════════════════
      await processPostResponseAsync({
        dialogueId,
        message,
        thinkingContent: thinkingContent ?? "",
        fullResponse,
        screenContent,
        event: typeof event === "string" ? event : "",
        nextPrompts: nextPrompts ?? [],
        nodeId,
      })
        .catch((e) => console.error("Post-processing error:", e));

      return new Response(JSON.stringify({
        type: "complete",
        success: true,
        thinkingContent,
        content: screenContent,
        parsedContent: { nextPrompts },
        isRegexProcessed: true,
      }), {
        headers: {
          "Content-Type": "application/json",
        },
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Processing error:", error);
      return new Response(JSON.stringify({
        type: "error",
        message: errorMessage,
        success: false,
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Fatal error:", error);
    return new Response(JSON.stringify({ error: `Failed to process request: ${errorMessage}`, success: false }), { 
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

async function ensureDialogueTreeWithOpening(params: {
  dialogueId: string;
  characterId: string;
  language: "zh" | "en";
  username?: string;
  openingMessage?: OpeningPayload;
}) {
  const { dialogueId, characterId, language, username, openingMessage } = params;
  const existingTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueId);
  if (existingTree) return;

  await LocalCharacterDialogueOperations.createDialogueTree(dialogueId, characterId);
  const opening = openingMessage || await prepareOpeningGreeting({
    dialogueId,
    characterId,
    language,
    username,
  });

  const parsedOpening: ParsedResponse = {
    regexResult: opening.content,
    nextPrompts: [],
  };

  await LocalCharacterDialogueOperations.addNodeToDialogueTree(
    dialogueId,
    "root",
    "",
    opening.content,
    opening.fullContent,
    "",
    parsedOpening,
    opening.id,
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MVU 变量初始化：从世界书加载 [InitVar] 条目和开场白 <initvar> 块
  // ═══════════════════════════════════════════════════════════════════════════
  const { initMvuVariablesFromWorldBooks } = await import("@/lib/mvu");
  initMvuVariablesFromWorldBooks({
    dialogueKey: dialogueId,
    characterId,
    openingNodeId: opening.id,
    greeting: opening.fullContent,
  }).catch((error) => console.warn("[MVU] 变量初始化失败:", error));
}

async function appendPendingUserTurn(params: {
  dialogueId: string;
  message: string;
  nodeId: string;
  parentNodeId?: string;
}) {
  const { dialogueId, message, nodeId, parentNodeId } = params;
  const dialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueId);
  if (!dialogueTree) {
    throw new Error(`Dialogue not found: ${dialogueId}`);
  }

  const parent = parentNodeId ?? dialogueTree.current_nodeId;
  await LocalCharacterDialogueOperations.addNodeToDialogueTree(
    dialogueId,
    parent,
    message,
    "",
    "",
    "",
    undefined,
    nodeId,
  );
}

async function processPostResponseAsync({
  dialogueId,
  message,
  thinkingContent,
  fullResponse,
  screenContent,
  event,
  nextPrompts,
  nodeId,
}: {
  dialogueId: string;  // 对话树 ID（sessionId）
  message: string;
  thinkingContent: string;
  fullResponse: string;
  screenContent: string;
  event: string;
  nextPrompts: string[];
  nodeId: string;
}) {
  try {
    const parsed: ParsedResponse = {
      regexResult: screenContent,
      nextPrompts,
    };

    const updated = await LocalCharacterDialogueOperations.updateNodeInDialogueTree(
      dialogueId,
      nodeId,
      {
        assistantResponse: screenContent, // 正则处理后的内容（用于历史构建和展示）
        fullResponse, // 原始响应（用于调试和重新处理）
        thinkingContent,
        parsedContent: parsed,
      },
    );
    if (!updated) {
      throw new Error(`Pending dialogue node not found: ${nodeId}`);
    }

    // 向量记忆异步写入，不阻塞主流程
    const vectorManager = getVectorMemoryManager();
    const now = Date.now();
    vectorManager.ingest(dialogueId, [
      {
        id: `user_${nodeId}`,
        role: "user",
        source: "user_message",
        content: message,
        createdAt: now,
      },
      {
        id: `assistant_${nodeId}`,
        role: "assistant",
        source: "assistant_response",
        content: screenContent || fullResponse,
        createdAt: now,
      },
    ]).catch((error) => console.warn("[VectorMemory] ingest failed:", error));

    // 处理 MVU 变量更新：仅使用 dialogueId 会话作用域
    const { processMessageVariables } = await import("@/lib/mvu");
    await processMessageVariables({
      dialogueKey: dialogueId,
      nodeId,
      messageContent: fullResponse,
    });

    if (event) {
      await LocalCharacterDialogueOperations.updateNodeInDialogueTree(
        dialogueId,
        nodeId,
        {
          parsedContent: {
            ...parsed,
            compressedContent: event,
          },
        },
      );
    }
  } catch (e) {
    console.error("Error in processPostResponseAsync:", e);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   流式响应处理

   好品味：将流式逻辑独立封装，保持主函数清晰
   ═══════════════════════════════════════════════════════════════════════════ */

interface StreamingParams {
  dialogueId: string;
  characterId: string;
  message: string;
  originalMessage: string;
  username?: string;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  llmType: "openai" | "ollama" | "gemini";
  language: "zh" | "en";
  number: number;
  fastModel: boolean;
  advanced?: ModelAdvancedSettings;
  nodeId: string;
}

async function handleStreamingResponse(params: StreamingParams): Promise<Response> {
  const {
    dialogueId,
    characterId,
    message,
    originalMessage,
    username,
    modelName,
    baseUrl,
    apiKey,
    llmType,
    language,
    number,
    fastModel,
    advanced,
    nodeId,
  } = params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ───────────────────────────────────────────────────────────────────
        // 执行 workflow 获取完整响应（复用现有逻辑保持一致性）
        // 然后模拟流式输出
        // ───────────────────────────────────────────────────────────────────
        const workflow = new DialogueWorkflow();
        const workflowParams: DialogueWorkflowParams = {
          dialogueKey: dialogueId,
          characterId,
          userInput: message,
          language,
          username,
          modelName,
          apiKey,
          baseUrl,
          llmType,
          temperature: advanced?.temperature,
          maxTokens: advanced?.maxTokens ?? number,
          timeout: advanced?.timeout,
          maxRetries: advanced?.maxRetries,
          topP: advanced?.topP,
          frequencyPenalty: advanced?.frequencyPenalty,
          presencePenalty: advanced?.presencePenalty,
          topK: advanced?.topK,
          repeatPenalty: advanced?.repeatPenalty,
          contextWindow: advanced?.contextWindow,
          streaming: advanced?.streaming ?? false, // workflow 内部不使用流式
          streamUsage: advanced?.streamUsage ?? true,
          number,
          fastModel,
          systemPresetType: getCurrentSystemPresetType(),
        };

        const workflowResult = await workflow.execute(workflowParams);

        if (!isDialogueWorkflowResult(workflowResult)) {
          throw new Error("No response returned from workflow");
        }

        const {
          thinkingContent,
          screenContent,
          fullResponse,
          nextPrompts,
          event,
        } = workflowResult.outputData;

        // ───────────────────────────────────────────────────────────────────
        // 发送思考内容（如果有）
        // ───────────────────────────────────────────────────────────────────
        if (thinkingContent) {
          const reasoningEvent = formatSSEData({
            type: "reasoning",
            thinkingContent,
          });
          controller.enqueue(encoder.encode(reasoningEvent));
        }

        // ───────────────────────────────────────────────────────────────────
        // 流式发送内容（分块发送以模拟流式效果）
        // ───────────────────────────────────────────────────────────────────
        const chunkSize = 20; // 每次发送的字符数
        let sentContent = "";

        for (let i = 0; i < screenContent.length; i += chunkSize) {
          const chunk = screenContent.slice(i, i + chunkSize);
          sentContent += chunk;

          const contentEvent = formatSSEData({
            type: "content",
            content: chunk,
            accumulated: sentContent,
          });
          controller.enqueue(encoder.encode(contentEvent));

          // 添加小延迟以模拟真实流式效果
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        // ───────────────────────────────────────────────────────────────────
        // 发送完成事件
        // ───────────────────────────────────────────────────────────────────
        const completeEvent = formatSSEData({
          type: "complete",
          success: true,
          thinkingContent: thinkingContent ?? "",
          content: screenContent,
          parsedContent: { nextPrompts: nextPrompts ?? [] },
          isRegexProcessed: true,
        });
        controller.enqueue(encoder.encode(completeEvent));
        controller.enqueue(encoder.encode(formatSSEDone()));

        // ───────────────────────────────────────────────────────────────────
        // 后处理（异步，不阻塞流式响应）
        // ───────────────────────────────────────────────────────────────────
        processPostResponseAsync({
          dialogueId,
          message: originalMessage,
          thinkingContent: thinkingContent ?? "",
          fullResponse,
          screenContent,
          event: typeof event === "string" ? event : "",
          nextPrompts: nextPrompts ?? [],
          nodeId,
        }).catch((e) => console.error("Post-processing error:", e));

        controller.close();

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Streaming error:", error);

        const errorEvent = formatSSEData({
          type: "error",
          message: errorMessage,
          success: false,
        });
        controller.enqueue(encoder.encode(errorEvent));
        controller.enqueue(encoder.encode(formatSSEDone()));
        controller.close();
      }
    },
  });

  return createSSEResponse(stream);
}
