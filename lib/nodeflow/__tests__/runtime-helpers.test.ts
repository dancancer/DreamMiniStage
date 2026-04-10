import { describe, expect, it } from "vitest";

import { PostProcessingMode, type PromptNames } from "@/lib/core/st-preset-types";
import { normalizeMessages } from "@/lib/nodeflow/LLMNode/runtime-helpers";

const promptNames: PromptNames = {
  charName: "角色",
  userName: "用户",
  groupNames: [],
  startsWithGroupName: () => false,
};

describe("normalizeMessages", () => {
  it("forces strict user start for deepseek-reasoner", () => {
    const result = normalizeMessages({
      modelName: "deepseek-reasoner",
      apiKey: "test-key",
      llmType: "openai",
      promptNames,
      postProcessingMode: PostProcessingMode.MERGE,
      messages: [
        { role: "system", content: "system rules" },
        { role: "assistant", content: "opening reply" },
      ],
    });

    expect(result.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(result[3].content).toBe("Let's get started.");
  });

  it("re-merges turns after mid-prompt system becomes user", () => {
    const result = normalizeMessages({
      modelName: "deepseek-reasoner",
      apiKey: "test-key",
      llmType: "openai",
      promptNames,
      postProcessingMode: PostProcessingMode.STRICT,
      messages: [
        { role: "system", content: "system rules" },
        { role: "user", content: "first user turn" },
        { role: "system", content: "mid prompt system" },
        { role: "assistant", content: "assistant reply" },
      ],
    });

    expect(result.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(result[1].content).toContain("first user turn");
    expect(result[1].content).toContain("mid prompt system");
    expect(result[3].content).toBe("Let's get started.");
  });

  it("keeps non-deepseek models on their configured mode", () => {
    const result = normalizeMessages({
      modelName: "gpt-4o-mini",
      apiKey: "test-key",
      llmType: "openai",
      promptNames,
      postProcessingMode: PostProcessingMode.MERGE,
      messages: [
        { role: "system", content: "system rules" },
        { role: "assistant", content: "opening reply" },
      ],
    });

    expect(result.map((message) => message.role)).toEqual([
      "system",
      "assistant",
    ]);
  });

  it("adds empty reasoning_content to tool-call history for deepseek-reasoner", () => {
    const result = normalizeMessages({
      modelName: "deepseek-reasoner",
      apiKey: "test-key",
      llmType: "openai",
      promptNames,
      postProcessingMode: PostProcessingMode.STRICT,
      tools: true,
      messages: [
        { role: "user", content: "call tool" },
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "call-1",
              type: "function",
              function: {
                name: "tool_echo",
                arguments: "{\"input\":\"hello\"}",
              },
            },
          ],
        },
      ],
    });

    const assistantMessage = result[1] as typeof result[number] & {
      tool_calls?: unknown[];
      reasoning_content?: string;
    };

    expect(assistantMessage.tool_calls).toHaveLength(1);
    expect(assistantMessage.reasoning_content).toBe("");
    expect(result[result.length - 1]).toMatchObject({
      role: "user",
      content: "Let's get started.",
    });
  });

  it("does not end with assistant prefill for deepseek-reasoner", () => {
    const result = normalizeMessages({
      modelName: "deepseek-reasoner",
      apiKey: "test-key",
      llmType: "openai",
      promptNames,
      postProcessingMode: PostProcessingMode.STRICT,
      messages: [
        { role: "system", content: "system rules" },
        { role: "user", content: "latest user turn" },
        { role: "assistant", content: "<thinking>prefill</thinking>", prefix: true },
      ],
    });

    expect(result.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(result[3].content).toBe("Let's get started.");
  });

  it("does not inject reasoning_content for non-deepseek models", () => {
    const result = normalizeMessages({
      modelName: "gpt-4o-mini",
      apiKey: "test-key",
      llmType: "openai",
      promptNames,
      postProcessingMode: PostProcessingMode.STRICT,
      tools: true,
      messages: [
        { role: "user", content: "call tool" },
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "call-1",
              type: "function",
              function: {
                name: "tool_echo",
                arguments: "{\"input\":\"hello\"}",
              },
            },
          ],
        },
      ],
    });

    const assistantMessage = result[1] as typeof result[number] & {
      reasoning_content?: string;
    };

    expect(assistantMessage.reasoning_content).toBeUndefined();
  });
});
