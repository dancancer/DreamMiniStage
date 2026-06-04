/**
 * @input  function/dialogue/chat-streaming, function/dialogue/story-turn-lifecycle
 * @output handleCharacterChatRequest
 * @pos    对话生成入口 - 请求归一、Story turn lifecycle 调用与响应封装
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { DEFAULT_RESPONSE_LENGTH } from "@/lib/model-capabilities";
import { handlePreparedDialogueResponse } from "@/function/dialogue/chat-streaming";
import {
  prepareStoryDialogueTurn,
  type StoryTurnLifecycleInput,
} from "@/function/dialogue/story-turn-lifecycle";

type CharacterChatRequestPayload = Omit<
  StoryTurnLifecycleInput,
  "llmType" | "language" | "number" | "streaming"
> & {
  llmType?: StoryTurnLifecycleInput["llmType"];
  streaming?: boolean;
  language?: StoryTurnLifecycleInput["language"];
  number?: number;
};

function hasMissingRequiredParameter(payload: CharacterChatRequestPayload): boolean {
  return !payload.dialogueId || !payload.characterId || !payload.message;
}

function normalizeRequest(payload: CharacterChatRequestPayload): StoryTurnLifecycleInput {
  return {
    ...payload,
    llmType: payload.llmType ?? "openai",
    language: payload.language ?? "zh",
    number: payload.number ?? DEFAULT_RESPONSE_LENGTH,
    streaming: payload.streaming ?? false,
  };
}

function createProcessingErrorResponse(error: unknown): Response {
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

function createMissingParameterResponse(): Response {
  return new Response(JSON.stringify({ error: "Missing required parameters" }), {
    status: 400,
  });
}

export async function handleCharacterChatRequest(
  payload: CharacterChatRequestPayload,
): Promise<Response> {
  if (hasMissingRequiredParameter(payload)) {
    return createMissingParameterResponse();
  }

  try {
    const turn = await prepareStoryDialogueTurn(normalizeRequest(payload));

    return await handlePreparedDialogueResponse({
      dialogueId: turn.dialogueId,
      originalMessage: turn.originalMessage,
      nodeId: turn.nodeId,
      preparedExecution: turn.preparedExecution,
      streaming: turn.responseStreaming,
    });
  } catch (error) {
    return createProcessingErrorResponse(error);
  }
}
