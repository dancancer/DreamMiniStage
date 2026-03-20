import { describe, expect, it } from "vitest";

import { ExtraModelParser } from "@/lib/mvu";

describe("ExtraModelParser", () => {
  it("returns updatedVariables so runtime callers can persist extra-model results", async () => {
    const parser = new ExtraModelParser({}, async () => "<UpdateVariable>_.set('hp', 3);</UpdateVariable>");
    const variables = {
      stat_data: { hp: 1 },
      display_data: {},
      delta_data: {},
    };

    const result = await parser.parseAndUpdate({
      messageContent: "Visible reply",
      variables,
    });

    expect(result.success).toBe(true);
    expect(result.updatedVariables?.stat_data).toEqual({
      hp: 3,
    });
  });
});
