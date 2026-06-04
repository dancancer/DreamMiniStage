import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiCallContext } from "../types";
import type { WorldBookEntry } from "@/lib/models/world-book-model";

const mocks = vi.hoisted(() => ({
  addWorldBookEntry: vi.fn(),
  deleteGlobalWorldBook: vi.fn(),
  deleteWorldBook: vi.fn(),
  deleteWorldBookEntry: vi.fn(),
  getWorldBook: vi.fn(),
  getWorldBooks: vi.fn(),
  importFromGlobalWorldBook: vi.fn(),
  importWorldBookFromJson: vi.fn(),
  listGlobalWorldBooks: vi.fn(),
  saveAsGlobalWorldBook: vi.fn(),
  updateWorldBook: vi.fn(),
  updateWorldBookEntry: vi.fn(),
  updateWorldBookSettings: vi.fn(),
}));

vi.mock("@/lib/data/roleplay/world-book-operation", () => ({
  WorldBookOperations: {
    addWorldBookEntry: mocks.addWorldBookEntry,
    deleteWorldBook: mocks.deleteWorldBook,
    deleteWorldBookEntry: mocks.deleteWorldBookEntry,
    getWorldBook: mocks.getWorldBook,
    getWorldBooks: mocks.getWorldBooks,
    updateWorldBook: mocks.updateWorldBook,
    updateWorldBookEntry: mocks.updateWorldBookEntry,
    updateWorldBookSettings: mocks.updateWorldBookSettings,
  },
}));

vi.mock("@/function/worldbook/import", () => ({
  importWorldBookFromJson: mocks.importWorldBookFromJson,
}));

vi.mock("@/function/worldbook/global", () => ({
  deleteGlobalWorldBook: mocks.deleteGlobalWorldBook,
  importFromGlobalWorldBook: mocks.importFromGlobalWorldBook,
  listGlobalWorldBooks: mocks.listGlobalWorldBooks,
  saveAsGlobalWorldBook: mocks.saveAsGlobalWorldBook,
}));

import { worldbookHandlers } from "../worldbook-handlers";

function createContext(overrides: Partial<ApiCallContext> = {}): ApiCallContext {
  return {
    characterId: "char-1",
    messages: [],
    setScriptVariable: vi.fn(),
    deleteScriptVariable: vi.fn(),
    getVariablesSnapshot: () => ({ global: {}, character: {} }),
    ...overrides,
  };
}

describe("worldbookHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses character-scoped record keys for current-character CRUD", async () => {
    const entry = { content: "entry", keys: ["entry"] } as WorldBookEntry;
    mocks.updateWorldBook.mockResolvedValueOnce(true);
    mocks.addWorldBookEntry.mockResolvedValueOnce("entry_0");
    mocks.updateWorldBookEntry.mockResolvedValueOnce(true);
    mocks.deleteWorldBookEntry.mockResolvedValueOnce(true);

    await worldbookHandlers["worldbook.replace"]([{ entry_0: entry }], createContext());
    await worldbookHandlers["worldbook.createEntry"]([entry], createContext());
    await worldbookHandlers["worldbook.updateEntry"](["entry_0", { content: "next" }], createContext());
    await worldbookHandlers["worldbook.deleteEntry"](["entry_0"], createContext());

    expect(mocks.updateWorldBook).toHaveBeenCalledWith("character:char-1", { entry_0: entry });
    expect(mocks.addWorldBookEntry).toHaveBeenCalledWith("character:char-1", entry);
    expect(mocks.updateWorldBookEntry).toHaveBeenCalledWith("character:char-1", "entry_0", { content: "next" });
    expect(mocks.deleteWorldBookEntry).toHaveBeenCalledWith("character:char-1", "entry_0");
  });

  it("passes record keys to import and global actions", async () => {
    mocks.importWorldBookFromJson.mockResolvedValueOnce({ success: true });
    mocks.saveAsGlobalWorldBook.mockResolvedValueOnce({ success: true });
    mocks.importFromGlobalWorldBook.mockResolvedValueOnce({ success: true });

    await worldbookHandlers["worldbook.importJson"](["{\"entries\":[]}"], createContext());
    await worldbookHandlers["worldbook.saveAsGlobal"](["Shared"], createContext());
    await worldbookHandlers["worldbook.importFromGlobal"](["global:shared"], createContext());

    expect(mocks.importWorldBookFromJson).toHaveBeenCalledWith("character:char-1", { entries: [] }, undefined);
    expect(mocks.saveAsGlobalWorldBook).toHaveBeenCalledWith("character:char-1", "Shared", undefined, "char-1");
    expect(mocks.importFromGlobalWorldBook).toHaveBeenCalledWith("character:char-1", "global:shared");
  });

  it("keeps explicit worldbook targets unchanged", async () => {
    const entry = { content: "entry", keys: ["entry"] } as WorldBookEntry;
    mocks.updateWorldBook.mockResolvedValueOnce(true);

    const result = await worldbookHandlers["worldbook.createWorldbook"](
      ["global:manual", { entry_0: entry }],
      createContext(),
    );

    expect(result).toBe("global:manual");
    expect(mocks.updateWorldBook).toHaveBeenCalledWith("global:manual", { entry_0: entry });
  });
});
