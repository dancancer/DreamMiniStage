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

  it("drops an untagged planning preamble before the formal-creation delimiter", () => {
    const now = "2026-06-10T00:00:00.000Z";
    const leaked = [
      "好的，haruki已理解了这个创作任务。让我先进行构思，然后创作小说片段。",
      "## 构思",
      "### 当前情景总结",
      "时间是静默纪元102年的某个早晨。",
      "## 正式创作",
      "随着冷冻舱的舱门缓缓开启，你睁开了眼睛。",
    ].join("\n\n");
    const result = applyStoryStateUpdate(leaked, createEmptyStoryState(now), {
      now,
      emitSourceTag: false,
    });
    expect(result.screenText).not.toContain("构思");
    expect(result.screenText).not.toContain("haruki");
    expect(result.screenText).not.toContain("正式创作");
    expect(result.screenText).toContain("随着冷冻舱的舱门缓缓开启");
  });

  it("leaves normal narrative untouched when no formal-creation delimiter is present", () => {
    const now = "2026-06-10T00:00:00.000Z";
    const body = "她抬起头，浅灰色的眼眸里漾开柔光。";
    const result = applyStoryStateUpdate(body, createEmptyStoryState(now), {
      now,
      emitSourceTag: false,
    });
    expect(result.screenText).toBe(body);
  });
});
