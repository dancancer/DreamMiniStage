import type { FinalizedDialogueResult } from "@/lib/generation-runtime/types";
import { resolveStoryModelPolicy } from "@/lib/model-capabilities";
import type { ModelAdvancedSettings } from "@/lib/model-runtime";
import type { LLMConfig } from "@/lib/nodeflow/LLMNode/llm-config";
import type { SessionBlueprint } from "@/lib/story-agent/blueprint";
import {
  consolidateStoryMemory,
  createEmptyStoryMemoryState,
  formatStoryMemoryMessages,
  type StoryMemoryExtractor,
  type StoryMemoryState,
} from "@/lib/story-agent/memory";
import type { RenderIntent } from "@/lib/story-agent/render-intent";
import {
  assemblePromptContext,
  normalizePromptContextForModel,
  type PromptContextMessage,
} from "./prompt-context";
import { applyTextTransforms } from "./text-transform";
import {
  appendStoryActionsSourceTag,
  applyStoryActionOptions,
} from "./action/options";
import {
  hasActionOptionsIntent,
  hasStatePanelIntent,
  renderContractMessages,
} from "./render/contracts";
import { applyStatusPanelFallback } from "./render/status-fallback";
import {
  matchWorldModules,
  type WorldActivationState,
  type WorldHit,
} from "./world-module";
import {
  applyStoryStateUpdate,
  formatStoryStateMessages,
  type StoryStateData,
} from "./state/update";
import { createInitialStoryState } from "./state/initial";

export interface StoryTranscriptMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface StoryRenderState {
  activeIntentIds: string[];
  updatedAt: string;
}

export interface StorySessionState {
  id: string;
  dialogueId: string;
  blueprintId: string;
  recentTranscript: StoryTranscriptMessage[];
  worldbookActivationState: WorldActivationState;
  renderState: StoryRenderState;
  storyState: StoryStateData;
  memory: StoryMemoryState;
  updatedAt: string;
}

export interface StoryModelInput {
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  llmType?: LLMConfig["llmType"];
  temperature?: number;
  contextWindow?: number;
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  topK?: number;
  repeatPenalty?: number;
  streaming?: boolean;
  streamUsage?: boolean;
  responseLength?: number;
  language?: "zh" | "en";
  username?: string;
}

export interface StoryOpeningMessage {
  id: string;
  content: string;
  fullContent?: string;
}

export interface StoryPreparedTurn {
  runtime: "story";
  blueprint: SessionBlueprint;
  session: StorySessionState;
  userInput: string;
  transformedInput: string;
  openingMessage?: StoryOpeningMessage;
  appliedInputTransformIds: string[];
  promptMessages: PromptContextMessage[];
  worldHits: WorldHit[];
  worldbookActivationState: WorldActivationState;
  renderIntents: RenderIntent[];
  llmConfig: LLMConfig;
  commitSession?: (session: StorySessionState) => Promise<void>;
  memoryExtractor?: StoryMemoryExtractor;
}

export function createStorySession(params: {
  dialogueId: string;
  blueprint: Pick<SessionBlueprint, "id" | "initialState">;
  now?: string;
}): StorySessionState {
  const now = params.now ?? new Date().toISOString();
  return {
    id: params.dialogueId,
    dialogueId: params.dialogueId,
    blueprintId: params.blueprint.id,
    recentTranscript: [],
    worldbookActivationState: {},
    renderState: {
      activeIntentIds: [],
      updatedAt: now,
    },
    storyState: createInitialStoryState(params.blueprint.initialState, now),
    memory: createEmptyStoryMemoryState(now),
    updatedAt: now,
  };
}

export function prepareStoryTurn(params: {
  blueprint: SessionBlueprint;
  session: StorySessionState;
  userInput: string;
  model: StoryModelInput;
  openingMessage?: StoryOpeningMessage;
  commitSession?: StoryPreparedTurn["commitSession"];
  memoryExtractor?: StoryMemoryExtractor;
}): StoryPreparedTurn {
  const input = applyTextTransforms(params.userInput, params.blueprint.inputTransforms);
  const seededOpening = openingHistory(params.session, params.openingMessage);
  const modelPolicy = resolveStoryModelPolicy({
    modelName: params.model.modelName,
    baseUrl: params.model.baseUrl,
    request: params.model,
    blueprint: params.blueprint.modelPolicy,
    responseLength: params.model.responseLength,
  });
  const world = matchWorldModules(
    params.blueprint,
    input.text,
    params.session.worldbookActivationState,
  );
  const context = assemblePromptContext({
    blueprint: params.blueprint,
    worldHits: world.hits,
    renderMessages: renderContractMessages(params.blueprint.renderRules),
    memoryMessages: [
      ...formatStoryMemoryMessages(params.session.memory),
      ...formatStoryStateMessages(params.session.storyState),
    ],
    history: [
      ...seededOpening,
      ...toHistory(params.session),
      { role: "user", content: input.text },
    ],
    requiredHistoryIndexes: seededOpening.length > 0 ? [0] : [],
    macroContext: {
      charName: params.blueprint.profile.name,
      userName: params.model.username,
      lastUserMessage: input.text,
      storyStateVariables: params.session.storyState.variables,
    },
    maxTokens: modelPolicy.contextWindow,
  });
  const llmConfig = buildStoryLlmConfig(
    params.model,
    modelPolicy,
    context.messages,
    params.session,
    params.blueprint,
  );

  return {
    runtime: "story",
    blueprint: params.blueprint,
    session: params.session,
    userInput: params.userInput,
    transformedInput: input.text,
    openingMessage: params.openingMessage,
    appliedInputTransformIds: input.appliedTransformIds,
    promptMessages: context.messages,
    worldHits: world.hits,
    worldbookActivationState: world.activationState,
    renderIntents: params.blueprint.renderRules,
    llmConfig,
    commitSession: params.commitSession,
    memoryExtractor: params.memoryExtractor,
  };
}

export async function finalizeStoryTurn(
  turn: StoryPreparedTurn,
  llmResponse: string,
): Promise<FinalizedDialogueResult> {
  const output = applyTextTransforms(llmResponse, turn.blueprint.outputTransforms);
  const now = new Date().toISOString();
  const stateUpdate = applyStoryStateUpdate(output.text, turn.session.storyState, {
    now,
    emitSourceTag: hasStatePanelIntent(turn.renderIntents),
  });
  const actionOptions = applyStoryActionOptions(output.text, {
    emitSourceTag: hasActionOptionsIntent(turn.renderIntents),
  });
  const screenContent = applyStatusPanelFallback({
    text: appendStoryActionsSourceTag(stateUpdate.screenText, actionOptions.sourceTag),
    intents: turn.renderIntents,
    characterName: turn.blueprint.profile.name,
    now,
  });
  const nextSession = advanceStorySession({
    session: turn.session,
    userInput: turn.transformedInput,
    assistantResponse: stateUpdate.visibleText,
    openingMessage: turn.openingMessage,
    worldbookActivationState: turn.worldbookActivationState,
    renderIntents: turn.renderIntents,
    storyState: stateUpdate.state,
    memoryExtractor: turn.memoryExtractor,
    memoryPolicy: turn.blueprint.memoryPolicy,
    now,
  });

  await turn.commitSession?.(nextSession);

  return {
    screenContent,
    fullResponse: llmResponse,
    thinkingContent: "",
    parsedContent: { nextPrompts: [] },
    event: "",
    isPostProcessed: true,
  };
}

export function isStoryPreparedTurn(value: unknown): value is StoryPreparedTurn {
  return Boolean(value && typeof value === "object" && (value as StoryPreparedTurn).runtime === "story");
}

function advanceStorySession(params: {
  session: StorySessionState;
  userInput: string;
  assistantResponse: string;
  openingMessage?: StoryOpeningMessage;
  worldbookActivationState: WorldActivationState;
  renderIntents: RenderIntent[];
  storyState: StoryStateData;
  memoryExtractor?: StoryMemoryExtractor;
  memoryPolicy: SessionBlueprint["memoryPolicy"];
  now: string;
}): StorySessionState {
  const memory = consolidateStoryMemory({
    memory: params.session.memory,
    policy: params.memoryPolicy,
    userInput: params.userInput,
    assistantResponse: params.assistantResponse,
    now: params.now,
    extractor: params.memoryExtractor,
  });
  return {
    ...params.session,
    recentTranscript: trimTranscript([
      ...openingTranscript(params.session, params.openingMessage, params.now),
      ...params.session.recentTranscript,
      transcriptMessage("user", params.userInput, params.now),
      transcriptMessage("assistant", params.assistantResponse, params.now),
    ]),
    worldbookActivationState: params.worldbookActivationState,
    renderState: {
      activeIntentIds: params.renderIntents.map((intent) => intent.id),
      updatedAt: params.now,
    },
    storyState: params.storyState,
    memory,
    updatedAt: params.now,
  };
}

function buildStoryLlmConfig(
  model: StoryModelInput,
  modelPolicy: ModelAdvancedSettings,
  messages: PromptContextMessage[],
  session: StorySessionState,
  blueprint: SessionBlueprint,
): LLMConfig {
  return {
    modelName: model.modelName,
    apiKey: model.apiKey,
    baseUrl: model.baseUrl,
    llmType: model.llmType ?? "openai",
    temperature: modelPolicy.temperature,
    contextWindow: modelPolicy.contextWindow,
    maxTokens: modelPolicy.maxTokens,
    timeout: modelPolicy.timeout,
    maxRetries: modelPolicy.maxRetries,
    topP: modelPolicy.topP,
    frequencyPenalty: modelPolicy.frequencyPenalty,
    presencePenalty: modelPolicy.presencePenalty,
    topK: modelPolicy.topK,
    repeatPenalty: modelPolicy.repeatPenalty,
    streaming: modelPolicy.streaming ?? model.streaming ?? false,
    streamUsage: modelPolicy.streamUsage ?? model.streamUsage ?? true,
    language: model.language ?? "zh",
    dialogueKey: session.dialogueId,
    characterId: blueprint.profile.id,
    messages: normalizePromptContextForModel(messages).map(toModelMessage),
  };
}

function toModelMessage(message: PromptContextMessage): { role: string; content: string } {
  if (message.role === "unknown") {
    throw new Error(`Unsupported prompt role in SessionBlueprint: ${message.id}`);
  }
  return {
    role: message.role,
    content: message.content,
  };
}

function toHistory(session: StorySessionState): Array<{ role: "user" | "assistant"; content: string }> {
  return session.recentTranscript.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function openingHistory(
  session: StorySessionState,
  opening?: StoryOpeningMessage,
): Array<{ role: "assistant"; content: string }> {
  if (!shouldSeedOpening(session, opening)) return [];
  return [{ role: "assistant", content: openingRuntimeContent(opening) }];
}

function openingTranscript(
  session: StorySessionState,
  opening: StoryOpeningMessage | undefined,
  now: string,
): StoryTranscriptMessage[] {
  if (!shouldSeedOpening(session, opening)) return [];
  return [transcriptMessage("assistant", openingRuntimeContent(opening), now)];
}

function shouldSeedOpening(
  session: StorySessionState,
  opening?: StoryOpeningMessage,
): opening is StoryOpeningMessage {
  return Boolean(opening?.content && session.recentTranscript.length === 0);
}

function openingRuntimeContent(opening: StoryOpeningMessage): string {
  return opening.fullContent || opening.content;
}

function transcriptMessage(
  role: StoryTranscriptMessage["role"],
  content: string,
  createdAt: string,
): StoryTranscriptMessage {
  return {
    id: `${role}:${createdAt}:${content.length}`,
    role,
    content,
    createdAt,
  };
}

function trimTranscript(messages: StoryTranscriptMessage[]): StoryTranscriptMessage[] {
  return messages.slice(-24);
}
