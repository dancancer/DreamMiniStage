/**
 * @input  lib/mvu/types
 * @output ParsedResponse
 * @pos    LLM 响应解析结果数据模型,包含正则处理、下一提示、MVU 变量快照
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

import type { MvuData } from "@/lib/mvu/types";

export type ParsedMvuStrategy = "text-delta" | "function-calling" | "extra-model";
export type ParsedMvuAppliedPath = ParsedMvuStrategy | "none";

export interface ParsedMvuTrace {
  selectedStrategy: ParsedMvuStrategy;
  appliedPath: ParsedMvuAppliedPath;
  applied: boolean;
  hasUpdateProtocol: boolean;
}

export interface ParsedResponse {
  regexResult?: string;
  nextPrompts?: string[];
  compressedContent?: string;
  /** MVU 变量快照 - 该消息处理后的变量状态 */
  variables?: MvuData;
  /** MVU 路径观测 - 记录本节点到底走了哪条更新链路 */
  mvuTrace?: ParsedMvuTrace;
}
