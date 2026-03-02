/**
 * @input  lib/mvu/types
 * @output ParsedResponse
 * @pos    LLM 响应解析结果数据模型,包含正则处理、下一提示、MVU 变量快照
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

import type { MvuData } from "@/lib/mvu/types";

export interface ParsedResponse {
  regexResult?: string;
  nextPrompts?: string[];
  compressedContent?: string;
  /** MVU 变量快照 - 该消息处理后的变量状态 */
  variables?: MvuData;
}
