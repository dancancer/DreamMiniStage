/**
 * @input  function/dialogue/chat-shared, function/dialogue/chat-streaming, lib/data/roleplay/character-dialogue-operation, lib/workflow/examples/DialogueWorkflow
 * @output handleCharacterChatRequest
 * @pos    对话核心处理 - 用户消息处理与 LLM 响应生成
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { ParsedResponse } from "@/lib/models/parsed-response";
import { prepareOpeningGreeting, type OpeningPayload } from "@/function/dialogue/opening";
import { resolveModelAdvancedSettings } from "@/lib/model-runtime";
import type { ModelAdvancedSettings } from "@/lib/model-runtime";
import { getActivePromptPreset, resolvePromptRuntimeConfig } from "@/lib/prompt-config/service";
import {
  buildDialogueWorkflowParams,
} from "@/function/dialogue/chat-shared";
import { handlePreparedDialogueResponse } from "@/function/dialogue/chat-streaming";
import { prepareDialogueExecution } from "@/lib/generation-runtime/prepare/prepare-dialogue-execution";

function sanitizeUserMessage(message: string): string {
  return message
    .replace(/<input_message>/gi, "")
    .replace(/<\/input_message>/gi, "")
    .trim();
}

export async function handleCharacterChatRequest(payload: {
  username?: string;
  dialogueId: string;
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

    try {
      const activePromptPreset = await getActivePromptPreset();
      const promptRuntime = await resolvePromptRuntimeConfig({
        characterId,
        username,
      });
      const resolvedAdvanced = resolveModelAdvancedSettings({
        request: advanced,
        preset: activePromptPreset?.sampling,
      });
      const responseStreaming = streaming;
      const modelStreaming = resolvedAdvanced.streaming ?? responseStreaming;
      const effectiveStreamUsage = resolvedAdvanced.streamUsage ?? true;
      const sanitizedMessage = sanitizeUserMessage(message);

      await ensureDialogueTreeWithOpening({
        dialogueId,
        characterId,
        language,
        username,
        openingMessage,
      });
      await appendPendingUserTurn({ dialogueId, message, nodeId, parentNodeId });

      const preparedExecution = await prepareDialogueExecution(buildDialogueWorkflowParams({
        dialogueId,
        characterId,
        userInput: sanitizedMessage,
        language,
        username,
        modelName,
        apiKey,
        baseUrl,
        llmType,
        advanced: {
          ...resolvedAdvanced,
          streaming: modelStreaming,
          streamUsage: effectiveStreamUsage,
        },
        promptRuntime,
        number,
        fastModel,
      }));

      return await handlePreparedDialogueResponse({
        dialogueId,
        originalMessage: message,
        nodeId,
        preparedExecution,
        streaming: responseStreaming,
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
