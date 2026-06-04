import { describe, expect, it } from "vitest";
import { getOpeningNavigatorState } from "@/components/character-chat/opening-selection";

describe("opening selection navigator state", () => {
  it("shows navigator only for unlocked assistant-only opening preview", () => {
    const state = getOpeningNavigatorState({
      selection: {
        messages: [
          { id: "open-1", content: "first" },
          { id: "open-2", content: "second" },
        ],
        index: 1,
        locked: false,
      },
      visibleMessageCount: 1,
      firstVisibleRole: "assistant",
      label: "Opening",
    });

    expect(state).toEqual({
      visible: true,
      current: 1,
      total: 2,
      label: "Opening",
    });
  });

  it("hides navigator after the opening is locked", () => {
    const state = getOpeningNavigatorState({
      selection: {
        messages: [
          { id: "open-1", content: "first" },
          { id: "open-2", content: "second" },
        ],
        index: 0,
        locked: true,
      },
      visibleMessageCount: 1,
      firstVisibleRole: "assistant",
      label: "Opening",
    });

    expect(state.visible).toBe(false);
  });

  it("clamps stale opening index before rendering the counter", () => {
    const state = getOpeningNavigatorState({
      selection: {
        messages: [
          { id: "open-1", content: "first" },
          { id: "open-2", content: "second" },
        ],
        index: 8,
        locked: false,
      },
      visibleMessageCount: 1,
      firstVisibleRole: "assistant",
      label: "Opening",
    });

    expect(state.current).toBe(1);
    expect(state.total).toBe(2);
  });
});
