import { describe, expect, it } from "vitest";
import type { LLMConfig } from "@/lib/nodeflow/LLMNode/llm-config";
import {
  buildWidgetSynthesisPrompt,
  createWidgetSynthesisModel,
  parseRenderIntentSpec,
  synthesizeRenderIntent,
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
