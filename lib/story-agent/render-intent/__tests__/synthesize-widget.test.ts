import { describe, expect, it } from "vitest";
import type { LLMConfig } from "@/lib/nodeflow/LLMNode/llm-config";
import { RegexPlacement, type RegexScript } from "@/lib/models/regex-script-model";
import {
  buildWidgetSynthesisPrompt,
  createWidgetSynthesisModel,
  parseRenderIntentSpec,
  synthesizeRenderIntent,
  synthesizeUnsupportedWidgets,
} from "../synthesize-widget";

const widget = {
  scriptId: "card-regex:好感度",
  scriptName: "好感度",
  html: "<div class='affection'><script>render(affection)</script></div>",
};

describe("synthesizeRenderIntent", () => {
  it("compiles a safe spec from the model into a RenderIntent", async () => {
    const model = async () => ({
      kind: "status-panel",
      title: "好感度",
      sourceTag: "StatusDashboard",
      fields: [{ label: "好感", valueTemplate: "$json.affection" }],
    });

    const outcome = await synthesizeRenderIntent(widget, model);

    expect(outcome.intent?.kind).toBe("status-panel");
    expect(outcome.intent?.sourceScriptId).toBe("card-regex:好感度");
    expect(outcome.reason).toBeUndefined();
  });

  it("rejects an unsafe spec and returns a diagnostic reason instead of an intent", async () => {
    const model = async () => ({
      kind: "status-panel",
      title: "好感度",
      sourceTag: "StatusDashboard",
      fields: [{ label: "x", valueTemplate: "<script>steal()</script>" }],
    });

    const outcome = await synthesizeRenderIntent(widget, model);

    expect(outcome.intent).toBeUndefined();
    expect(outcome.reason).toBeTruthy();
  });

  it("returns a reason when the model output is not a spec", async () => {
    const model = async () => ({ nope: true });
    const outcome = await synthesizeRenderIntent(widget, model);
    expect(outcome.intent).toBeUndefined();
    expect(outcome.reason).toBeTruthy();
  });

  it("degrades to a reason when the model throws", async () => {
    const model = async () => {
      throw new Error("model down");
    };
    const outcome = await synthesizeRenderIntent(widget, model);
    expect(outcome.intent).toBeUndefined();
    expect(outcome.reason).toContain("model");
  });
});

describe("buildWidgetSynthesisPrompt", () => {
  it("instructs the model to emit a RenderIntentSpec for the widget", () => {
    const messages = buildWidgetSynthesisPrompt({ scriptName: "好感度", html: "<div class='x'></div>" });
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toMatch(/RenderIntentSpec/);
    const user = messages.find((m) => m.role === "user");
    expect(user?.content).toContain("好感度");
    expect(user?.content).toContain("<div");
  });
});

describe("parseRenderIntentSpec", () => {
  it("extracts a spec object from a fenced response", () => {
    expect(parseRenderIntentSpec('```json\n{"kind":"status-panel"}\n```')).toEqual({ kind: "status-panel" });
  });

  it("throws when there is no JSON object", () => {
    expect(() => parseRenderIntentSpec("no json here")).toThrow();
  });
});

function regexScript(partial: Partial<RegexScript> & Pick<RegexScript, "scriptName">): RegexScript {
  return {
    scriptKey: partial.scriptName,
    scriptName: partial.scriptName,
    findRegex: partial.findRegex ?? "<Widget>(.*?)</Widget>",
    replaceString: partial.replaceString ?? "",
    trimStrings: [],
    placement: partial.placement ?? [RegexPlacement.AI_OUTPUT],
    promptOnly: partial.promptOnly,
    markdownOnly: partial.markdownOnly,
  };
}

describe("synthesizeUnsupportedWidgets", () => {
  it("synthesizes only unsupported UI widgets, skipping supported and non-UI scripts", async () => {
    const scripts = [
      regexScript({ scriptName: "好感度", replaceString: "<div class='aff'><script>render()</script></div>" }),
      regexScript({ scriptName: "纯提示", replaceString: "", promptOnly: true }),
    ];
    let calls = 0;
    const model = async () => {
      calls += 1;
      return { kind: "status-panel", title: "好感度", sourceTag: "SFW", fields: [{ label: "好感", valueTemplate: "$json.aff" }] };
    };

    const { intents, diagnostics } = await synthesizeUnsupportedWidgets(scripts, model);

    expect(calls).toBe(1);
    expect(intents).toHaveLength(1);
    expect(intents[0].kind).toBe("status-panel");
    expect(intents[0].sourceScriptId).toBe("好感度");
    expect(diagnostics).toHaveLength(0);
  });

  it("records a diagnostic when an unsupported widget cannot be synthesized", async () => {
    const scripts = [regexScript({ scriptName: "复杂面板", replaceString: "<div><script>x</script></div>" })];
    const model = async () => ({ nope: true });

    const { intents, diagnostics } = await synthesizeUnsupportedWidgets(scripts, model);

    expect(intents).toHaveLength(0);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].scriptName).toBe("复杂面板");
    expect(diagnostics[0].reason).toBeTruthy();
  });
});

describe("createWidgetSynthesisModel", () => {
  it("calls the model non-streaming with sanitized config and parses the spec", async () => {
    let seen: LLMConfig | undefined;
    const invokeLLM = async (config: LLMConfig) => {
      seen = config;
      return '{"kind":"status-panel","title":"好感度","sourceTag":"SFW"}';
    };
    const model = createWidgetSynthesisModel({
      invokeLLM,
      baseConfig: { modelName: "m", apiKey: "k", llmType: "openai", mvuToolEnabled: true, tools: true },
    });

    const spec = await model({ scriptName: "好感度", html: "<div></div>" });

    expect(spec).toMatchObject({ kind: "status-panel", title: "好感度" });
    expect(seen?.streaming).toBe(false);
    expect(seen?.mvuToolEnabled).toBeUndefined();
    expect(seen?.tools).toBeUndefined();
  });
});
