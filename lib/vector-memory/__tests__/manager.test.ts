import { describe, it, expect } from "vitest";
import { VectorMemoryManager } from "@/lib/vector-memory/manager";
import { VectorMemoryStore } from "@/lib/vector-memory/store";
import { createMemoryStorage } from "@/lib/vectors/storage";
import type { EmbeddingProvider } from "@/lib/vector-memory/provider";

class ConstantProvider implements EmbeddingProvider {
  name = "constant";
  constructor(private embedding: number[]) {}
  async embed(): Promise<number[]> {
    return this.embedding;
  }
}

class ThrowProvider implements EmbeddingProvider {
  name = "throw";
  async embed(): Promise<number[]> {
    throw new Error("no embed");
  }
}

describe("VectorMemoryManager", () => {
  it("skips ingestion when disabled", async () => {
    const manager = new VectorMemoryManager({
      enabled: false,
      provider: new ThrowProvider(),
      store: new VectorMemoryStore(createMemoryStorage()),
    });

    const result = await manager.ingest("s1", [{
      role: "user",
      source: "user_message",
      content: "hello",
    }]);

    expect(result.stored).toBe(0);
    const retrieval = await manager.retrieve({ sessionId: "s1", query: "hello" });
    expect(retrieval.results.length).toBe(0);
  });

  it("orders retrieval by score then recency", async () => {
    const provider = new ConstantProvider([1, 0]);
    const manager = new VectorMemoryManager({
      enabled: true,
      provider,
      store: new VectorMemoryStore(createMemoryStorage()),
      topK: 5,
    });

    await manager.ingest("sess", [
      { role: "user", source: "user_message", content: "foo", createdAt: 1 },
      { role: "assistant", source: "assistant_response", content: "bar", createdAt: 2 },
    ]);

    const res = await manager.retrieve({ sessionId: "sess", query: "any" });
    expect(res.results.length).toBe(2);
    expect(res.results[0].createdAt).toBe(2);
  });

  it("returns empty retrieval when provider fails", async () => {
    const manager = new VectorMemoryManager({
      enabled: true,
      provider: new ThrowProvider(),
      store: new VectorMemoryStore(createMemoryStorage()),
    });

    const res = await manager.retrieve({ sessionId: "s2", query: "text" });
    expect(res.results.length).toBe(0);
    expect(res.formattedText).toBe("");
  });
});
