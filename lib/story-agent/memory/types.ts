export interface MemoryPolicy {
  status: "active";
  summary: {
    maxChars: number;
    preserveRecentEpisodes: number;
  };
  episodic: {
    maxEntries: number;
  };
  facts: {
    maxEntries: number;
  };
  relationships: {
    maxEntries: number;
  };
  failureMode: "degrade";
}

export interface StoryRunningSummary {
  content: string;
  coveredEpisodeIds: string[];
  updatedAt: string;
}

export interface StoryEpisodeMemory {
  id: string;
  user: string;
  assistant: string;
  createdAt: string;
}

export interface StoryFactMemory {
  id: string;
  content: string;
  sourceEpisodeId: string;
  createdAt: string;
}

export interface StoryRelationshipMemory {
  id: string;
  key: string;
  value: string;
  sourceEpisodeId: string;
  updatedAt: string;
}

export interface StoryMemoryState {
  runningSummary: StoryRunningSummary;
  episodes: StoryEpisodeMemory[];
  facts: StoryFactMemory[];
  relationships: StoryRelationshipMemory[];
  lastError?: string;
  updatedAt: string;
}

export interface ExtractedStoryMemory {
  facts: string[];
  relationships: Array<{ key: string; value: string }>;
}
