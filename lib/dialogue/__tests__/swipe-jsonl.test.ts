import { describe, expect, it } from "vitest";
import { DialogueNode, DialogueTree } from "@/lib/models/node-model";
import { getSwipeInfo, resolveSwipeTargetNodeId } from "@/lib/dialogue/swipe-variants";
import { exportDialogueTreeToJsonl, importJsonlToDialogueTree } from "@/lib/dialogue/jsonl";

function makeNode(params: {
  nodeId: string;
  parentNodeId: string;
  userInput: string;
  assistant: string;
}) {
  return new DialogueNode(
    params.nodeId,
    params.parentNodeId,
    params.userInput,
    params.assistant,
    params.assistant,
    "",
    undefined,
  );
}

describe("assistant swipe variants", () => {
  it("enumerates siblings and resolves next/prev/index", () => {
    const nodes = [
      makeNode({ nodeId: "root", parentNodeId: "root", userInput: "", assistant: "" }),
      makeNode({ nodeId: "t1a", parentNodeId: "root", userInput: "hi", assistant: "a" }),
      makeNode({ nodeId: "t1b", parentNodeId: "root", userInput: "hi", assistant: "b" }),
      makeNode({ nodeId: "t1c", parentNodeId: "root", userInput: "hi", assistant: "c" }),
    ];

    const tree = new DialogueTree("d1", "c1", nodes, "t1b");

    expect(getSwipeInfo(tree, "t1b")).toEqual({ activeIndex: 1, total: 3 });
    expect(resolveSwipeTargetNodeId(tree, "t1b", { kind: "next" })).toBe("t1c");
    expect(resolveSwipeTargetNodeId(tree, "t1b", { kind: "prev" })).toBe("t1a");
    expect(resolveSwipeTargetNodeId(tree, "t1b", { kind: "index", index: 0 })).toBe("t1a");
    expect(resolveSwipeTargetNodeId(tree, "t1b", { kind: "index", index: 99 })).toBe("t1c");
  });
});

describe("JSONL import/export", () => {
  it("round-trips swipes and selected index", () => {
    const nodes = [
      makeNode({ nodeId: "root", parentNodeId: "root", userInput: "", assistant: "" }),
      makeNode({ nodeId: "turn1-0", parentNodeId: "root", userInput: "hi", assistant: "a" }),
      makeNode({ nodeId: "turn1-1", parentNodeId: "root", userInput: "hi", assistant: "b" }),
      makeNode({ nodeId: "turn1-2", parentNodeId: "root", userInput: "hi", assistant: "c" }),
    ];

    const tree = new DialogueTree("d1", "c1", nodes, "turn1-1");
    const jsonl = exportDialogueTreeToJsonl(tree, { userName: "u", characterName: "c" });

    let seq = 0;
    const { tree: imported } = importJsonlToDialogueTree(jsonl, {
      dialogueId: "d1",
      characterId: "c1",
      generateId: () => `n${++seq}`,
    });

    const exportedAgain = exportDialogueTreeToJsonl(imported, { userName: "u", characterName: "c" });

    const originalLines = jsonl.split("\n").slice(1).map((line) => JSON.parse(line));
    const roundtripLines = exportedAgain.split("\n").slice(1).map((line) => JSON.parse(line));

    expect(roundtripLines).toEqual(originalLines);
  });

  it("round-trips imported metadata header and message extra fields", () => {
    const jsonl = [
      JSON.stringify({
        user_name: "u",
        character_name: "c",
        create_date: "2026-03-12T10:00:00.000Z",
        chat_metadata: {
          timedWorldInfo: {
            tavern: {
              fire: true,
            },
          },
        },
        scenario: "phase-3-jsonl",
      }),
      JSON.stringify({
        is_user: true,
        is_system: false,
        mes: "hi",
        name: "u",
        send_date: 123,
      }),
      JSON.stringify({
        is_user: false,
        is_system: false,
        mes: "hello",
        name: "c",
        send_date: 124,
        extra: {
          model: "gpt-test",
          token_count: 42,
        },
        swipes: ["hello", "hello alt"],
        swipe_id: 0,
      }),
    ].join("\n");

    let seq = 0;
    const { tree } = importJsonlToDialogueTree(jsonl, {
      dialogueId: "d1",
      characterId: "c1",
      generateId: () => `n${++seq}`,
    });

    const exportedAgain = exportDialogueTreeToJsonl(tree, { userName: "u", characterName: "c" });

    expect(exportedAgain.split("\n").map((line) => JSON.parse(line))).toEqual(
      jsonl.split("\n").map((line) => JSON.parse(line)),
    );
  });

  it("does not add swipes when no siblings exist", () => {
    const nodes = [
      makeNode({ nodeId: "root", parentNodeId: "root", userInput: "", assistant: "" }),
      makeNode({ nodeId: "turn1", parentNodeId: "root", userInput: "hi", assistant: "a" }),
    ];
    const tree = new DialogueTree("d1", "c1", nodes, "turn1");
    const jsonl = exportDialogueTreeToJsonl(tree);
    const messageLine = JSON.parse(jsonl.split("\n")[2] ?? "{}");
    expect(messageLine.swipes).toBeUndefined();
    expect(messageLine.swipe_id).toBeUndefined();
  });
});
