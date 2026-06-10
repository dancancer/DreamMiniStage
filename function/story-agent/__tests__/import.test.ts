import { describe, expect, it } from "vitest";
import type { LLMConfig } from "@/lib/nodeflow/LLMNode/llm-config";
import { compileStoryAgentImport, type StoryAgentImportPreview } from "@/lib/story-agent/import";
import { enrichStoryAgentPreview } from "../import";

// 构造一个既缺 description（触发 QA 修复）又含 script 驱动 widget（触发合成）的预览。
function widgetPreview(): StoryAgentImportPreview {
  return compileStoryAgentImport({
    characterId: "agent-enrich",
    createdAt: "2026-06-10T00:00:00.000Z",
    character: {
      raw: { data: { name: "Enrich Card", first_mes: "hi" } },
      source: assetSource("enrich.card.json", "json-character"),
    },
    regexScripts: [{
      id: "widget-regex",
      name: "widget-regex",
      raw: {
        scripts: [{
          id: "dash-1",
          scriptName: "好感度面板",
          findRegex: "<Dashboard>([\\s\\S]*?)</Dashboard>",
          replaceString: "<div class='dash'><script>render()</script></div>",
          trimStrings: [],
          placement: [2],
        }],
      },
      source: assetSource("widget.regex.json", "regex"),
    }],
  });
}

function assetSource(path: string, kind: "json-character" | "regex") {
  return { sourcePath: path, sourceKind: kind, detectedFormat: kind, sourceHash: `${kind}:fixture` };
}

describe("enrichStoryAgentPreview", () => {
  it("runs QA repair and widget synthesis through one injected invokeLLM", async () => {
    let qaCalls = 0;
    let widgetCalls = 0;
    const invokeLLM = async (config: LLMConfig) => {
      const system = config.messages?.[0]?.content ?? "";
      if (system.includes("RenderIntentSpec")) {
        widgetCalls += 1;
        return JSON.stringify({
          kind: "status-panel",
          title: "好感度",
          sourceTag: "Dashboard",
          fields: [{ label: "好感", valueTemplate: "$json.aff" }],
        });
      }
      qaCalls += 1;
      const user = JSON.parse(config.messages?.[1]?.content ?? "{}") as { repairablePaths?: string[] };
      return JSON.stringify({
        patches: [{
          id: "p1",
          operation: "replace",
          targetPath: user.repairablePaths?.[0] ?? "/character/description",
          value: "filled description",
          reason: "fill empty description",
        }],
      });
    };

    const enriched = await enrichStoryAgentPreview(
      widgetPreview(),
      { modelName: "m", apiKey: "k", llmType: "openai" },
      invokeLLM,
    );

    expect(qaCalls).toBe(1);
    expect(widgetCalls).toBe(1);
    expect(enriched.qaRepair?.pendingConfirmation.map((entry) => entry.patch.targetPath)).toContain(
      "/character/description",
    );
    expect(enriched.blueprint.renderRules.some((rule) => rule.kind === "status-panel")).toBe(true);
  });
});
