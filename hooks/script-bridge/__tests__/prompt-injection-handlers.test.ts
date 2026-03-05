import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiCallContext } from "../types";
import { promptInjectionHandlers } from "../prompt-injection-handlers";
import { clearPromptInjections } from "@/lib/slash-command/prompt-injection-store";

function createMockContext(overrides: Partial<ApiCallContext> = {}): ApiCallContext {
  return {
    characterId: "char-inject-test",
    dialogueId: "dialogue-inject-test",
    iframeId: "iframe-inject-test",
    messages: [],
    setScriptVariable: vi.fn(),
    deleteScriptVariable: vi.fn(),
    getVariablesSnapshot: () => ({
      global: {},
      character: {},
    }),
    ...overrides,
  };
}

describe("prompt injection handlers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearPromptInjections();
  });

  it("injectPrompts stores prompts and returns generated ids", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const ids = promptInjectionHandlers.injectPrompts(
      [[
        { content: "sys-1", role: "system", position: "in_chat" },
        { id: "prompt-2", content: "assistant-1", role: "assistant", position: "none", depth: 2 },
      ], { once: true }],
      createMockContext(),
    ) as string[];

    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe("prompt-2");
    const event = dispatchSpy.mock.calls.at(-1)?.[0] as CustomEvent;
    expect(event.type).toBe("DreamMiniStage:injectPrompts");
    expect(event.detail).toEqual(expect.objectContaining({
      once: true,
      prompts: expect.arrayContaining([
        expect.objectContaining({ content: "sys-1", role: "system" }),
        expect.objectContaining({ id: "prompt-2", position: "none", depth: 2 }),
      ]),
    }));
  });

  it("uninjectPrompts removes known ids and reports removed count", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const ids = promptInjectionHandlers.injectPrompts(
      [[{ id: "prompt-a", content: "hello", role: "user" }]],
      createMockContext(),
    ) as string[];
    expect(ids).toEqual(["prompt-a"]);

    const removed = promptInjectionHandlers.uninjectPrompts(
      [["prompt-a", "prompt-missing"]],
      createMockContext(),
    ) as number;

    expect(removed).toBe(1);
    const event = dispatchSpy.mock.calls.at(-1)?.[0] as CustomEvent;
    expect(event.type).toBe("DreamMiniStage:uninjectPrompts");
    expect(event.detail).toEqual(expect.objectContaining({
      ids: ["prompt-a", "prompt-missing"],
      removed: 1,
    }));
  });

  it("keeps fail-fast guards for invalid payload", () => {
    expect(() => promptInjectionHandlers.injectPrompts(
      [[], {}],
      createMockContext(),
    )).toThrow("non-empty prompt array");

    expect(() => promptInjectionHandlers.injectPrompts(
      [[{ content: "ok", role: "invalid" }]],
      createMockContext(),
    )).toThrow("must be system|assistant|user");

    expect(() => promptInjectionHandlers.uninjectPrompts(
      [["", 1]],
      createMockContext(),
    )).toThrow("non-empty string");
  });
});
