import { describe, expect, it } from "vitest";

import { normalizePreset } from "@/lib/adapters/import/preset-import";

describe("preset import", () => {
  it("preserves explicitly empty context strings", () => {
    const preset = normalizePreset({
      name: "Imported Preset",
      prompts: [],
      context: {
        name: "Imported Context",
        story_string: "",
        example_separator: "",
        chat_start: "",
      },
    });

    expect(preset.context).toMatchObject({
      name: "Imported Context",
      story_string: "",
      example_separator: "",
      chat_start: "",
    });
  });
});
