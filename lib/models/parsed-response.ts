import type { MvuData } from "@/lib/mvu/types";

export interface ParsedResponse {
  regexResult?: string;
  nextPrompts?: string[];
  compressedContent?: string;
  /** MVU 变量快照 - 该消息处理后的变量状态 */
  variables?: MvuData;
}
