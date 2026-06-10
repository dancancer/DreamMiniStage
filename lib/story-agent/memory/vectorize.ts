// 把收敛后的 Story Memory（Facts / Relationships）映射为向量记忆条目并 best-effort 写入，
// 让它们可被语义检索。类型经 source 字段编码（VectorMemoryEntryInput 无结构化 metadata）。
// id 必须按 sessionId 命名空间化：fact/relationship id 由内容/键生成、跨会话可能相同，而向量
// store 按全局 id upsert——不加 sessionId 前缀会让不同会话的同名记忆互相覆盖。
// ingest 失败按 memory failureMode=degrade 静默降级，不破坏会话（warn 可审计）。
import type { VectorMemoryEntryInput } from "@/lib/vector-memory/manager";
import type { StoryMemoryState } from "./types";

/** 仅依赖 ingest 的最小接口，便于注入与测试。 */
export interface StoryMemoryVectorSink {
  ingest: (
    sessionId: string,
    entries: VectorMemoryEntryInput[],
  ) => Promise<{ stored: number; skipped: number; reason?: string }>;
}

export function storyMemoryToVectorEntries(
  memory: StoryMemoryState,
  sessionId: string,
): VectorMemoryEntryInput[] {
  return [
    ...memory.facts.map((fact): VectorMemoryEntryInput => ({
      id: `${sessionId}:${fact.id}`,
      role: "system",
      source: "story:fact",
      content: fact.content,
      createdAt: parseTimestamp(fact.createdAt),
    })),
    ...memory.relationships.map((relationship): VectorMemoryEntryInput => ({
      id: `${sessionId}:${relationship.id}`,
      role: "system",
      source: "story:relationship",
      content: `${relationship.key}: ${relationship.value}`,
      createdAt: parseTimestamp(relationship.updatedAt),
    })),
  ];
}

export async function ingestStoryMemory(
  sink: StoryMemoryVectorSink,
  sessionId: string,
  memory: StoryMemoryState,
): Promise<void> {
  const entries = storyMemoryToVectorEntries(memory, sessionId);
  if (entries.length === 0) return;
  try {
    await sink.ingest(sessionId, entries);
  } catch (error) {
    console.warn("[StoryMemory] vector ingest failed; continuing:", error);
  }
}

// 保留 fact/relationship 的真实时间戳，避免每轮 re-ingest 把历史记忆刷成"本轮时间"。
function parseTimestamp(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}
