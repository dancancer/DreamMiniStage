import type { FinalizedDialogueResult } from "@/lib/generation-runtime/types";
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
import { assemblePromptContext, type PromptContextMessage } from "./prompt-context";
import { applyTextTransforms } from "./text-transform";
import {
  matchWorldModules,
  type WorldActivationState,
  type WorldHit,
} from "./world-module";

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
  language?: "zh" | "en";
}

export interface StoryPreparedTurn {
  runtime: "story";
  blueprint: SessionBlueprint;
  session: StorySessionState;
  userInput: string;
  transformedInput: string;
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
  blueprint: Pick<SessionBlueprint, "id">;
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
    memory: createEmptyStoryMemoryState(now),
    updatedAt: now,
  };
}

export function prepareStoryTurn(params: {
  blueprint: SessionBlueprint;
  session: StorySessionState;
  userInput: string;
  model: StoryModelInput;
  commitSession?: StoryPreparedTurn["commitSession"];
  memoryExtractor?: StoryMemoryExtractor;
}): StoryPreparedTurn {
  const input = applyTextTransforms(params.userInput, params.blueprint.inputTransforms);
  const world = matchWorldModules(
    params.blueprint,
    input.text,
    params.session.worldbookActivationState,
  );
  const context = assemblePromptContext({
    blueprint: params.blueprint,
    worldHits: world.hits,
    memoryMessages: formatStoryMemoryMessages(params.session.memory),
    history: [...toHistory(params.session), { role: "user", content: input.text }],
    maxTokens: params.model.contextWindow,
  });
  const llmConfig = buildStoryLlmConfig(params.model, context.messages, params.session, params.blueprint);

  return {
    runtime: "story",
    blueprint: params.blueprint,
    session: params.session,
    userInput: params.userInput,
    transformedInput: input.text,
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
  const nextSession = advanceStorySession({
    session: turn.session,
    userInput: turn.transformedInput,
    assistantResponse: output.text,
    worldbookActivationState: turn.worldbookActivationState,
    renderIntents: turn.renderIntents,
    memoryExtractor: turn.memoryExtractor,
    memoryPolicy: turn.blueprint.memoryPolicy,
  });

  await turn.commitSession?.(nextSession);

  return {
    screenContent: output.text,
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
  worldbookActivationState: WorldActivationState;
  renderIntents: RenderIntent[];
  memoryExtractor?: StoryMemoryExtractor;
  memoryPolicy: SessionBlueprint["memoryPolicy"];
}): StorySessionState {
  const now = new Date().toISOString();
  const memory = consolidateStoryMemory({
    memory: params.session.memory,
    policy: params.memoryPolicy,
    userInput: params.userInput,
    assistantResponse: params.assistantResponse,
    now,
    extractor: params.memoryExtractor,
  });
  return {
    ...params.session,
    recentTranscript: trimTranscript([
      ...params.session.recentTranscript,
      transcriptMessage("user", params.userInput, now),
      transcriptMessage("assistant", params.assistantResponse, now),
    ]),
    worldbookActivationState: params.worldbookActivationState,
    renderState: {
      activeIntentIds: params.renderIntents.map((intent) => intent.id),
      updatedAt: now,
    },
    memory,
    updatedAt: now,
  };
}

function buildStoryLlmConfig(
  model: StoryModelInput,
  messages: PromptContextMessage[],
  session: StorySessionState,
  blueprint: SessionBlueprint,
): LLMConfig {
  return {
    modelName: model.modelName,
    apiKey: model.apiKey,
    baseUrl: model.baseUrl,
    llmType: model.llmType ?? "openai",
    temperature: model.temperature,
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
    timeout: model.timeout,
    maxRetries: model.maxRetries,
    topP: model.topP,
    frequencyPenalty: model.frequencyPenalty,
    presencePenalty: model.presencePenalty,
    topK: model.topK,
    repeatPenalty: model.repeatPenalty,
    streaming: model.streaming ?? false,
    streamUsage: model.streamUsage ?? true,
    language: model.language ?? "zh",
    dialogueKey: session.dialogueId,
    characterId: blueprint.profile.id,
    messages: messages.map(toModelMessage),
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
