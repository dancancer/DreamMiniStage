import { describe, expect, it } from "vitest";
import { assemblePromptMessages } from "../assembler";
import type { PromptStackMessage } from "../types";

function message(partial: Pick<PromptStackMessage, "id" | "content" | "order"> & Partial<PromptStackMessage>): PromptStackMessage {
  return {
    role: "system",
    enabled: true,
    sourceKind: "character",
    sourcePath: "synthetic",
    sourceField: "system",
    ...partial,
  };
}

const blueprint = {
  promptStack: {
    messages: [
      message({ id: "a", content: "alpha", order: 0 }),
      message({ id: "b", content: "beta", order: 1 }),
      message({ id: "c", content: "gamma", order: 2, enabled: false }),
    ],
  },
};

describe("assemblePromptMessages", () => {
  it("keeps enabled messages in order without overrides", () => {
    expect(assemblePromptMessages(blueprint).map((message) => message.id)).toEqual(["a", "b"]);
  });

  it("disables a preset entry via a session override", () => {
    const result = assemblePromptMessages(blueprint, { a: { enabled: false } });
    expect(result.map((message) => message.id)).toEqual(["b"]);
  });

  it("enables a preset-disabled entry via a session override", () => {
    const result = assemblePromptMessages(blueprint, { c: { enabled: true } });
    expect(result.map((message) => message.id)).toEqual(["a", "b", "c"]);
  });

  it("rewrites a preset entry's content via a session override", () => {
    const result = assemblePromptMessages(blueprint, { b: { content: "BETA-REWRITTEN" } });
    expect(result.find((message) => message.id === "b")?.content).toBe("BETA-REWRITTEN");
  });
});
