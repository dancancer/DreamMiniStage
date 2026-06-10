/**
 * @input  function/dialogue/chat-shared, function/dialogue/opening, lib/data/roleplay/character-dialogue-operation, lib/generation-runtime, lib/story-agent/session
 * @output prepareStoryDialogueTurn
 * @pos    Story turn lifecycle - 建树、落盘用户 turn、准备 story runtime
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { prepareOpeningGreeting, type OpeningPayload } from "@/function/dialogue/opening";
import { buildDialogueRuntimeParams } from "@/function/dialogue/chat-shared";
import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { prepareDialogueExecution } from "@/lib/generation-runtime/prepare/prepare-dialogue-execution";
import type { PreparedDialogueExecution } from "@/lib/generation-runtime/types";
import { ParsedResponse } from "@/lib/models/parsed-response";
import { getStoryBranchOperationUnsupportedMessage } from "@/lib/story-agent/session";
import {
  resolveModelAdvancedSettings,
  type ModelAdvancedSettings,
} from "@/lib/model-runtime";

export interface StoryTurnLifecycleInput {
  username?: string;
  dialogueId: string;
  characterId: string;
  message: string;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  llmType: "openai" | "ollama" | "gemini";
  streaming: boolean;
  language: "zh" | "en";
  number: number;
  nodeId: string;
  fastModel: boolean;
  advanced?: ModelAdvancedSettings;
  openingMessage?: OpeningPayload;
  parentNodeId?: string;
}

export interface PreparedStoryDialogueTurn {
  dialogueId: string;
  nodeId: string;
  originalMessage: string;
  preparedExecution: PreparedDialogueExecution;
  responseStreaming: boolean;
}

interface TurnModelSettings {
  runtimeAdvanced: ModelAdvancedSettings;
  responseStreaming: boolean;
}

export async function prepareStoryDialogueTurn(
  input: StoryTurnLifecycleInput,
): Promise<PreparedStoryDialogueTurn> {
  assertLinearStoryTurn(input);

  const settings = resolveTurnModelSettings(input);
  await ensureDialogueTreeWithOpening(input);
  await appendPendingUserTurn(input);

  return {
    dialogueId: input.dialogueId,
    nodeId: input.nodeId,
    originalMessage: input.message,
    responseStreaming: settings.responseStreaming,
    preparedExecution: await prepareStoryRuntimeExecution(input, settings),
  };
}

function assertLinearStoryTurn(input: StoryTurnLifecycleInput): void {
  if (!input.parentNodeId) return;

  throw new Error(getStoryBranchOperationUnsupportedMessage("regenerate"));
}

function resolveTurnModelSettings(input: StoryTurnLifecycleInput): TurnModelSettings {
  const resolvedAdvanced = resolveModelAdvancedSettings({
    request: input.advanced,
  });

  return {
    responseStreaming: input.streaming,
    runtimeAdvanced: {
      ...resolvedAdvanced,
      streaming: resolvedAdvanced.streaming ?? input.streaming,
      streamUsage: resolvedAdvanced.streamUsage ?? true,
    },
  };
}

async function prepareStoryRuntimeExecution(
  input: StoryTurnLifecycleInput,
  settings: TurnModelSettings,
): Promise<PreparedDialogueExecution> {
  return prepareDialogueExecution(buildDialogueRuntimeParams({
    dialogueId: input.dialogueId,
    characterId: input.characterId,
    userInput: sanitizeUserMessage(input.message),
    language: input.language,
    username: input.username,
    modelName: input.modelName,
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
    llmType: input.llmType,
    advanced: settings.runtimeAdvanced,
    number: input.number,
    fastModel: input.fastModel,
    openingMessage: input.openingMessage,
  }));
}

function sanitizeUserMessage(message: string): string {
  return message
    .replace(/<input_message>/gi, "")
    .replace(/<\/input_message>/gi, "")
    .trim();
}

async function ensureDialogueTreeWithOpening(input: StoryTurnLifecycleInput): Promise<void> {
  const existingTree = await LocalCharacterDialogueOperations.getDialogueTreeById(input.dialogueId);
  if (existingTree) return;

  await LocalCharacterDialogueOperations.createDialogueTree(input.dialogueId, input.characterId);
  await appendOpeningNode(input, input.openingMessage ?? await prepareOpeningGreeting(input));
}

async function appendOpeningNode(
  input: StoryTurnLifecycleInput,
  opening: OpeningPayload,
): Promise<void> {
  const parsedOpening: ParsedResponse = {
    regexResult: opening.content,
    nextPrompts: [],
  };

  await LocalCharacterDialogueOperations.addNodeToDialogueTree(
    input.dialogueId,
    "root",
    "",
    opening.content,
    opening.fullContent,
    "",
    parsedOpening,
    opening.id,
  );
}

async function appendPendingUserTurn(input: StoryTurnLifecycleInput): Promise<void> {
  const dialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(input.dialogueId);
  if (!dialogueTree) {
    throw new Error(`Dialogue not found: ${input.dialogueId}`);
  }

  await LocalCharacterDialogueOperations.addNodeToDialogueTree(
    input.dialogueId,
    input.parentNodeId ?? dialogueTree.current_nodeId,
    input.message,
    "",
    "",
    "",
    undefined,
    input.nodeId,
  );
}
