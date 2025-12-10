/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                          Memory Utility Functions                         ║
 * ║                                                                          ║
 * ║  纯函数工具集：向量计算、文本处理、格式化                                    ║
 * ║  从 memory-manager.ts 提取，遵循 Linus 哲学：简洁、直接、无冗余              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { MemoryEntry, MemoryType, MemorySearchResult } from "@/lib/models/memory-model";

/* ═══════════════════════════════════════════════════════════════════════════
   记忆提取提示词模板
   ═══════════════════════════════════════════════════════════════════════════ */

export const MEMORY_EXTRACTION_PROMPT = `You are an expert memory extraction system for character AI. Analyze the conversation and extract important memories that should be stored for future reference.

Extract memories that are:
- Factual information (names, dates, locations, numbers)
- Character preferences or habits
- Relationship dynamics or important interactions
- Significant events or experiences
- Emotional states or reactions
- Geographic or spatial information
- Important concepts or abstract ideas
- Memorable dialogue or quotes

For each memory, provide:
1. Type: one of [fact, relationship, event, preference, emotion, geography, concept, dialogue]
2. Content: clear, specific description
3. Importance: 0.0-1.0 (higher = more important)
4. Tags: relevant keywords
5. Confidence: 0.0-1.0 (how confident you are this is worth remembering)

Return as JSON array of memory objects. If no important memories found, return empty array.

Example output:
[
  {
    "type": "fact",
    "content": "User's name is Alice and she works as a software engineer",
    "importance": 0.8,
    "tags": ["name", "job", "Alice", "engineer"],
    "confidence": 0.9
  }
]`;

/* ═══════════════════════════════════════════════════════════════════════════
   向量计算
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 计算两个向量的余弦相似度
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

  return (magnitudeA === 0 || magnitudeB === 0) ? 0 : dotProduct / (magnitudeA * magnitudeB);
}

/* ═══════════════════════════════════════════════════════════════════════════
   关键词搜索
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 计算关键词匹配分数
 */
export function calculateKeywordScore(query: string, memory: MemoryEntry): number {
  const queryWords = query.toLowerCase().split(/\s+/);
  const contentWords = memory.content.toLowerCase().split(/\s+/);
  const tagWords = memory.tags.map(tag => tag.toLowerCase());

  let matches = 0;
  for (const queryWord of queryWords) {
    if (contentWords.some(word => word.includes(queryWord)) ||
        tagWords.some(tag => tag.includes(queryWord))) {
      matches++;
    }
  }

  const baseScore = matches / queryWords.length;
  return Math.min(baseScore * memory.importance * 1.2, 1.0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   相关性推理
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成记忆相关性推理（规则驱动，高性能）
 */
export function generateRelevanceReasoning(
  query: string,
  memory: MemoryEntry,
  score: number,
): string {
  const reasons: string[] = [];

  // 相似度等级
  if (score > 0.9) reasons.push("highly semantically similar");
  else if (score > 0.8) reasons.push("semantically related");
  else reasons.push("potentially relevant");

  // 重要性
  if (memory.importance > 0.8) reasons.push("marked as important");

  // 访问频率
  if (memory.accessCount > 5) reasons.push("frequently accessed");

  // 标签匹配
  const queryLower = query.toLowerCase();
  if (memory.tags.some(tag => queryLower.includes(tag.toLowerCase()))) {
    reasons.push("matches tags");
  }

  // 关键词匹配
  const contentLower = memory.content.toLowerCase();
  if (queryLower.split(" ").some(word => contentLower.includes(word))) {
    reasons.push("contains keywords");
  }

  return `Relevant because: ${reasons.join(", ")} (similarity: ${(score * 100).toFixed(1)}%)`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   文本处理
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 准备嵌入文本：将记忆内容与元数据组合
 */
export function prepareTextForEmbedding(memoryEntry: MemoryEntry): string {
  const parts = [
    memoryEntry.content,
    `Type: ${memoryEntry.type}`,
    `Tags: ${memoryEntry.tags.join(", ")}`,
  ];

  if (memoryEntry.metadata.context) {
    parts.push(`Context: ${memoryEntry.metadata.context}`);
  }
  if (memoryEntry.metadata.temporalContext?.timeframe) {
    parts.push(`Time: ${memoryEntry.metadata.temporalContext.timeframe}`);
  }
  if (memoryEntry.metadata.spatialContext?.location) {
    parts.push(`Location: ${memoryEntry.metadata.spatialContext.location}`);
  }

  return parts.join(" | ");
}

/* ═══════════════════════════════════════════════════════════════════════════
   提示词格式化
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 记忆类型中文标签映射
 */
const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  [MemoryType.FACT]: "事实",
  [MemoryType.RELATIONSHIP]: "关系",
  [MemoryType.EVENT]: "事件",
  [MemoryType.PREFERENCE]: "偏好",
  [MemoryType.EMOTION]: "情感",
  [MemoryType.GEOGRAPHY]: "地理",
  [MemoryType.CONCEPT]: "概念",
  [MemoryType.DIALOGUE]: "对话",
};

/**
 * 获取记忆类型的中文标签
 */
export function getChineseTypeLabel(type: MemoryType): string {
  return MEMORY_TYPE_LABELS[type] || type;
}

/**
 * 格式化记忆提示词
 */
export function formatMemoryPrompt(results: MemorySearchResult[], language: "zh" | "en"): string {
  if (results.length === 0) {
    return language === "zh" ? "无相关记忆" : "No relevant memories";
  }

  const header = language === "zh" ? "相关记忆：" : "Relevant memories:";
  const memoryTexts = results.map((result, index) => {
    const typeLabel = language === "zh" ? getChineseTypeLabel(result.entry.type) : result.entry.type;
    return `${index + 1}. [${typeLabel}] ${result.entry.content}`;
  });

  return `${header}\n${memoryTexts.join("\n")}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   搜索结果合并
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 合并语义搜索和关键词搜索结果
 * @param alpha 语义搜索权重 (0-1)，默认 0.7 偏向语义
 */
export function combineSearchResults(
  semanticResults: MemorySearchResult[],
  keywordResults: MemorySearchResult[],
  alpha: number = 0.7,
): MemorySearchResult[] {
  const resultMap = new Map<string, MemorySearchResult>();

  // 添加语义搜索结果
  for (const result of semanticResults) {
    resultMap.set(result.entry.id, { ...result, score: result.score * alpha });
  }

  // 合并关键词搜索结果
  for (const result of keywordResults) {
    const existing = resultMap.get(result.entry.id);
    if (existing) {
      existing.score += result.score * (1 - alpha);
      existing.reasoning = `${existing.reasoning} + ${result.reasoning}`;
    } else {
      resultMap.set(result.entry.id, { ...result, score: result.score * (1 - alpha) });
    }
  }

  return Array.from(resultMap.values()).sort((a, b) => b.score - a.score);
}
