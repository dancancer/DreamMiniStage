import { describe, expect, it } from "vitest";
import {
  compileRenderIntentSpec,
  validateRenderIntentSpec,
  type RenderIntentSpec,
} from "../synthesis";

const safeStatusSpec: RenderIntentSpec = {
  kind: "status-panel",
  title: "好感度",
  sourceTag: "StatusDashboard",
  fields: [
    { label: "好感", valueTemplate: "$json.affection" },
    { label: "心情", valueTemplate: "$json.mood" },
  ],
};

describe("validateRenderIntentSpec", () => {
  it("accepts a safe status-panel spec", () => {
    expect(validateRenderIntentSpec(safeStatusSpec).valid).toBe(true);
  });

  it("rejects a kind outside the whitelist", () => {
    const result = validateRenderIntentSpec({ ...safeStatusSpec, kind: "iframe-widget" as never });
    expect(result.valid).toBe(false);
  });

  it("rejects a field template carrying markup or script", () => {
    const result = validateRenderIntentSpec({
      ...safeStatusSpec,
      fields: [{ label: "x", valueTemplate: "<script>alert(1)</script>" }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects an inline event handler in a template", () => {
    const result = validateRenderIntentSpec({
      ...safeStatusSpec,
      fields: [{ label: "x", valueTemplate: "<b onclick=hack()>$1</b>" }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects an unsafe source tag", () => {
    const result = validateRenderIntentSpec({ ...safeStatusSpec, sourceTag: "tag><script>" });
    expect(result.valid).toBe(false);
  });

  it("rejects a status-panel spec with no fields", () => {
    expect(validateRenderIntentSpec({ ...safeStatusSpec, fields: [] }).valid).toBe(false);
  });
});

describe("compileRenderIntentSpec", () => {
  it("compiles a safe status-panel spec into a whitelist RenderIntent", () => {
    const intent = compileRenderIntentSpec(safeStatusSpec, "card-regex:好感度");
    expect(intent.kind).toBe("status-panel");
    expect(intent.sourceScriptId).toBe("card-regex:好感度");
    expect(intent.schemaVersion).toBe(1);
    expect(intent.title).toBe("好感度");
  });

  it("throws when compiling an invalid spec", () => {
    expect(() =>
      compileRenderIntentSpec({ ...safeStatusSpec, kind: "x" as never }, "id"),
    ).toThrow();
  });
});
