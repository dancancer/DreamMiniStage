/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Reasoning 提取器                                   ║
 * ║                                                                            ║
 * ║  从流式响应中提取思考内容                                                    ║
 * ║  支持 <thinking> 标签和其他推理格式                                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              类型定义
// ============================================================================

/** 推理标签配置 */
export interface ReasoningTagConfig {
  openTag: string;
  closeTag: string;
  name: string;
}

/** 默认支持的推理标签 */
export const DEFAULT_REASONING_TAGS: ReasoningTagConfig[] = [
  { openTag: "<thinking>", closeTag: "</thinking>", name: "thinking" },
  { openTag: "<reasoning>", closeTag: "</reasoning>", name: "reasoning" },
  { openTag: "<thought>", closeTag: "</thought>", name: "thought" },
  { openTag: "<内心>", closeTag: "</内心>", name: "inner" },
  { openTag: "<思考>", closeTag: "</思考>", name: "thinking_cn" },
];

/** 推理块 */
export interface ReasoningBlock {
  type: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

/** 提取结果 */
export interface ExtractionResult {
  output: string;
  reasoning: ReasoningBlock[];
  hasReasoning: boolean;
  rawContent: string;
}

/** 提取器配置 */
export interface ReasoningExtractorConfig {
  tags: ReasoningTagConfig[];
  stripReasoning: boolean;
  preserveOrder: boolean;
}

// ============================================================================
//                              默认配置
// ============================================================================

export const DEFAULT_EXTRACTOR_CONFIG: ReasoningExtractorConfig = {
  tags: DEFAULT_REASONING_TAGS,
  stripReasoning: true,
  preserveOrder: true,
};

// ============================================================================
//                              Reasoning 提取器
// ============================================================================

/** Reasoning 提取器 */
export class ReasoningExtractor {
  private config: ReasoningExtractorConfig;
  private buffer = "";
  private reasoning: ReasoningBlock[] = [];
  private currentTag: ReasoningTagConfig | null = null;
  private currentBlockStart = -1;
  private currentBlockContent = "";

  constructor(config?: Partial<ReasoningExtractorConfig>) {
    this.config = { ...DEFAULT_EXTRACTOR_CONFIG, ...config };
  }

  /** 处理流式内容 */
  processChunk(chunk: string): { output: string; reasoning: string | null } {
    this.buffer += chunk;

    let output = "";
    let reasoning: string | null = null;

    while (this.buffer.length > 0) {
      if (this.currentTag) {
        const closeIndex = this.buffer.indexOf(this.currentTag.closeTag);
        if (closeIndex !== -1) {
          this.currentBlockContent += this.buffer.slice(0, closeIndex);
          reasoning = this.currentBlockContent;

          this.reasoning.push({
            type: this.currentTag.name,
            content: this.currentBlockContent,
            startIndex: this.currentBlockStart,
            endIndex: this.currentBlockStart + this.currentBlockContent.length,
          });

          this.buffer = this.buffer.slice(closeIndex + this.currentTag.closeTag.length);
          this.currentTag = null;
          this.currentBlockContent = "";
        } else {
          this.currentBlockContent += this.buffer;
          this.buffer = "";
        }
      } else {
        let foundTag = false;
        let earliestIndex = this.buffer.length;
        let matchedTag: ReasoningTagConfig | null = null;

        for (const tag of this.config.tags) {
          const index = this.buffer.indexOf(tag.openTag);
          if (index !== -1 && index < earliestIndex) {
            earliestIndex = index;
            matchedTag = tag;
            foundTag = true;
          }
        }

        if (foundTag && matchedTag) {
          output += this.buffer.slice(0, earliestIndex);
          this.buffer = this.buffer.slice(earliestIndex + matchedTag.openTag.length);
          this.currentTag = matchedTag;
          this.currentBlockStart = earliestIndex;
        } else {
          const safeLength = this.getSafeOutputLength();
          if (safeLength > 0) {
            output += this.buffer.slice(0, safeLength);
            this.buffer = this.buffer.slice(safeLength);
          } else {
            break;
          }
        }
      }
    }

    return { output, reasoning };
  }

  /** 获取安全输出长度 (避免截断标签) */
  private getSafeOutputLength(): number {
    let minPotentialTagStart = this.buffer.length;

    for (const tag of this.config.tags) {
      for (let i = 1; i < tag.openTag.length; i++) {
        const partial = tag.openTag.slice(0, i);
        if (this.buffer.endsWith(partial)) {
          minPotentialTagStart = Math.min(minPotentialTagStart, this.buffer.length - i);
        }
      }
    }

    return minPotentialTagStart;
  }

  /** 完成处理 */
  finalize(): ExtractionResult {
    let output = this.buffer;

    if (this.currentTag && this.currentBlockContent) {
      this.reasoning.push({
        type: this.currentTag.name,
        content: this.currentBlockContent,
        startIndex: this.currentBlockStart,
        endIndex: this.currentBlockStart + this.currentBlockContent.length,
      });
    }

    this.buffer = "";
    this.currentTag = null;
    this.currentBlockContent = "";

    return {
      output: output.trim(),
      reasoning: this.reasoning,
      hasReasoning: this.reasoning.length > 0,
      rawContent: this.getRawContent(),
    };
  }

  /** 获取原始内容 (包含推理标签) */
  private getRawContent(): string {
    return "";
  }

  /** 获取所有推理内容 */
  getAllReasoning(): ReasoningBlock[] {
    return [...this.reasoning];
  }

  /** 获取合并的推理文本 */
  getCombinedReasoning(): string {
    return this.reasoning.map((r) => r.content).join("\n\n");
  }

  /** 重置提取器 */
  reset(): void {
    this.buffer = "";
    this.reasoning = [];
    this.currentTag = null;
    this.currentBlockStart = -1;
    this.currentBlockContent = "";
  }
}

// ============================================================================
//                              静态提取函数
// ============================================================================

/** 从完整文本中提取推理内容 */
export function extractReasoning(
  text: string,
  config?: Partial<ReasoningExtractorConfig>,
): ExtractionResult {
  const extractor = new ReasoningExtractor(config);
  extractor.processChunk(text);
  return extractor.finalize();
}

/** 移除推理标签 */
export function stripReasoningTags(
  text: string,
  tags: ReasoningTagConfig[] = DEFAULT_REASONING_TAGS,
): string {
  let result = text;

  for (const tag of tags) {
    const regex = new RegExp(
      escapeRegex(tag.openTag) + "[\\s\\S]*?" + escapeRegex(tag.closeTag),
      "gi",
    );
    result = result.replace(regex, "");
  }

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

/** 检查文本是否包含推理标签 */
export function hasReasoningTags(
  text: string,
  tags: ReasoningTagConfig[] = DEFAULT_REASONING_TAGS,
): boolean {
  for (const tag of tags) {
    if (text.includes(tag.openTag)) return true;
  }
  return false;
}

/** 获取推理内容 (不含标签) */
export function getReasoningContent(
  text: string,
  tags: ReasoningTagConfig[] = DEFAULT_REASONING_TAGS,
): string[] {
  const results: string[] = [];

  for (const tag of tags) {
    const regex = new RegExp(
      escapeRegex(tag.openTag) + "([\\s\\S]*?)" + escapeRegex(tag.closeTag),
      "gi",
    );
    let match;
    while ((match = regex.exec(text)) !== null) {
      results.push(match[1].trim());
    }
  }

  return results;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================================================
//                              便捷函数
// ============================================================================

/** 创建 Reasoning 提取器 */
export function createReasoningExtractor(
  config?: Partial<ReasoningExtractorConfig>,
): ReasoningExtractor {
  return new ReasoningExtractor(config);
}

/** 格式化推理内容用于显示 */
export function formatReasoningForDisplay(
  blocks: ReasoningBlock[],
  options: { showType?: boolean; separator?: string } = {},
): string {
  const { showType = true, separator = "\n---\n" } = options;

  return blocks
    .map((block) => {
      if (showType) {
        return `[${block.type}]\n${block.content}`;
      }
      return block.content;
    })
    .join(separator);
}
