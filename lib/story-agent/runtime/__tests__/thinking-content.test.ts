import { describe, expect, it } from "vitest";
import {
  applyStoryStateUpdate,
  createEmptyStoryState,
  extractStoryThinkingContent,
} from "@/lib/story-agent/runtime/state/update";

describe("extractStoryThinkingContent", () => {
  it("captures a thinking block as reasoning content", () => {
    expect(
      extractStoryThinkingContent("<thinking>plan the scene</thinking>narrative body"),
    ).toBe("plan the scene");
  });

  it("joins multiple thinking blocks", () => {
    expect(
      extractStoryThinkingContent("<thinking>a</thinking>body<thinking>b</thinking>"),
    ).toBe("a\n\nb");
  });

  it("returns empty string when there is no thinking block", () => {
    expect(extractStoryThinkingContent("just narrative")).toBe("");
  });
});

describe("applyStoryStateUpdate screen stripping", () => {
  it("strips thinking from screen text even inside a gametxt block", () => {
    const now = "2026-06-10T00:00:00.000Z";
    const result = applyStoryStateUpdate(
      "<gametxt><thinking>secret plan</thinking>visible body</gametxt>",
      createEmptyStoryState(now),
      { now, emitSourceTag: false },
    );
    expect(result.screenText).not.toContain("secret plan");
    expect(result.screenText).toContain("visible body");
  });
});
