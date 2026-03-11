import { describe, expect, it, vi, afterEach } from "vitest";
import { NodeBase } from "@/lib/nodeflow/NodeBase";
import { NodeContext } from "@/lib/nodeflow/NodeContext";
import { NodeCategory, type NodeConfig, type NodeInput, type NodeOutput } from "@/lib/nodeflow/types";

class TestNode extends NodeBase {
  constructor(config: NodeConfig) {
    super(config);
  }

  protected getDefaultCategory(): NodeCategory {
    return NodeCategory.MIDDLE;
  }

  async resolveForTest(context: NodeContext): Promise<NodeInput> {
    return this.resolveInput(context);
  }

  protected async _call(input: NodeInput): Promise<NodeOutput> {
    return input;
  }
}

describe("NodeBase optional input fields", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not warn when optional cache fields are absent", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const node = new TestNode({
      id: "llm-1",
      name: "llm",
      category: NodeCategory.MIDDLE,
      inputFields: ["messages", "temperature"],
      optionalInputFields: ["temperature"],
    });
    warnSpy.mockClear();
    const context = new NodeContext({}, { messages: [{ role: "user", content: "hi" }] });

    const resolved = await node.resolveForTest(context);

    expect(resolved).toEqual({ messages: [{ role: "user", content: "hi" }] });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("still warns when required cache fields are absent", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const node = new TestNode({
      id: "llm-1",
      name: "llm",
      category: NodeCategory.MIDDLE,
      inputFields: ["messages", "temperature"],
      optionalInputFields: ["temperature"],
    });
    warnSpy.mockClear();
    const context = new NodeContext();

    await node.resolveForTest(context);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "Node llm-1: Required input 'messages' (mapped to node field 'messages') not found in cache",
    );
  });
});
