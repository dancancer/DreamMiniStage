import { describe, expect, it } from "vitest";
import { DialogueNode, DialogueTree } from "@/lib/models/node-model";
import {
  ensureDialogueRootNode,
  getDialogueChatMetadata,
  setDialogueChatMetadata,
} from "@/lib/dialogue/chat-metadata";

describe("chat-metadata", () => {
  it("reads chat_metadata from the root extra payload", () => {
    const tree = new DialogueTree("d1", "c1", [
      new DialogueNode("root", "root", "", "", "", "", undefined, {
        chat_metadata: {
          timedWorldInfo: { book: { uid: { sticky: 3 } } },
        },
      }),
    ]);

    expect(getDialogueChatMetadata(tree)).toEqual({
      timedWorldInfo: { book: { uid: { sticky: 3 } } },
    });
  });

  it("falls back to imported jsonl chat_metadata when direct metadata is absent", () => {
    const tree = new DialogueTree("d1", "c1", [
      new DialogueNode("root", "root", "", "", "", "", undefined, {
        jsonl_metadata: {
          chat_metadata: {
            timedWorldInfo: { book: { uid: { delay: 2 } } },
          },
        },
      }),
    ]);

    expect(getDialogueChatMetadata(tree)).toEqual({
      timedWorldInfo: { book: { uid: { delay: 2 } } },
    });
  });

  it("writes metadata into both direct and jsonl metadata views", () => {
    const tree = new DialogueTree("d1", "c1", [
      new DialogueNode("root", "root", "", "", "", "", undefined, {
        jsonl_metadata: {
          user_name: "Tester",
        },
      }),
    ]);

    setDialogueChatMetadata(tree, {
      timedWorldInfo: { book: { uid: { cooldown: 1 } } },
    });

    const root = tree.nodes[0];
    expect(root.extra?.chat_metadata).toEqual({
      timedWorldInfo: { book: { uid: { cooldown: 1 } } },
    });
    expect((root.extra?.jsonl_metadata as Record<string, unknown>).chat_metadata).toEqual({
      timedWorldInfo: { book: { uid: { cooldown: 1 } } },
    });
  });

  it("creates a root node when the dialogue tree does not have one", () => {
    const tree = new DialogueTree("d1", "c1", []);
    const root = ensureDialogueRootNode(tree);

    expect(root.nodeId).toBe("root");
    expect(tree.nodes[0]?.nodeId).toBe("root");
  });
});
