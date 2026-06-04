/**
 * @input  function/dialogue/dialogue-turn
 * @output handleCharacterChatRequest
 * @pos    对话生成入口 - 请求归一与错误响应封装
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { DEFAULT_RESPONSE_LENGTH } from "@/lib/model-capabilities";
import {
  runStoryDialogueTurn,
  type StoryTurnLifecycleInput,
} from "@/function/dialogue/dialogue-turn";

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
    return await runStoryDialogueTurn(normalizeRequest(payload));
  } catch (error) {
    return createProcessingErrorResponse(error);
  }
}
