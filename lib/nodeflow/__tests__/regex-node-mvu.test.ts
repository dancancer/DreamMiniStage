import { beforeEach, describe, expect, it, vi } from "vitest";

const processFullContext = vi.fn();

vi.mock("@/lib/core/regex-processor", () => ({
  RegexProcessor: {
    processFullContext: (...args: unknown[]) => processFullContext(...args),
  },
}));

import { RegexNode } from "@/lib/nodeflow/RegexNode/RegexNode";
import { NodeCategory } from "@/lib/nodeflow/types";

describe("RegexNode MVU protocol hygiene", () => {
  beforeEach(() => {
    processFullContext.mockReset();
    processFullContext.mockResolvedValue({
      replacedText: "Visible reply",
    });
  });

  it("removes UpdateVariable protocol blocks from screenContent while preserving fullResponse", async () => {
    const node = new RegexNode({
      id: "regex-1",
      name: "regex",
      category: NodeCategory.MIDDLE,
      inputFields: ["llmResponse", "characterId"],
      outputFields: ["screenContent", "fullResponse"],
    });

    const result = await (node as unknown as {
      _call: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    })._call({
      llmResponse: "Visible reply\n<UpdateVariable><Analyze>hp</Analyze>_.set('hp', 3);</UpdateVariable>",
      characterId: "char-1",
    });

    expect(processFullContext).toHaveBeenCalledWith(
      "Visible reply",
      expect.any(Object),
    );
    expect(result.screenContent).toBe("Visible reply");
    expect(result.fullResponse).toContain("<UpdateVariable>");
    expect(String(result.screenContent)).not.toContain("<UpdateVariable>");
  });
});
