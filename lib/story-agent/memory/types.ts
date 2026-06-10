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
  /** 是否把收敛出的 Facts/Relationships 写入向量记忆供检索。默认关（opt-in，避免每轮 finalize 的 embedding 开销）。 */
  vectorizeMemory?: boolean;
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
