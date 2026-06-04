import { describe, expect, it } from "vitest";
import {
  cleanRenderIntentMatchValues,
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

const collapsibleIntent: RenderIntent = {
  schemaVersion: 1,
  id: "status-dashboard",
  kind: "collapsible-panel",
  sourceScriptId: "script",
  title: "Status Dashboard",
  confidence: 0.82,
  bodyTemplate: "$1",
  collapsedLabel: "Expand",
  expandedLabel: "Collapse",
  sourcePattern: "<StatusDashboard>([\\s\\S]*?)<\\/StatusDashboard>",
};

const unitIntent: RenderIntent = {
  schemaVersion: 1,
  id: "unit-card",
  kind: "collapsible-panel",
  sourceScriptId: "script",
  title: "Unit Card",
  confidence: 0.82,
  bodyTemplate: "$1",
  collapsedLabel: "Expand",
  expandedLabel: "Collapse",
  sourcePattern: "<UnitCard>([\\s\\S]*?)<\\/UnitCard>",
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

  it("strips unsupported status JSON blocks before the legacy HTML parser can expose JSON", () => {
    const text = [
      "正文",
      "<SFW>{\"date\":\"2020\",\"characters\":[]}</SFW>",
      "<CurrentState>{\"mode\":\"status\",\"location\":\"后台\"}</CurrentState>",
      "{\"mode\":\"sfw\",\"characters\":[]}",
    ].join("\n");

    expect(stripRenderIntentSources(text, [])).toBe("正文");
    expect(stripRenderIntentSources(text, [actionIntent])).toBe("正文");
  });

  it("keeps status-like narrative tags when the payload is not JSON", () => {
    const text = "正文\n<CurrentState>[not json]</CurrentState>";

    expect(stripRenderIntentSources(text, [])).toBe(text);
  });

  it("extracts collapsible UI blocks from their source tag", () => {
    const text = "正文\n<StatusDashboard>状态: 正常</StatusDashboard>";
    const matches = extractRenderIntentMatches(text, [collapsibleIntent]);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.values[1]).toBe("状态: 正常");
    expect(stripRenderIntentSources(text, [collapsibleIntent])).toBe("正文");
  });

  it("removes nested source tags from parent render values", () => {
    const text = [
      "正文",
      "<StatusDashboard>资源: 5000<UnitCard>HP 85/100</UnitCard></StatusDashboard>",
    ].join("\n");
    const matches = extractRenderIntentMatches(text, [collapsibleIntent, unitIntent]);
    const dashboard = matches.find((match) => match.intent.id === "status-dashboard");

    expect(dashboard).toBeDefined();
    expect(cleanRenderIntentMatchValues(dashboard!, matches)[1]).toBe("资源: 5000");
    expect(matches.find((match) => match.intent.id === "unit-card")?.values[1]).toBe("HP 85/100");
  });
});
