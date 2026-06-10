import { describe, expect, it, vi } from "vitest";
import type { StoryMemoryState } from "../types";
import { ingestStoryMemory, storyMemoryToVectorEntries } from "../vectorize";

const TS = Date.parse("2026-06-10T00:00:00.000Z");

function memory(): StoryMemoryState {
  return {
    runningSummary: { content: "", coveredEpisodeIds: [], updatedAt: "2026-06-10T00:00:00.000Z" },
    episodes: [],
    facts: [
      { id: "f1", content: "the door is locked", sourceEpisodeId: "e1", createdAt: "2026-06-10T00:00:00.000Z" },
    ],
    relationships: [
      { id: "r1", key: "trust", value: "high", sourceEpisodeId: "e1", updatedAt: "2026-06-10T00:00:00.000Z" },
    ],
    updatedAt: "2026-06-10T00:00:00.000Z",
  };
}

describe("storyMemoryToVectorEntries", () => {
  it("maps facts and relationships to session-scoped, type-tagged vector entries", () => {
    expect(storyMemoryToVectorEntries(memory(), "s1")).toEqual([
      { id: "s1:f1", role: "system", source: "story:fact", content: "the door is locked", createdAt: TS },
      { id: "s1:r1", role: "system", source: "story:relationship", content: "trust: high", createdAt: TS },
    ]);
  });

  it("namespaces ids by session so identical memory does not collide across sessions", () => {
    const a = storyMemoryToVectorEntries(memory(), "s1");
    const b = storyMemoryToVectorEntries(memory(), "s2");
    expect(a[0].id).toBe("s1:f1");
    expect(b[0].id).toBe("s2:f1");
    expect(a[0].id).not.toBe(b[0].id);
  });

  it("returns no entries when there are no facts or relationships", () => {
    expect(storyMemoryToVectorEntries({ ...memory(), facts: [], relationships: [] }, "s1")).toEqual([]);
  });
});

describe("ingestStoryMemory", () => {
  it("ingests the session-scoped mapped entries through the sink", async () => {
    const ingest = vi.fn().mockResolvedValue({ stored: 2, skipped: 0 });
    await ingestStoryMemory({ ingest }, "session-1", memory());
    expect(ingest).toHaveBeenCalledWith("session-1", storyMemoryToVectorEntries(memory(), "session-1"));
  });

  it("skips the sink call when there is nothing to ingest", async () => {
    const ingest = vi.fn();
    await ingestStoryMemory({ ingest }, "session-1", {
      ...memory(),
      facts: [],
      relationships: [],
    });
    expect(ingest).not.toHaveBeenCalled();
  });

  it("degrades silently when the sink throws", async () => {
    const ingest = vi.fn().mockRejectedValue(new Error("embed down"));
    await expect(ingestStoryMemory({ ingest }, "session-1", memory())).resolves.toBeUndefined();
  });
});
