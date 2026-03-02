/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                  MVU Handlers Option Semantics Tests                      ║
 * ║                                                                           ║
 * ║  对齐上游常见 { type, message_id } 参数语义并覆盖会话键选择                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiCallContext } from "../types";
import type { MvuData } from "@/lib/mvu";

const {
  mockGetCharacterVariables,
  mockGetNodeVariables,
  mockGetVariables,
  mockGetMessageVariables,
  mockSetVariable,
  storeState,
} = vi.hoisted(() => {
  const getCharacterVariables = vi.fn();
  const getNodeVariables = vi.fn();
  const getVariables = vi.fn();
  const getMessageVariables = vi.fn();
  const setVariable = vi.fn();

  return {
    mockGetCharacterVariables: getCharacterVariables,
    mockGetNodeVariables: getNodeVariables,
    mockGetVariables: getVariables,
    mockGetMessageVariables: getMessageVariables,
    mockSetVariable: setVariable,
    storeState: {
      getVariables,
      getMessageVariables,
      setVariable,
      setVariables: vi.fn(),
      initSession: vi.fn(),
      updateFromMessage: vi.fn(),
      saveSnapshot: vi.fn(),
      rollbackToSnapshot: vi.fn(),
      cleanupSnapshots: vi.fn(),
      isInitialized: vi.fn(),
      clearSession: vi.fn(),
    },
  };
});

vi.mock("@/lib/mvu", () => ({
  useMvuStore: {
    getState: () => storeState,
  },
  getSessionKey: (raw: string) => `session:${raw}`,
  safeGetValue: (value: unknown, defaultValue: unknown) => value ?? defaultValue,
  getCharacterVariables: mockGetCharacterVariables,
  getNodeVariables: mockGetNodeVariables,
}));

import { mvuHandlers } from "../mvu-handlers";

function createMvuData(seed = 1): MvuData {
  return {
    stat_data: { hp: seed },
    display_data: { hp: `HP:${seed}` },
    delta_data: { hp: seed - 1 },
    initialized_lorebooks: {},
  };
}

function createContext(overrides: Partial<ApiCallContext> = {}): ApiCallContext {
  return {
    characterId: "char-1",
    dialogueId: "dialogue-1",
    chatId: "chat-1",
    messages: [
      { id: "m0", role: "user", content: "start" },
      { id: "m1", role: "assistant", content: "middle" },
      { id: "m2", role: "assistant", content: "latest" },
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

describe("mvu handlers option semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves message scope with latest/negative index and category", async () => {
    mockGetNodeVariables.mockResolvedValue(createMvuData(9));
    const ctx = createContext();

    const latestDisplay = await mvuHandlers["mvu.getVariable"](
      [{ type: "message", message_id: "latest", category: "display" }],
      ctx,
    );
    expect(latestDisplay).toEqual({ hp: "HP:9" });
    expect(mockGetNodeVariables).toHaveBeenCalledWith({ dialogueKey: "chat-1" }, "m2");

    const indexedStat = await mvuHandlers["mvu.getVariable"](
      [{ type: "message", message_id: -2, category: "stat" }],
      ctx,
    );
    expect(indexedStat).toEqual({ hp: 9 });
    expect(mockGetNodeVariables).toHaveBeenLastCalledWith({ dialogueKey: "chat-1" }, "m1");
  });

  it("supports mvu.getVariables legacy message id argument and option object", async () => {
    mockGetNodeVariables.mockResolvedValue(createMvuData(7));
    const ctx = createContext();

    const byNumericIndex = await mvuHandlers["mvu.getVariables"]([1], ctx);
    expect(byNumericIndex).toEqual(createMvuData(7));
    expect(mockGetNodeVariables).toHaveBeenCalledWith({ dialogueKey: "chat-1" }, "m1");

    await mvuHandlers["mvu.getVariables"]([{ type: "message", message_id: "latest" }], ctx);
    expect(mockGetNodeVariables).toHaveBeenLastCalledWith({ dialogueKey: "chat-1" }, "m2");
  });

  it("fails fast on out-of-range message_id", async () => {
    const ctx = createContext();

    await expect(
      mvuHandlers["mvu.getVariable"]([{ type: "message", message_id: 3 }], ctx),
    ).rejects.toThrow("超出范围");
  });

  it("falls back to store and uses dialogue/chat key as session key", async () => {
    mockGetVariables.mockReturnValue(createMvuData(5));
    mockGetMessageVariables.mockReturnValue(createMvuData(6));

    const noDialogueCtx = createContext({
      characterId: undefined,
      dialogueId: undefined,
      chatId: undefined,
    });

    const fromStore = await mvuHandlers["mvu.getVariable"]([{ type: "message", message_id: "latest" }], noDialogueCtx);
    expect(fromStore).toEqual({ hp: 6 });
    expect(mockGetMessageVariables).toHaveBeenCalledWith("session:global", "m2");

    const chatCtx = createContext({ chatId: undefined, dialogueId: "dialogue-9", characterId: "char-9" });
    mvuHandlers["mvu.set"](["hp", 99, "test"], chatCtx);
    expect(mockSetVariable).toHaveBeenCalledWith("session:dialogue-9", "hp", 99, "test");
  });
});
