/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   开场切换（未建树前）行为测试                              ║
 * ║  验证：未发送用户消息时切换开场不会调用后端，且 pendingOpening/消息同步更新   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { useDialogueStore } from "../dialogue-store";

vi.mock("@/function/dialogue/truncate", () => ({
  switchDialogueBranch: vi.fn(),
}));

describe("navigateOpening (pre-session)", () => {
  let switchDialogueBranch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await import("@/function/dialogue/truncate");
    switchDialogueBranch = mod.switchDialogueBranch as ReturnType<typeof vi.fn>;
    useDialogueStore.setState({ dialogues: {} });
    switchDialogueBranch.mockReset();
  });

  it("在未发送用户消息前切换开场仅更新本地状态，不调用后端", async () => {
    const dialogueKey = "session-1";
    const openings = [
      { id: "open-1", content: "开场1" },
      { id: "open-2", content: "开场2" },
    ];

    useDialogueStore.setState({
      dialogues: {
        [dialogueKey]: {
          messages: [{ id: "open-1", role: "assistant", content: "开场1" }],
          openingMessages: openings,
          openingIndex: 0,
          openingLocked: false,
          suggestedInputs: [],
          isSending: false,
          pendingOpening: openings[0],
        },
      },
    });

    await useDialogueStore.getState().navigateOpening(dialogueKey, "next");

    const dialogue = useDialogueStore.getState().dialogues[dialogueKey];
    expect(dialogue?.messages[0].id).toBe("open-2");
    expect(dialogue?.messages[0].content).toBe("开场2");
    expect(dialogue?.openingIndex).toBe(1);
    expect(dialogue?.pendingOpening?.id).toBe("open-2");
    expect(switchDialogueBranch).not.toHaveBeenCalled();
  });
});
