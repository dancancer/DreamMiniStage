/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   首条用户消息建树与开场落盘测试                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleCharacterChatRequest } from "../chat";

const getDialogueTreeById = vi.fn();
const createDialogueTree = vi.fn();
const addNodeToDialogueTree = vi.fn();
const switchBranch = vi.fn();
const updateNodeInDialogueTree = vi.fn();
const ingestMock = vi.fn();
const processMessageVariables = vi.fn();
const getActivePromptPreset = vi.fn();
const resolvePromptRuntimeConfig = vi.fn();
const prepareDialogueExecutionMock = vi.fn();
const runDialogueGenerationMock = vi.fn();

const DEFAULT_PROMPT_RUNTIME = {
  contextPreset: {
    name: "Default",
    story_string: "",
    example_separator: "***",
    chat_start: "***",
  },
  sysprompt: { enabled: false, name: "Default", content: "", post_history: "" },
  stopStrings: [],
  promptNames: {
    charName: "char-1",
    userName: "user",
    groupNames: [],
    startsWithGroupName: () => false,
  },
  postProcessingMode: "none",
  effectiveConfig: {
    presetName: null,
    instructEnabled: false,
    instructPreset: null,
    promptPostProcessing: "none",
    contextName: "Default",
    syspromptEnabled: false,
    syspromptName: "Default",
    stopStrings: [],
  },
};

vi.mock("@/lib/workflow/examples/DialogueWorkflow", () => ({
  DialogueWorkflow: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@/lib/prompt-config/service", () => ({
  getActivePromptPreset: (...args: unknown[]) => getActivePromptPreset(...args),
  resolvePromptRuntimeConfig: (...args: unknown[]) => resolvePromptRuntimeConfig(...args),
}));

vi.mock("@/lib/vector-memory/manager", () => ({
  getVectorMemoryManager: () => ({
    ingest: ingestMock,
  }),
}));

vi.mock("@/lib/mvu", () => ({
  processMessageVariables: (...args: unknown[]) => processMessageVariables(...args),
  initMvuVariablesFromWorldBooks: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/generation-runtime/prepare/prepare-dialogue-execution", () => ({
  prepareDialogueExecution: (...args: unknown[]) => prepareDialogueExecutionMock(...args),
}));

vi.mock("@/lib/generation-runtime/run-dialogue-generation", () => ({
  runDialogueGeneration: (...args: unknown[]) => runDialogueGenerationMock(...args),
}));

vi.mock("@/lib/data/roleplay/character-dialogue-operation", () => ({
  LocalCharacterDialogueOperations: {
    getDialogueTreeById: (...args: unknown[]) => getDialogueTreeById(...args),
    createDialogueTree: (...args: unknown[]) => createDialogueTree(...args),
    addNodeToDialogueTree: (...args: unknown[]) => addNodeToDialogueTree(...args),
    switchBranch: (...args: unknown[]) => switchBranch(...args),
    updateNodeInDialogueTree: (...args: unknown[]) => updateNodeInDialogueTree(...args),
  },
}));

describe("handleCharacterChatRequest 首条消息建树并写入开场", () => {
  beforeEach(() => {
    getDialogueTreeById.mockReset();
    createDialogueTree.mockReset();
    addNodeToDialogueTree.mockReset();
    switchBranch.mockReset();
    updateNodeInDialogueTree.mockReset();
    ingestMock.mockReset();
    processMessageVariables.mockReset();
    getActivePromptPreset.mockReset();
    resolvePromptRuntimeConfig.mockReset();
    prepareDialogueExecutionMock.mockReset();
    runDialogueGenerationMock.mockReset();

    getDialogueTreeById
      .mockResolvedValueOnce(null) // ensure tree missing at first
      .mockResolvedValue({
        id: "session-1",
        character_id: "char-1",
        nodes: [],
        current_nodeId: "session-1-opening",
      });

    createDialogueTree.mockResolvedValue({
      id: "session-1",
      nodes: [],
      current_nodeId: "root",
    });

    addNodeToDialogueTree.mockResolvedValueOnce("session-1-opening").mockResolvedValue("assistant-1");
    switchBranch.mockResolvedValue(true);
    updateNodeInDialogueTree.mockResolvedValue({
      id: "session-1",
      character_id: "char-1",
      nodes: [],
      current_nodeId: "assistant-1",
    });

    getActivePromptPreset.mockResolvedValue(null);
    resolvePromptRuntimeConfig.mockResolvedValue(DEFAULT_PROMPT_RUNTIME);
    prepareDialogueExecutionMock.mockImplementation(async (params) => ({
      context: { id: "ctx-1" },
      llmConfig: params,
      postprocessNodeId: "regex-1",
    }));
    runDialogueGenerationMock.mockImplementation(async (_input, sink) => {
      await sink.emit({
        type: "complete",
        result: {
          screenContent: "reply",
          fullResponse: "full reply",
          thinkingContent: "think",
          parsedContent: { nextPrompts: [] },
          event: "",
          isPostProcessed: true,
        },
      });
    });

    ingestMock.mockResolvedValue(undefined);
    processMessageVariables.mockResolvedValue(undefined);
  });

  it("创建对话树并写入开场节点后，仅执行一次 DialogueWorkflow", async () => {
    const response = await handleCharacterChatRequest({
      username: "user",
      dialogueId: "session-1",
      characterId: "char-1",
      message: "hi",
      modelName: "gpt",
      baseUrl: "",
      apiKey: "key",
      llmType: "openai",
      language: "zh",
      number: 100,
      nodeId: "assistant-1",
      fastModel: false,
      openingMessage: {
        id: "session-1-opening",
        content: "opening regex",
        fullContent: "opening raw",
      },
    });

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(createDialogueTree).toHaveBeenCalledWith("session-1", "char-1");
    expect(addNodeToDialogueTree).toHaveBeenCalledWith(
      "session-1",
      "root",
      "",
      "opening regex",
      "opening raw",
      "",
      expect.objectContaining({ regexResult: "opening regex" }),
      "session-1-opening",
    );
    expect(addNodeToDialogueTree).toHaveBeenCalledWith(
      "session-1",
      "session-1-opening",
      "hi",
      "",
      "",
      "",
      undefined,
      "assistant-1",
    );
    expect(runDialogueGenerationMock).toHaveBeenCalledTimes(1);
    expect(runDialogueGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
      dialogueId: "session-1",
      originalMessage: "hi",
      nodeId: "assistant-1",
    }), expect.any(Object));
  });

  it("在显式开启 function-calling 策略时透传 mvuToolEnabled 到 workflow", async () => {
    await handleCharacterChatRequest({
      username: "user",
      dialogueId: "session-1",
      characterId: "char-1",
      message: "hi",
      modelName: "gpt",
      baseUrl: "",
      apiKey: "key",
      llmType: "openai",
      language: "zh",
      number: 100,
      nodeId: "assistant-1",
      fastModel: false,
      mvuToolEnabled: true,
      openingMessage: {
        id: "session-1-opening",
        content: "opening regex",
        fullContent: "opening raw",
      },
    });

    expect(prepareDialogueExecutionMock).toHaveBeenCalledWith(expect.objectContaining({
      mvuToolEnabled: true,
    }));
  });

  it("workflow 失败时仍先持久化用户输入节点", async () => {
    getDialogueTreeById.mockReset();
    createDialogueTree.mockReset();
    addNodeToDialogueTree.mockReset();
    updateNodeInDialogueTree.mockReset();
    prepareDialogueExecutionMock.mockReset();
    runDialogueGenerationMock.mockReset();
    getActivePromptPreset.mockReset();
    resolvePromptRuntimeConfig.mockReset();

    getDialogueTreeById.mockResolvedValue({
      id: "session-fail",
      character_id: "char-1",
      nodes: [],
      current_nodeId: "root",
    });

    addNodeToDialogueTree.mockResolvedValue("pending-node");
    getActivePromptPreset.mockResolvedValue(null);
    resolvePromptRuntimeConfig.mockResolvedValue(DEFAULT_PROMPT_RUNTIME);
    prepareDialogueExecutionMock.mockImplementation(async (params) => ({
      context: { id: "ctx-fail" },
      llmConfig: params,
      postprocessNodeId: "regex-1",
    }));
    runDialogueGenerationMock.mockResolvedValue(undefined);

    const response = await handleCharacterChatRequest({
      username: "user",
      dialogueId: "session-fail",
      characterId: "char-1",
      message: "/send hi|/trigger",
      modelName: "gpt",
      baseUrl: "",
      apiKey: "key",
      llmType: "openai",
      language: "zh",
      number: 100,
      nodeId: "pending-node",
      fastModel: false,
    });

    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body).toMatchObject({ success: false, message: "No response returned from workflow" });
    expect(addNodeToDialogueTree).toHaveBeenCalledWith(
      "session-fail",
      "root",
      "/send hi|/trigger",
      "",
      "",
      "",
      undefined,
      "pending-node",
    );
    expect(updateNodeInDialogueTree).not.toHaveBeenCalled();
    expect(createDialogueTree).not.toHaveBeenCalled();
  });
});

describe("handleCharacterChatRequest 模型参数透传", () => {
  beforeEach(() => {
    getDialogueTreeById.mockReset();
    createDialogueTree.mockReset();
    addNodeToDialogueTree.mockReset();
    updateNodeInDialogueTree.mockReset();
    getActivePromptPreset.mockReset();
    resolvePromptRuntimeConfig.mockReset();
    prepareDialogueExecutionMock.mockReset();
    runDialogueGenerationMock.mockReset();

    getDialogueTreeById.mockResolvedValue({
      id: "session-advanced",
      character_id: "char-1",
      nodes: [],
      current_nodeId: "root",
    });
    addNodeToDialogueTree.mockResolvedValue("assistant-advanced");
    updateNodeInDialogueTree.mockResolvedValue(true);
    getActivePromptPreset.mockResolvedValue(null);
    resolvePromptRuntimeConfig.mockResolvedValue(DEFAULT_PROMPT_RUNTIME);
    prepareDialogueExecutionMock.mockImplementation(async (params) => ({
      context: { id: "ctx-advanced" },
      llmConfig: params,
      postprocessNodeId: "regex-1",
    }));
    runDialogueGenerationMock.mockImplementation(async (_input, sink) => {
      await sink.emit({
        type: "complete",
        result: {
          screenContent: "reply",
          fullResponse: "reply",
          thinkingContent: "",
          parsedContent: { nextPrompts: [] },
          event: "",
          isPostProcessed: true,
        },
      });
    });
  });

  it("将高级设置从请求透传到 DialogueWorkflow", async () => {
    await handleCharacterChatRequest({
      username: "user",
      dialogueId: "session-advanced",
      characterId: "char-1",
      message: "hi",
      modelName: "gpt-4o-mini",
      baseUrl: "https://api.example.com/v1",
      apiKey: "key",
      llmType: "openai",
      language: "zh",
      number: 200,
      nodeId: "assistant-advanced",
      fastModel: false,
      advanced: {
        temperature: 0.35,
        contextWindow: 8192,
        maxTokens: 640,
        timeout: 15000,
        maxRetries: 3,
        topP: 0.88,
        frequencyPenalty: 0.2,
        presencePenalty: 0.1,
        topK: 50,
        repeatPenalty: 1.08,
        streaming: false,
        streamUsage: false,
      },
    });

    expect(prepareDialogueExecutionMock).toHaveBeenCalledWith(expect.objectContaining({
      temperature: 0.35,
      contextWindow: 8192,
      maxTokens: 640,
      timeout: 15000,
      maxRetries: 3,
      topP: 0.88,
      frequencyPenalty: 0.2,
      presencePenalty: 0.1,
      topK: 50,
      repeatPenalty: 1.08,
      streaming: false,
      streamUsage: false,
    }));
  });

  it("显式非流式请求不应被 preset 的 streaming 默认值升级为 SSE", async () => {
    getActivePromptPreset.mockResolvedValue({ sampling: { streaming: true } });

    const response = await handleCharacterChatRequest({
      username: "user",
      dialogueId: "session-advanced",
      characterId: "char-1",
      message: "hi",
      modelName: "gpt-4o-mini",
      baseUrl: "https://api.example.com/v1",
      apiKey: "key",
      llmType: "openai",
      language: "zh",
      number: 200,
      nodeId: "assistant-advanced",
      fastModel: false,
      streaming: false,
    });

    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(prepareDialogueExecutionMock).toHaveBeenCalledWith(expect.objectContaining({
      streaming: true,
    }));
  });
});
