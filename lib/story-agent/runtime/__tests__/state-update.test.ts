import { describe, expect, it } from "vitest";
import {
  applyStoryStateUpdate,
  createEmptyStoryState,
  storyStateSourcePattern,
} from "../state/update";
import { extractRenderIntentMatches, stripRenderIntentSources } from "@/lib/story-agent/render-intent";
import type { RenderIntent } from "@/lib/story-agent/render-intent";

const stateIntent: RenderIntent = {
  schemaVersion: 1,
  id: "state",
  kind: "state-panel",
  sourceScriptId: "script",
  title: "Story State",
  confidence: 0.8,
  dataTemplate: "$1",
  sourcePattern: storyStateSourcePattern(),
};

describe("StoryState UpdateVariable runtime", () => {
  it("applies safe UpdateVariable commands and hides raw blocks", () => {
    const result = applyStoryStateUpdate([
      "<thinking>hidden</thinking>",
      "<gametxt>我推开后台的门。</gametxt>",
      "<UpdateVariable>",
      "_.set('当前地点', '后台走廊');",
      "_.add('线索数量', 2);",
      "_.assign('人物关系列表', '克莱恩', {关系:'合作', 好感度: 12});",
      "</UpdateVariable>",
    ].join("\n"), createEmptyStoryState("2026-05-30T00:00:00.000Z"), {
      now: "2026-05-30T00:00:01.000Z",
      emitSourceTag: true,
    });

    expect(result.visibleText).toBe("我推开后台的门。");
    expect(result.screenText).not.toContain("<UpdateVariable>");
    expect(result.state.variables).toMatchObject({
      当前地点: "后台走廊",
      线索数量: 2,
      人物关系列表: {
        克莱恩: {
          关系: "合作",
          好感度: 12,
        },
      },
    });
    expect(result.appliedEvents.map((event) => `${event.op}:${event.path}`)).toEqual([
      "set:当前地点",
      "add:线索数量",
      "assign:人物关系列表.克莱恩",
    ]);

    const matches = extractRenderIntentMatches(result.screenText, [stateIntent]);
    expect(matches).toHaveLength(1);
    expect(stripRenderIntentSources(result.screenText, [stateIntent])).toBe("我推开后台的门。");
  });

  it("rejects prototype paths without evaluating arbitrary JavaScript", () => {
    const result = applyStoryStateUpdate([
      "正文",
      "<UpdateVariable>",
      "_.set('__proto__.polluted', true);",
      "_.set('安全字段', 'ok');",
      "</UpdateVariable>",
    ].join("\n"), createEmptyStoryState("2026-05-30T00:00:00.000Z"), {
      now: "2026-05-30T00:00:01.000Z",
      emitSourceTag: false,
    });

    expect(result.state.variables).toEqual({ 安全字段: "ok" });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(result.errors[0]).toContain("unsafe path");
  });

  it("adds numeric tuple values while preserving variable descriptions", () => {
    const state = createEmptyStoryState("2026-05-30T00:00:00.000Z");
    state.variables = {
      长崎素世: {
        好感度: [0, "relationship toward user"],
      },
    };

    const result = applyStoryStateUpdate([
      "素世轻轻点头。",
      "<UpdateVariable>",
      "_.add('长崎素世.好感度', 3);",
      "</UpdateVariable>",
    ].join("\n"), state, {
      now: "2026-05-30T00:00:01.000Z",
      emitSourceTag: true,
    });

    expect(result.state.variables).toEqual({
      长崎素世: {
        好感度: [3, "relationship toward user"],
      },
    });
    expect(result.appliedEvents).toEqual([
      { op: "add", path: "长崎素世.好感度", value: 3 },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.screenText).toContain("\"好感度\":[3,\"relationship toward user\"]");
  });
});
