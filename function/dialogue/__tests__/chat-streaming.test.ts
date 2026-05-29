import { afterEach, describe, expect, it, vi } from "vitest";
import { handleStreamingResponse } from "../chat-streaming";
import { LLMNodeTools } from "@/lib/nodeflow/LLMNode/LLMNodeTools";
import * as chatShared from "@/function/dialogue/chat-shared";
import type { PreparedDialogueExecution } from "@/lib/generation-runtime/types";
import type { SessionBlueprint } from "@/lib/story-agent/blueprint";
import {
  createStorySession,
  prepareStoryTurn,
} from "@/lib/story-agent/runtime/story-session";

vi.mock("@/function/dialogue/chat-shared", () => ({
  processPostResponseAsync: vi.fn().mockResolvedValue(undefined),
}));

describe("handleStreamingResponse", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("streams model chunks and finalizes through StorySession runtime", async () => {
    vi.spyOn(LLMNodeTools, "invokeLLMStream").mockImplementation(
      async (_config, callbacks) => {
        callbacks.onToken?.("He");
        callbacks.onToken?.("llo");
        return "Hello";
      },
    );

    const response = await handleStreamingResponse({
      dialogueId: "dialogue-1",
      originalMessage: "hi",
      nodeId: "node-1",
      preparedExecution: createPreparedExecution("hi"),
    });

    const payload = await response.text();

    expect(payload).toContain("\"content\":\"He\"");
    expect(payload).toContain("\"content\":\"llo\"");
    expect(payload).toContain("\"type\":\"complete\"");
    expect(LLMNodeTools.invokeLLMStream).toHaveBeenCalledTimes(1);
  });

  it("does not require script tools in the story runtime model request", async () => {
    vi.spyOn(LLMNodeTools, "invokeLLMStream").mockImplementation(
      async (config, callbacks) => {
        expect(config.scriptTools).toBeUndefined();
        callbacks.onToken?.("He");
        callbacks.onToken?.("llo");
        return "Hello";
      },
    );

    const response = await handleStreamingResponse({
      dialogueId: "dialogue-1",
      originalMessage: "hi",
      nodeId: "node-1",
      preparedExecution: createPreparedExecution("hi"),
    });

    const payload = await response.text();

    expect(payload.match(/"type":"content"/g)).toHaveLength(2);
    expect(payload).toContain("\"content\":\"He\"");
    expect(payload).toContain("\"content\":\"llo\"");
  });

  it("persists finalized fullResponse and keeps streamed reasoning", async () => {
    const postResponseSpy = vi.mocked(chatShared.processPostResponseAsync);

    vi.spyOn(LLMNodeTools, "invokeLLMStream").mockImplementation(
      async (_config, callbacks) => {
        callbacks.onReasoning?.("step-1 ");
        callbacks.onReasoning?.("step-2");
        callbacks.onToken?.("Visible ");
        callbacks.onToken?.("reply");
        return "raw Visible reply";
      },
    );

    const response = await handleStreamingResponse({
      dialogueId: "dialogue-1",
      originalMessage: "hi",
      nodeId: "node-1",
      preparedExecution: createPreparedExecution("hi"),
    });

    const payload = await response.text();

    expect(payload).toContain("\"thinkingContent\":\"step-1 step-2\"");
    expect(postResponseSpy).toHaveBeenCalledWith(expect.objectContaining({
      fullResponse: "raw Visible reply",
      thinkingContent: "step-1 step-2",
      screenContent: "screen Visible reply",
    }));
  });

  it("falls back to streamed content when story finalization fails after tokens were emitted", async () => {
    const postResponseSpy = vi.mocked(chatShared.processPostResponseAsync);

    vi.spyOn(LLMNodeTools, "invokeLLMStream").mockImplementation(
      async (_config, callbacks) => {
        callbacks.onReasoning?.("step-1");
        callbacks.onToken?.("Visible ");
        callbacks.onToken?.("reply");
        return "Visible reply";
      },
    );

    const response = await handleStreamingResponse({
      dialogueId: "dialogue-1",
      originalMessage: "hi",
      nodeId: "node-1",
      preparedExecution: {
        context: { id: "legacy" },
        llmConfig: {
          modelName: "gpt-test",
          apiKey: "key",
          baseUrl: "https://example.com",
          llmType: "openai",
          messages: [{ role: "user", content: "hi" }],
        },
      },
    });

    const payload = await response.text();

    expect(payload).toContain("\"type\":\"complete\"");
    expect(payload).not.toContain("\"type\":\"error\"");
    expect(payload).toContain("\"content\":\"Visible reply\"");
    expect(postResponseSpy).toHaveBeenCalledWith(expect.objectContaining({
      fullResponse: "Visible reply",
      thinkingContent: "step-1",
      screenContent: "Visible reply",
    }));
  });
});

function createPreparedExecution(userInput: string): PreparedDialogueExecution {
  const blueprint = createBlueprint();
  const session = createStorySession({
    dialogueId: "dialogue-1",
    blueprint,
    now: "2026-05-29T00:00:00.000Z",
  });
  const turn = prepareStoryTurn({
    blueprint,
    session,
    userInput,
    model: {
      modelName: "gpt-test",
      apiKey: "key",
      baseUrl: "https://example.com",
      llmType: "openai",
    },
  });
  return {
    runtime: "story",
    context: turn,
    llmConfig: turn.llmConfig,
    postprocessNodeId: "story-runtime",
  };
}

function createBlueprint(): SessionBlueprint {
  return {
    id: "blueprint:test",
    schemaVersion: 2,
    sourceHash: "hash",
    createdAt: "2026-05-29T00:00:00.000Z",
    profile: {
      id: "char-1",
      name: "Character",
      promptFragments: [],
    },
    promptStack: {
      messages: [{
        id: "system",
        role: "system",
        content: "Stay in character.",
        enabled: true,
        order: 0,
        sourceKind: "preset",
        sourcePath: "fixture",
        sourceField: "prompt",
      }],
    },
    worldModules: [],
    inputTransforms: [],
    outputTransforms: [{
      id: "output",
      name: "output",
      direction: "output",
      enabled: true,
      pattern: "raw",
      replacement: "screen",
      sourcePath: "fixture",
    }],
    promptTransforms: [],
    contentRules: [],
    renderRules: [],
    memoryPolicy: {
      status: "deferred",
      phase: "SAC-Phase 6b",
      reason: "Long-term memory policy is defined in SAC-Phase 6b.",
    },
    diagnostics: [],
    repairReport: {
      appliedPatches: [],
      manualPatches: [],
      rejectedPatches: [],
    },
    provenance: [],
  };
}
