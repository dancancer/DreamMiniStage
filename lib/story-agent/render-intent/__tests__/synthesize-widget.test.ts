import { describe, expect, it } from "vitest";
import { synthesizeRenderIntent } from "../synthesize-widget";

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
