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

const actionIntent: RenderIntent = {
  schemaVersion: 1,
  id: "actions",
  kind: "choice-list",
  sourceScriptId: "script",
  title: "Actions",
  confidence: 0.8,
  options: [],
  dataTemplate: "$1",
  sourcePattern: "<StoryActions>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/StoryActions>",
};

describe("render intent runtime", () => {
  it("extracts status JSON without leaving source tags in message text", () => {
    const text = "正文\n<SFW>{\"date\":\"2020\",\"characters\":[]}</SFW>";
    const matches = extractRenderIntentMatches(text, [statusIntent]);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.values[1]).toBe("{\"date\":\"2020\",\"characters\":[]}");
    expect(stripRenderIntentSources(text, [statusIntent])).toBe("正文");
  });

  it("extracts dynamic action choice JSON from internal source tags", () => {
    const text = "正文\n<StoryActions>{\"options\":[{\"label\":\"检查侧门\",\"value\":\"检查侧门\"}]}</StoryActions>";
    const matches = extractRenderIntentMatches(text, [actionIntent]);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.values[1]).toContain("检查侧门");
    expect(stripRenderIntentSources(text, [actionIntent])).toBe("正文");
  });

  it("strips unsupported SFW status blocks before the legacy HTML parser can expose JSON", () => {
    const text = "正文\n<SFW>{\"date\":\"2020\",\"characters\":[]}</SFW>";

    expect(stripRenderIntentSources(text, [])).toBe("正文");
    expect(stripRenderIntentSources(text, [actionIntent])).toBe("正文");
  });
});
