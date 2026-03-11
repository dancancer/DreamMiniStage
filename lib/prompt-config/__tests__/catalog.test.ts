import { describe, expect, it } from "vitest";

import { PostProcessingMode } from "@/lib/core/st-preset-types";
import { findBuiltInContextPreset, findInstructPreset } from "@/lib/prompt-config/catalog";

describe("prompt-config catalog", () => {
  it("finds built-in context presets case-insensitively", () => {
    const result = findBuiltInContextPreset("minimal");

    expect(result?.name).toBe("Minimal");
    expect(result?.names_as_stop_strings).toBe(false);
  });

  it("returns undefined for unknown context presets", () => {
    expect(findBuiltInContextPreset("missing")).toBeUndefined();
  });

  it("maps instruct presets to their post-processing mode", () => {
    expect(findInstructPreset("strict")?.postProcessingMode).toBe(PostProcessingMode.STRICT);
    expect(findInstructPreset("single user")?.postProcessingMode).toBe(PostProcessingMode.SINGLE);
  });
});
