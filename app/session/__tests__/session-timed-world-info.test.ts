import { beforeEach, describe, expect, it, vi } from "vitest";
import { DialogueNode, DialogueTree } from "@/lib/models/node-model";

const mocks = vi.hoisted(() => ({
  getDialogueTreeById: vi.fn(),
  updateDialogueTree: vi.fn(),
  getWorldBook: vi.fn(),
}));

vi.mock("@/lib/data/roleplay/character-dialogue-operation", () => ({
  LocalCharacterDialogueOperations: {
    getDialogueTreeById: mocks.getDialogueTreeById,
    updateDialogueTree: mocks.updateDialogueTree,
  },
}));

vi.mock("@/lib/data/roleplay/world-book-operation", () => ({
  WorldBookOperations: {
    getWorldBook: mocks.getWorldBook,
  },
}));

import {
  getSessionWorldInfoTimedEffect,
  setSessionWorldInfoTimedEffect,
} from "../session-timed-world-info";

function buildDialogueTree(extra?: Record<string, unknown>) {
  return new DialogueTree("session-1", "char-1", [
    new DialogueNode("root", "root", "", "", "", "", undefined, extra),
  ]);
}

function buildWorldBookEntry(overrides?: Record<string, unknown>) {
  return {
    entry_id: "uid-1",
    content: "entry",
    keys: ["alpha"],
    selective: false,
    constant: false,
    position: 4,
    enabled: true,
    sticky: 3,
    delay: 2,
    ...overrides,
  };
}

describe("session-timed-world-info", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDialogueTreeById.mockResolvedValue(buildDialogueTree());
    mocks.updateDialogueTree.mockResolvedValue(true);
    mocks.getWorldBook.mockResolvedValue({
      entry_0: buildWorldBookEntry(),
    });
  });

  it("returns boolean/number timed effect state from dialogue chat metadata", async () => {
    mocks.getDialogueTreeById.mockResolvedValue(buildDialogueTree({
      chat_metadata: {
        timedWorldInfo: {
          "book-1": {
            "uid-1": {
              sticky: 3,
            },
          },
        },
      },
    }));

    const boolValue = await getSessionWorldInfoTimedEffect({
      dialogueId: "session-1",
      file: "book-1",
      uid: "uid-1",
      effect: "sticky",
      format: "boolean",
    });
    const numberValue = await getSessionWorldInfoTimedEffect({
      dialogueId: "session-1",
      file: "book-1",
      uid: "uid-1",
      effect: "sticky",
      format: "number",
    });

    expect(boolValue).toBe(true);
    expect(numberValue).toBe(3);
  });

  it("writes configured timed effect values into chat_metadata.timedWorldInfo", async () => {
    const tree = buildDialogueTree();
    mocks.getDialogueTreeById.mockResolvedValue(tree);

    await setSessionWorldInfoTimedEffect({
      dialogueId: "session-1",
      file: "book-1",
      uid: "uid-1",
      effect: "sticky",
      state: "on",
    });

    const updatedTree = mocks.updateDialogueTree.mock.calls[0]?.[1] as DialogueTree;
    const rootExtra = updatedTree.nodes[0]?.extra as Record<string, unknown>;
    expect(rootExtra.chat_metadata).toEqual({
      timedWorldInfo: {
        "book-1": {
          "uid-1": {
            sticky: 3,
          },
        },
      },
    });
  });

  it("toggle/off clears timed effect state and prunes empty metadata branches", async () => {
    const tree = buildDialogueTree({
      chat_metadata: {
        timedWorldInfo: {
          "book-1": {
            "uid-1": {
              sticky: 3,
            },
          },
        },
      },
    });
    mocks.getDialogueTreeById.mockResolvedValue(tree);

    await setSessionWorldInfoTimedEffect({
      dialogueId: "session-1",
      file: "book-1",
      uid: "uid-1",
      effect: "sticky",
      state: "toggle",
    });

    const updatedTree = mocks.updateDialogueTree.mock.calls[0]?.[1] as DialogueTree;
    const rootExtra = updatedTree.nodes[0]?.extra as Record<string, unknown>;
    expect(rootExtra.chat_metadata).toEqual({});
  });

  it("fails fast when the effect is not configured on the lore entry", async () => {
    mocks.getWorldBook.mockResolvedValue({
      entry_0: buildWorldBookEntry({ cooldown: 0 }),
    });

    await expect(setSessionWorldInfoTimedEffect({
      dialogueId: "session-1",
      file: "book-1",
      uid: "uid-1",
      effect: "cooldown",
      state: "on",
    })).rejects.toThrow("/wi-set-timed-effect effect is not configured on lore entry: cooldown");
  });

  it("fails fast when lorebook entry cannot be resolved", async () => {
    mocks.getWorldBook.mockResolvedValue({});

    await expect(getSessionWorldInfoTimedEffect({
      dialogueId: "session-1",
      file: "book-1",
      uid: "missing",
      effect: "sticky",
      format: "boolean",
    })).rejects.toThrow("Lorebook entry not found: missing");
  });
});
