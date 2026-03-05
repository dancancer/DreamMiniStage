import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiCallContext } from "../types";
import { messageHandlers } from "../message-handlers";

function createMockContext(overrides: Partial<ApiCallContext> = {}): ApiCallContext {
  return {
    characterId: "char-message-test",
    dialogueId: "dialogue-message-test",
    presetName: "preset-message-test",
    messages: [
      { id: "m1", role: "user", content: "A" },
      { id: "m2", role: "assistant", content: "B" },
      { id: "m3", role: "assistant", content: "C" },
      { id: "m4", role: "user", content: "D" },
    ],
    setScriptVariable: vi.fn(),
    deleteScriptVariable: vi.fn(),
    getVariablesSnapshot: () => ({
      global: {},
      character: {},
    }),
    ...overrides,
  };
}

describe("message handler compat gaps", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("supports legacy setChatMessage and normalizes refresh mode", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const result = messageHandlers.setChatMessage(
      [{ message: "patched", data: { score: 7 } }, 3, { refresh: "display_and_render_current" }],
      createMockContext(),
    ) as boolean;

    expect(result).toBe(true);
    const emittedEvent = dispatchSpy.mock.calls.at(-1)?.[0] as CustomEvent;
    expect(emittedEvent.type).toBe("DreamMiniStage:setChatMessages");
    expect(emittedEvent.detail).toEqual(expect.objectContaining({
      messages: [
        {
          message_id: "3",
          message: "patched",
          data: { score: 7 },
        },
      ],
      options: {
        refresh: "affected",
      },
    }));
  });

  it("supports rotateChatMessages with stable [begin,middle,end) rotation", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const result = messageHandlers.rotateChatMessages(
      [1, 3, 4, { refresh: "all" }],
      createMockContext(),
    ) as string[];

    expect(result).toEqual(["m2", "m3", "m4"]);
    const emittedEvent = dispatchSpy.mock.calls.at(-1)?.[0] as CustomEvent;
    expect(emittedEvent.type).toBe("DreamMiniStage:setChatMessages");
    expect(emittedEvent.detail).toEqual(expect.objectContaining({
      messages: [
        { message_id: "m2", message: "D", name: undefined, role: "user" },
        { message_id: "m3", message: "B", name: undefined, role: "assistant" },
        { message_id: "m4", message: "C", name: undefined, role: "assistant" },
      ],
      options: {
        refresh: "all",
      },
    }));
  });

  it("keeps rotateChatMessages fail-fast when range is invalid", () => {
    expect(() => messageHandlers.rotateChatMessages(
      [3, 1, 2],
      createMockContext(),
    )).toThrow("begin <= middle <= end");
  });

  it("supports refreshOneMessage with message index/id and emits refresh event", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const ctx = createMockContext();

    const byIndex = messageHandlers.refreshOneMessage([1], ctx) as boolean;
    const byId = messageHandlers.refreshOneMessage(["m4"], ctx) as boolean;

    expect(byIndex).toBe(true);
    expect(byId).toBe(true);

    const firstEvent = dispatchSpy.mock.calls.at(-2)?.[0] as CustomEvent;
    const secondEvent = dispatchSpy.mock.calls.at(-1)?.[0] as CustomEvent;

    expect(firstEvent.type).toBe("DreamMiniStage:refreshOneMessage");
    expect(firstEvent.detail).toEqual(expect.objectContaining({
      message_id: "m2",
      index: 1,
    }));
    expect(secondEvent.type).toBe("DreamMiniStage:refreshOneMessage");
    expect(secondEvent.detail).toEqual(expect.objectContaining({
      message_id: "m4",
      index: 3,
    }));
  });
});
