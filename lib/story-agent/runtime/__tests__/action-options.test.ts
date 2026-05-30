import { describe, expect, it } from "vitest";
import {
  applyStoryActionOptions,
  extractStoryActionOptions,
  storyActionsSourcePattern,
} from "../action/options";

describe("story action options", () => {
  it("extracts numbered action lines into safe append-input options", () => {
    const options = extractStoryActionOptions([
      "<action>",
      "1. 检查后台门缝",
      "2. 询问侍者：关于刚才的铃声",
      "③ 暂时按兵不动",
      "</action>",
    ].join("\n"));

    expect(options).toEqual([
      {
        id: "action-1",
        label: "检查后台门缝",
        description: undefined,
        value: "检查后台门缝",
      },
      {
        id: "action-2",
        label: "询问侍者",
        description: "关于刚才的铃声",
        value: "询问侍者：关于刚才的铃声",
      },
      {
        id: "action-3",
        label: "暂时按兵不动",
        description: undefined,
        value: "暂时按兵不动",
      },
    ]);
  });

  it("emits an internal StoryActions source tag only when requested", () => {
    const result = applyStoryActionOptions("<action>搜查档案室</action>", {
      emitSourceTag: true,
    });

    expect(result.sourceTag).toContain("<StoryActions>");
    expect(result.sourceTag).toContain("搜查档案室");
    expect(storyActionsSourcePattern()).toBe("<StoryActions>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/StoryActions>");
  });
});
