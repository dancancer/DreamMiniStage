import type {
  ExtractedStoryMemory,
  MemoryPolicy,
  StoryEpisodeMemory,
  StoryFactMemory,
  StoryMemoryState,
  StoryRelationshipMemory,
} from "./types";

export interface ConsolidateStoryMemoryInput {
  memory: StoryMemoryState;
  policy: MemoryPolicy;
  userInput: string;
  assistantResponse: string;
  now: string;
  extractor?: StoryMemoryExtractor;
}

export type StoryMemoryExtractor = (
  userInput: string,
  assistantResponse: string,
  episodeId: string,
) => ExtractedStoryMemory;

export function consolidateStoryMemory(input: ConsolidateStoryMemoryInput): StoryMemoryState {
  const episode = createEpisode(input);
  try {
    const extracted = (input.extractor ?? extractTaggedMemory)(
      input.userInput,
      input.assistantResponse,
      episode.id,
    );
    return trimMemory({
      ...input.memory,
      episodes: [...input.memory.episodes, episode],
      facts: mergeFacts(input.memory.facts, extracted.facts, episode, input.now),
      relationships: mergeRelationships(input.memory.relationships, extracted.relationships, episode, input.now),
      lastError: undefined,
      updatedAt: input.now,
    }, input.policy, input.now);
  } catch (error) {
    return trimMemory({
      ...input.memory,
      episodes: [...input.memory.episodes, episode],
      lastError: error instanceof Error ? error.message : "Memory extraction failed",
      updatedAt: input.now,
    }, input.policy, input.now);
  }
}

export function formatStoryMemoryMessages(memory: StoryMemoryState): string[] {
  const messages: string[] = [];
  if (memory.runningSummary.content) {
    messages.push(`Long-term summary:\n${memory.runningSummary.content}`);
  }
  if (memory.facts.length > 0) {
    messages.push(`Known facts:\n${memory.facts.map((fact) => `- ${fact.content}`).join("\n")}`);
  }
  if (memory.relationships.length > 0) {
    messages.push(`Relationship state:\n${memory.relationships.map((item) => `- ${item.key}: ${item.value}`).join("\n")}`);
  }
  return messages;
}

function createEpisode(input: ConsolidateStoryMemoryInput): StoryEpisodeMemory {
  return {
    id: `episode:${input.now}:${input.userInput.length}:${input.assistantResponse.length}`,
    user: input.userInput,
    assistant: input.assistantResponse,
    createdAt: input.now,
  };
}

function extractTaggedMemory(userInput: string, assistantResponse: string): ExtractedStoryMemory {
  const text = `${userInput}\n${assistantResponse}`;
  return {
    facts: extractTags(text, "fact"),
    relationships: extractTags(text, "relationship").flatMap(parseRelationship),
  };
}

function extractTags(text: string, tag: string): string[] {
  return [...text.matchAll(new RegExp(`\\[${tag}:([^\\]]+)\\]`, "gi"))]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function parseRelationship(value: string): Array<{ key: string; value: string }> {
  const separator = value.indexOf("=");
  if (separator < 1) return [];
  return [{
    key: value.slice(0, separator).trim(),
    value: value.slice(separator + 1).trim(),
  }];
}

function mergeFacts(
  current: StoryFactMemory[],
  facts: string[],
  episode: StoryEpisodeMemory,
  now: string,
): StoryFactMemory[] {
  const byContent = new Map(current.map((fact) => [fact.content, fact]));
  for (const fact of facts) {
    byContent.set(fact, {
      id: `fact:${hashText(fact)}`,
      content: fact,
      sourceEpisodeId: episode.id,
      createdAt: now,
    });
  }
  return [...byContent.values()];
}

function mergeRelationships(
  current: StoryRelationshipMemory[],
  relationships: ExtractedStoryMemory["relationships"],
  episode: StoryEpisodeMemory,
  now: string,
): StoryRelationshipMemory[] {
  const byKey = new Map(current.map((item) => [item.key, item]));
  for (const relationship of relationships) {
    byKey.set(relationship.key, {
      id: `relationship:${hashText(relationship.key)}`,
      key: relationship.key,
      value: relationship.value,
      sourceEpisodeId: episode.id,
      updatedAt: now,
    });
  }
  return [...byKey.values()];
}

function trimMemory(
  memory: StoryMemoryState,
  policy: MemoryPolicy,
  now: string,
): StoryMemoryState {
  const overflow = Math.max(memory.episodes.length - policy.summary.preserveRecentEpisodes, 0);
  const summarized = memory.episodes.slice(0, overflow);
  const recent = memory.episodes.slice(overflow).slice(-policy.episodic.maxEntries);
  return {
    ...memory,
    runningSummary: summarizeEpisodes(memory.runningSummary.content, summarized, policy.summary.maxChars, now),
    episodes: recent,
    facts: memory.facts.slice(-policy.facts.maxEntries),
    relationships: memory.relationships.slice(-policy.relationships.maxEntries),
  };
}

function summarizeEpisodes(
  existing: string,
  episodes: StoryEpisodeMemory[],
  maxChars: number,
  now: string,
) {
  const lines = episodes.map((episode) => `- User: ${compact(episode.user, 80)} / Assistant: ${compact(episode.assistant, 100)}`);
  const content = compact([existing, ...lines].filter(Boolean).join("\n"), maxChars);
  return {
    content,
    coveredEpisodeIds: episodes.map((episode) => episode.id),
    updatedAt: content ? now : "",
  };
}

function compact(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(maxChars - 1, 1))}...`;
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
