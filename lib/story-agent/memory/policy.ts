import type { MemoryPolicy, StoryMemoryState } from "./types";

export function defaultMemoryPolicy(): MemoryPolicy {
  return {
    status: "active",
    summary: {
      maxChars: 1200,
      preserveRecentEpisodes: 8,
    },
    episodic: {
      maxEntries: 24,
    },
    facts: {
      maxEntries: 32,
    },
    relationships: {
      maxEntries: 16,
    },
    failureMode: "degrade",
  };
}

export function createEmptyStoryMemoryState(now: string): StoryMemoryState {
  return {
    runningSummary: {
      content: "",
      coveredEpisodeIds: [],
      updatedAt: now,
    },
    episodes: [],
    facts: [],
    relationships: [],
    updatedAt: now,
  };
}
