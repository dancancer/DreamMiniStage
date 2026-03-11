/**
 * @input  lib/data/roleplay/character-dialogue-operation, lib/workflow/examples/DialogueWorkflow, lib/vector-memory/manager, lib/mvu
 * @output buildDialogueWorkflowParams, isDialogueWorkflowResult, processPostResponseAsync
 * @pos    对话生成共享逻辑 - workflow 参数构建与响应后处理
 */

import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { ParsedResponse } from "@/lib/models/parsed-response";
import { getCurrentSystemPresetType } from "@/function/preset/download";
import { getVectorMemoryManager } from "@/lib/vector-memory/manager";
import { DialogueWorkflowParams } from "@/lib/workflow/examples/DialogueWorkflow";
import type { ModelAdvancedSettings } from "@/lib/model-runtime";
import type { ResolvedPromptRuntimeConfig } from "@/lib/prompt-config/state";

export interface DialogueWorkflowResult {
  outputData: {
    thinkingContent?: string;
    screenContent: string;
    fullResponse: string;
    nextPrompts?: string[];
    event?: unknown;
  };
}

export interface DialogueWorkflowParamInput {
  dialogueId: string;
  characterId: string;
  userInput: string;
  language: "zh" | "en";
  username?: string;
  modelName: string;
  apiKey: string;
  baseUrl: string;
  llmType: "openai" | "ollama" | "gemini";
  advanced?: ModelAdvancedSettings;
  promptRuntime: ResolvedPromptRuntimeConfig;
  number: number;
  fastModel: boolean;
}

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

export function isDialogueWorkflowResult(result: unknown): result is DialogueWorkflowResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "outputData" in result &&
    typeof (result as DialogueWorkflowResult).outputData === "object" &&
    (result as DialogueWorkflowResult).outputData !== null
  );
}

export function buildDialogueWorkflowParams(
  input: DialogueWorkflowParamInput,
): DialogueWorkflowParams {
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
    promptRuntime,
    number,
    fastModel,
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
    maxTokens: advanced?.maxTokens ?? number,
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
    systemPresetType: getCurrentSystemPresetType(),
    contextPreset: promptRuntime.contextPreset,
    sysprompt: promptRuntime.sysprompt,
    stopStrings: promptRuntime.stopStrings,
    promptNames: promptRuntime.promptNames,
    postProcessingMode: promptRuntime.postProcessingMode,
    effectivePromptConfig: promptRuntime.effectiveConfig,
  };
}

export async function processPostResponseAsync(input: PostResponseInput): Promise<void> {
  const { dialogueId, message, thinkingContent, fullResponse, screenContent, event, nextPrompts, nodeId } = input;

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
  } catch (error) {
    console.error("Error in processPostResponseAsync:", error);
  }
}
