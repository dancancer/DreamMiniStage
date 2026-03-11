import { describe, expect, it } from "vitest";

import { normalizeContextPreset } from "@/lib/prompt-config/state";

describe("prompt-config state", () => {
  it("preserves explicitly cleared context strings", () => {
    const preset = normalizeContextPreset({
      name: "Custom",
      story_string: "",
      example_separator: "",
      chat_start: "",
    });

    expect(preset.story_string).toBe("");
    expect(preset.example_separator).toBe("");
    expect(preset.chat_start).toBe("");
  });
});
