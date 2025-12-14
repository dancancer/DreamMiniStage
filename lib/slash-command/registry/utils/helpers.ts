/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  Slash Command Helper Functions                           ║
 * ║                                                                           ║
 * ║  工具函数 - 好品味：纯函数，无副作用                                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

/* ═══════════════════════════════════════════════════════════════════════════
   数值处理
   ═══════════════════════════════════════════════════════════════════════════ */

export function collectNumbers(args: string[], pipe: string, fallback: number): number[] {
  const sources = (pipe ? [pipe] : []).concat(args);
  const list = sources.length === 0 ? [String(fallback)] : sources;
  return list.map(toNumber);
}

export function toNumber(raw: string): number {
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid number: ${raw}`);
  }
  return value;
}

export function parseNumber(raw?: string): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (Number.isNaN(n)) return undefined;
  return n;
}

/* ═══════════════════════════════════════════════════════════════════════════
   布尔处理
   ═══════════════════════════════════════════════════════════════════════════ */

export function parseBoolean(raw?: string, defaultValue?: boolean): boolean | undefined {
  if (raw === undefined) return defaultValue;
  const lowered = raw.toLowerCase();
  if (lowered === "false" || lowered === "0" || lowered === "off") return false;
  if (lowered === "true" || lowered === "1" || lowered === "on") return true;
  return defaultValue;
}

/* ═══════════════════════════════════════════════════════════════════════════
   文本处理
   ═══════════════════════════════════════════════════════════════════════════ */

export function pickText(args: string[], pipe: string): string {
  if (args.length > 0) return args.join(" ");
  return pipe;
}

/* ═══════════════════════════════════════════════════════════════════════════
   索引规范化 - 好品味：边界情况自然融入
   ═══════════════════════════════════════════════════════════════════════════ */

export function normalizeIndex(raw: number | undefined, length: number): number | undefined {
  if (raw === undefined || Number.isNaN(raw)) return raw;
  if (raw < 0) return Math.max(length + raw, 0);
  if (raw > length) return length;
  return raw;
}

/* ═══════════════════════════════════════════════════════════════════════════
   返回值构建
   ═══════════════════════════════════════════════════════════════════════════ */

export function buildSendReturn(
  returnType: string | undefined,
  text: string,
  pipe: string,
  at?: number,
): string {
  const normalized = returnType?.toLowerCase();
  if (!normalized) return text;
  if (normalized === "none") return "";
  if (normalized === "pipe") return pipe ?? "";
  if (normalized === "object") return JSON.stringify({ text, at });
  return text;
}
