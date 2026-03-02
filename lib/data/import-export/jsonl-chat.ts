/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         JSONL Chat Import/Export                          ║
 * ║                                                                           ║
 * ║  支持 SillyTavern 格式的聊天 JSONL 文件导入导出                              ║
 * ║  每行一个 JSON 对象，包含消息基础字段                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { DialogueMessage } from "@/types/character-dialogue";

// ============================================================================
//                              类型定义
// ============================================================================

export interface JsonlMessage {
  name: string;
  is_user: boolean;
  is_system?: boolean;
  mes: string;
  send_date?: number | string;
  extra?: {
    model?: string;
    api?: string;
    token_count?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface JsonlChatMetadata {
  user_name?: string;
  character_name?: string;
  create_date?: string;
  chat_metadata?: Record<string, unknown>;
}

export interface JsonlExportResult {
  content: string;
  filename: string;
  messageCount: number;
}

export interface JsonlImportResult {
  success: boolean;
  messages: DialogueMessage[];
  metadata?: JsonlChatMetadata;
  error?: string;
  lineCount: number;
  errorLines: number[];
}

// ============================================================================
//                              导出
// ============================================================================

/**
 * 将对话消息导出为 JSONL 格式
 */
export function exportToJsonl(
  messages: DialogueMessage[],
  options?: {
    characterName?: string;
    userName?: string;
    includeMetadata?: boolean;
  },
): JsonlExportResult {
  const lines: string[] = [];

  // 可选：第一行写入元数据
  if (options?.includeMetadata) {
    const metadata: JsonlChatMetadata = {
      user_name: options.userName || "User",
      character_name: options.characterName || "Character",
      create_date: new Date().toISOString(),
    };
    lines.push(JSON.stringify(metadata));
  }

  // 转换每条消息
  const sendDate = Date.now();
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const jsonlMsg: JsonlMessage = {
      name: msg.role === "user" ? (options?.userName || "User") : (options?.characterName || "Character"),
      is_user: msg.role === "user",
      is_system: msg.role === "system",
      mes: msg.content,
      send_date: sendDate + i, // 使用递增时间戳保持顺序
    };

    if (msg.thinkingContent) {
      jsonlMsg.extra = {
        ...jsonlMsg.extra,
        thinking: msg.thinkingContent,
      };
    }

    lines.push(JSON.stringify(jsonlMsg));
  }

  const content = lines.join("\n");
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
  const filename = `chat_${options?.characterName || "export"}_${timestamp}.jsonl`;

  return {
    content,
    filename,
    messageCount: messages.length,
  };
}

/**
 * 创建可下载的 JSONL 文件
 */
export function downloadJsonl(result: JsonlExportResult): void {
  const blob = new Blob([result.content], { type: "application/x-ndjson" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
//                              导入
// ============================================================================

/**
 * 从 JSONL 内容导入对话消息
 */
export function importFromJsonl(content: string): JsonlImportResult {
  const lines = content.split("\n").filter((line) => line.trim());
  const messages: DialogueMessage[] = [];
  const errorLines: number[] = [];
  let metadata: JsonlChatMetadata | undefined;

  for (let i = 0; i < lines.length; i++) {
    try {
      const parsed = JSON.parse(lines[i]);

      // 检查是否为元数据行
      if (i === 0 && isMetadataLine(parsed)) {
        metadata = parsed as JsonlChatMetadata;
        continue;
      }

      // 解析消息行
      const msg = parseJsonlMessage(parsed, i);
      if (msg) {
        messages.push(msg);
      }
    } catch {
      errorLines.push(i + 1);
    }
  }

  return {
    success: errorLines.length === 0,
    messages,
    metadata,
    lineCount: lines.length,
    errorLines,
    error: errorLines.length > 0 ? `Parse errors on lines: ${errorLines.join(", ")}` : undefined,
  };
}

/**
 * 从文件导入 JSONL
 */
export async function importFromJsonlFile(file: File): Promise<JsonlImportResult> {
  const content = await file.text();
  return importFromJsonl(content);
}

// ============================================================================
//                              辅助函数
// ============================================================================

function isMetadataLine(obj: Record<string, unknown>): boolean {
  return (
    ("user_name" in obj || "character_name" in obj || "create_date" in obj) &&
    !("mes" in obj) &&
    !("is_user" in obj)
  );
}

function parseJsonlMessage(obj: Record<string, unknown>, _lineIndex: number): DialogueMessage | null {
  // 基础字段验证
  if (typeof obj.mes !== "string" && typeof obj.message !== "string" && typeof obj.content !== "string") {
    return null;
  }

  const content = String(obj.mes || obj.message || obj.content || "");
  const isUser = obj.is_user === true || obj.role === "user";
  const isSystem = obj.is_system === true || obj.role === "system";

  let role: "user" | "assistant" | "system" = "assistant";
  if (isUser) role = "user";
  if (isSystem) role = "system";

  const extra = obj.extra as Record<string, unknown> | undefined;

  return {
    id: `imported_${_lineIndex}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    thinkingContent: extra?.thinking ? String(extra.thinking) : undefined,
  };
}
