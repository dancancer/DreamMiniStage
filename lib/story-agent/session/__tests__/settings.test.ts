import { describe, expect, it } from "vitest";
import type { APIConfig } from "@/lib/model-runtime";
import {
  mergeStorySessionSettings,
  normalizePromptOverride,
  resolveSessionModelConfig,
} from "../settings";

describe("mergeStorySessionSettings", () => {
  it("deep-merges modelPolicy and promptOverrides without dropping untouched keys", () => {
    const merged = mergeStorySessionSettings(
      { modelPolicy: { temperature: 0.8, maxTokens: 4096 }, promptOverrides: { a: { enabled: false } } },
      { modelPolicy: { temperature: 0.5 }, promptOverrides: { b: { content: "x" } } },
    );

    expect(merged.modelPolicy).toEqual({ temperature: 0.5, maxTokens: 4096 });
    expect(merged.promptOverrides).toEqual({ a: { enabled: false }, b: { content: "x" } });
  });

  it("records the chosen model config id", () => {
    const merged = mergeStorySessionSettings(undefined, { modelConfigId: "cfg-2" });
    expect(merged.modelConfigId).toBe("cfg-2");
  });

  it("drops a sampling override set back to undefined so it falls back to the preset", () => {
    const merged = mergeStorySessionSettings(
      { modelPolicy: { temperature: 0.8 } },
      { modelPolicy: { temperature: undefined } },
    );
    expect(merged.modelPolicy?.temperature).toBeUndefined();
    expect("temperature" in (merged.modelPolicy ?? {})).toBe(false);
  });
});

describe("normalizePromptOverride", () => {
  it("treats blank content as 'no content override' so it does not disable the entry", () => {
    expect(normalizePromptOverride({ content: "   " })).toEqual({});
    expect(normalizePromptOverride({ content: "" })).toEqual({});
  });

  it("keeps a real content rewrite and an explicit enabled flag", () => {
    expect(normalizePromptOverride({ enabled: false, content: "hi" })).toEqual({
      enabled: false,
      content: "hi",
    });
  });
});

describe("resolveSessionModelConfig", () => {
  const configs: APIConfig[] = [
    { id: "active", name: "Active", type: "openai", baseUrl: "", model: "m-active" },
    { id: "cfg-2", name: "Other", type: "openai", baseUrl: "", model: "m-other" },
  ];

  it("uses the session-pinned config when it exists", () => {
    expect(resolveSessionModelConfig(configs, "active", "cfg-2")?.id).toBe("cfg-2");
  });

  it("falls back to the active config when the session pins nothing", () => {
    expect(resolveSessionModelConfig(configs, "active", undefined)?.id).toBe("active");
  });

  it("falls back to the active config when the pinned id no longer exists", () => {
    expect(resolveSessionModelConfig(configs, "active", "deleted")?.id).toBe("active");
  });
});
