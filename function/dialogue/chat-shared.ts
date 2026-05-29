/**
 * @input  lib/data/roleplay/character-dialogue-operation, function/dialogue/dialogue-summary
 * @output buildDialogueRuntimeParams, processPostResponseAsync
 * @pos    对话生成共享逻辑 - story runtime 参数构建与响应后处理
 */

import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { ParsedResponse } from "@/lib/models/parsed-response";
import { syncDialogueSummaryState } from "@/function/dialogue/dialogue-summary";
import type {
  DialogueRuntimeParams,
  DialogueRuntimeParamInput,
} from "@/lib/generation-runtime/prepare/dialogue-runtime-params";

export type {
  DialogueRuntimeParams,
  DialogueRuntimeParamInput,
} from "@/lib/generation-runtime/prepare/dialogue-runtime-params";

export interface PostResponseInput {
  dialogueId: string;
  message: string;
  thinkingContent: string;
  fullResponse: string;
  screenContent: string;
  event: string;
  nextPrompts: string[];
  nodeId: string;
}

export function buildDialogueRuntimeParams(
  input: DialogueRuntimeParamInput,
): DialogueRuntimeParams {
  const {
    dialogueId,
    characterId,
    userInput,
    language,
    username,
    modelName,
    apiKey,
    baseUrl,
    llmType,
    advanced,
    number,
    fastModel,
    openingMessage,
  } = input;

  return {
    dialogueKey: dialogueId,
    characterId,
    userInput,
    language,
    username,
    modelName,
    apiKey,
    baseUrl,
    llmType,
    temperature: advanced?.temperature,
    maxTokens: advanced?.maxTokens,
    timeout: advanced?.timeout,
    maxRetries: advanced?.maxRetries,
    topP: advanced?.topP,
    frequencyPenalty: advanced?.frequencyPenalty,
    presencePenalty: advanced?.presencePenalty,
    topK: advanced?.topK,
    repeatPenalty: advanced?.repeatPenalty,
    contextWindow: advanced?.contextWindow,
    streaming: advanced?.streaming ?? false,
    streamUsage: advanced?.streamUsage ?? true,
    number,
    fastModel,
    openingMessage,
  };
}

export async function processPostResponseAsync(input: PostResponseInput): Promise<void> {
  const { dialogueId, thinkingContent, fullResponse, screenContent, event, nextPrompts, nodeId } = input;

  try {
    const parsed: ParsedResponse = {
      regexResult: screenContent,
      nextPrompts,
    };

    const updated = await LocalCharacterDialogueOperations.updateNodeInDialogueTree(
      dialogueId,
      nodeId,
      {
        assistantResponse: screenContent,
        fullResponse,
        thinkingContent,
        parsedContent: parsed,
      },
    );
    if (!updated) {
      throw new Error(`Pending dialogue node not found: ${nodeId}`);
    }

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

    await syncDialogueSummaryState(dialogueId).catch((summaryError) => {
      console.warn("[DialogueSummary] refresh failed:", summaryError);
    });
  } catch (error) {
    console.error("Error in processPostResponseAsync:", error);
  }
}
