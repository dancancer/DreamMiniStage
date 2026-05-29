import { describe, expect, it } from "vitest";
import {
  extractRenderIntentMatches,
  stripRenderIntentSources,
  type RenderIntent,
} from "@/lib/story-agent/render-intent";

const statusIntent: RenderIntent = {
  schemaVersion: 1,
  id: "status",
  kind: "status-panel",
  sourceScriptId: "script",
  title: "状态栏",
  confidence: 0.8,
  fields: [],
  dataTemplate: "$1",
  sourcePattern: "<SFW>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/SFW>",
};

describe("render intent runtime", () => {
  it("extracts status JSON without leaving source tags in message text", () => {
    const text = "正文\n<SFW>{\"date\":\"2020\",\"characters\":[]}</SFW>";
    const matches = extractRenderIntentMatches(text, [statusIntent]);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.values[1]).toBe("{\"date\":\"2020\",\"characters\":[]}");
    expect(stripRenderIntentSources(text, [statusIntent])).toBe("正文");
  });
});
