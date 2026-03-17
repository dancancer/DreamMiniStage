import { describe, expect, it } from "vitest";
import { collectGenerationEvents } from "@/lib/generation-runtime/__tests__/helpers";

describe("dialogue runtime contract", () => {
  it("streams text deltas even when script tools are registered but unused", async () => {
    const result = await collectGenerationEvents({
      llmType: "openai",
      scriptTools: [
        {
          type: "function",
          function: {
            name: "tool_echo",
            description: "echo",
            parameters: {
              type: "object",
              properties: {},
            },
          },
        },
      ],
      mockChunks: ["He", "llo"],
    });

    expect(
      result.events.filter((event) => event.type === "content-delta"),
    ).toHaveLength(2);
  });
});
