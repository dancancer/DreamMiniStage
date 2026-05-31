import { describe, expect, it } from "vitest";
import { extractRenderIntentMatches, type RenderIntent } from "@/lib/story-agent/render-intent";
import { applyStatusPanelFallback } from "../status-fallback";

const statusIntent: RenderIntent = {
  schemaVersion: 1,
  id: "status",
  kind: "status-panel",
  sourceScriptId: "status-script",
  title: "状态栏",
  confidence: 0.8,
  fields: [],
  dataTemplate: "$1",
  sourcePattern: "<SFW>\\s*(\\{[\\s\\S]*?\\})\\s*</SFW>",
};

describe("status panel fallback", () => {
  it("extracts timeline bar metadata into the fallback status source", () => {
    const text = [
      "赤羽·2020年3月28日·星期六·17:05",
      "",
      "祥子抬起眼。",
    ].join("\n");
    const result = applyStatusPanelFallback({
      text,
      intents: [statusIntent],
      characterName: "祥子",
      now: "2026-06-01T00:00:00.000Z",
    });
    const data = statusData(result);

    expect(data).toMatchObject({
      date: "2020年3月28日",
      time: "17:05",
      location: "赤羽",
    });
    expect(data.characters[0]).toMatchObject({
      name: "祥子",
      status: "剧情推进中",
      location: "赤羽",
    });
  });

  it("extracts labeled date time and location when no timeline bar exists", () => {
    const result = applyStatusPanelFallback({
      text: [
        "日期：2020年8月1日 星期三",
        "时间：14:30",
        "地点：长崎素世家顶层复式公寓的一楼客厅",
      ].join("\n"),
      intents: [statusIntent],
      characterName: "长崎素世",
      now: "2026-06-01T00:00:00.000Z",
    });
    const data = statusData(result);

    expect(data.date).toBe("2020年8月1日 星期三");
    expect(data.time).toBe("14:30");
    expect(data.location).toBe("长崎素世家顶层复式公寓的一楼客厅");
  });

  it("accepts pipe-separated timeline bars with visual wrappers", () => {
    const result = applyStatusPanelFallback({
      text: "【赤羽｜2020年3月28日｜星期六｜17:05】\n\n她停在货架旁。",
      intents: [statusIntent],
      characterName: "祥子",
      now: "2026-06-01T00:00:00.000Z",
    });
    const data = statusData(result);

    expect(data).toMatchObject({
      date: "2020年3月28日",
      time: "17:05",
      location: "赤羽",
    });
  });

  it("falls back to scene location from prose when timeline data is absent", () => {
    const result = applyStatusPanelFallback({
      text: "在这家狭窄的平民超市里，少年抬起头。",
      intents: [statusIntent],
      characterName: "祥子",
      now: "2026-06-01T08:09:00.000Z",
    });
    const data = statusData(result);

    expect(data).toMatchObject({
      date: "2026-06-01",
      time: "08:09",
      location: "这家狭窄的平民超市里",
    });
  });

  it("does not add fallback when the model already emitted status JSON", () => {
    const text = "正文\n<SFW>{\"date\":\"2020\",\"characters\":[]}</SFW>";

    expect(applyStatusPanelFallback({
      text,
      intents: [statusIntent],
      characterName: "祥子",
      now: "2026-06-01T00:00:00.000Z",
    })).toBe(text);
  });
});

function statusData(text: string): {
  date: string;
  time: string;
  location: string;
  characters: Array<{ name: string; status: string; location: string }>;
} {
  const match = extractRenderIntentMatches(text, [statusIntent])[0];
  if (!match) throw new Error("status source not found");
  return JSON.parse(match.values[1] ?? "{}");
}
