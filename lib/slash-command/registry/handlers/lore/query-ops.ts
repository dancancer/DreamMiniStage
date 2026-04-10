/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    World/Lore Query & Vector Handlers                    ║
 * ║                                                                          ║
 * ║  findlore/vector-* 命令簇                                                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../../types";
import { parseBoolean, parseNumber } from "../../utils/helpers";
import { normalizeLoreFieldName } from "./entry-ops";

// ============================================================================
//                              类型定义
// ============================================================================

type VectorBooleanGetter = () => boolean | Promise<boolean>;
type VectorBooleanSetter = (value: boolean) => boolean | void | Promise<boolean | void>;
type VectorNumberGetter = () => number | Promise<number>;
type VectorNumberSetter = (value: number) => number | void | Promise<number | void>;

// ============================================================================
//                              规范化函数
// ============================================================================

function normalizeVectorWorldInfoState(raw: string): boolean {
  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/vector-worldinfo-state invalid boolean value: ${raw}`);
  }
  return parsed;
}

function normalizeVectorBooleanValue(commandName: string, raw: string): boolean {
  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/${commandName} invalid boolean value: ${raw}`);
  }
  return parsed;
}

function normalizeVectorPositiveNumber(commandName: string, raw: string): number {
  const parsed = parseNumber(raw);
  if (parsed === undefined || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`/${commandName} invalid numeric value: ${raw}`);
  }
  return parsed;
}

function normalizeVectorThreshold(raw: string): number {
  const parsed = parseNumber(raw);
  if (parsed === undefined || !Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`/vector-threshold invalid threshold value: ${raw}`);
  }
  return parsed;
}

// ============================================================================
//                              向量状态辅助函数
// ============================================================================

async function handleVectorBooleanState(
  commandName: string,
  args: string[],
  pipe: string,
  getter: VectorBooleanGetter,
  setter?: VectorBooleanSetter,
): Promise<string> {
  const raw = (args.join(" ") || pipe || "").trim();
  if (!raw) {
    return String(await Promise.resolve(getter()));
  }
  if (!setter) {
    throw new Error(`/${commandName} set is not available in current context`);
  }

  const nextValue = normalizeVectorBooleanValue(commandName, raw);
  const applied = await Promise.resolve(setter(nextValue));
  if (typeof applied === "boolean") {
    return String(applied);
  }
  return String(await Promise.resolve(getter()));
}

async function handleVectorNumberState(
  commandName: string,
  args: string[],
  pipe: string,
  getter: VectorNumberGetter,
  normalize: (raw: string) => number,
  setter?: VectorNumberSetter,
): Promise<string> {
  const raw = (args.join(" ") || pipe || "").trim();
  if (!raw) {
    return String(await Promise.resolve(getter()));
  }
  if (!setter) {
    throw new Error(`/${commandName} set is not available in current context`);
  }

  const nextValue = normalize(raw);
  const applied = await Promise.resolve(setter(nextValue));
  if (typeof applied === "number" && Number.isFinite(applied)) {
    return String(applied);
  }
  return String(await Promise.resolve(getter()));
}

// ============================================================================
//                              搜索辅助函数
// ============================================================================

function resolveLoreSearchInput(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
): { file: string; query: string } {
  let cursor = 0;
  let file = (namedArgs.file || "").trim();

  if (!file) {
    file = (args[cursor] || "").trim();
    cursor += 1;
  }
  if (!file) {
    throw new Error("/findlore requires file=<name>");
  }

  const query = (args.slice(cursor).join(" ") || pipe || "").trim();
  if (!query) {
    throw new Error("/findlore requires search text");
  }

  return { file, query };
}

function getFieldStrings(
  entry: Record<string, unknown>,
  field: string,
): string[] {
  const rawValue = entry[field];
  if (rawValue === undefined || rawValue === null) {
    return [];
  }

  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => String(item));
  }

  return [String(rawValue)];
}

function scoreLoreMatch(candidate: string, query: string): number {
  const normalizedCandidate = candidate.trim().toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedCandidate || !normalizedQuery) {
    return Number.POSITIVE_INFINITY;
  }
  if (normalizedCandidate === normalizedQuery) {
    return 0;
  }
  if (normalizedCandidate.startsWith(normalizedQuery)) {
    return 1;
  }
  if (normalizedCandidate.includes(normalizedQuery)) {
    return 2;
  }
  return Number.POSITIVE_INFINITY;
}

// ============================================================================
//                              命令处理器
// ============================================================================

/** /findlore file=<book> [field=key] <query> - 按字段模糊查找条目 uid */
export const handleFindLore: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.listWorldBookEntries) {
    throw new Error("/findlore is not available in current context");
  }

  const { file, query } = resolveLoreSearchInput(args, namedArgs, pipe);
  const field = normalizeLoreFieldName(namedArgs.field || "key");
  const entries = await Promise.resolve(ctx.listWorldBookEntries(file));
  if (!Array.isArray(entries) || entries.length === 0) {
    return "";
  }

  let bestMatch: { id: string; score: number } | undefined;
  for (const item of entries) {
    const entry = item as unknown as Record<string, unknown>;
    const entryId = String(entry.id ?? entry.uid ?? "").trim();
    if (!entryId) {
      continue;
    }

    const candidates = getFieldStrings(entry, field);
    const score = candidates.reduce((best, candidate) => {
      const current = scoreLoreMatch(candidate, query);
      return current < best ? current : best;
    }, Number.POSITIVE_INFINITY);

    if (!Number.isFinite(score)) {
      continue;
    }
    if (!bestMatch || score < bestMatch.score) {
      bestMatch = { id: entryId, score };
    }
  }

  return bestMatch?.id || "";
};

/** /vector-threshold [number] - 查询或设置向量阈值 */
export const handleVectorThreshold: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.getVectorScoreThreshold) {
    throw new Error("/vector-threshold is not available in current context");
  }

  return handleVectorNumberState(
    "vector-threshold",
    args,
    pipe,
    ctx.getVectorScoreThreshold,
    normalizeVectorThreshold,
    ctx.setVectorScoreThreshold,
  );
};

/** /vector-query [number] - 查询或设置向量查询消息数 */
export const handleVectorQuery: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.getVectorQueryMessages) {
    throw new Error("/vector-query is not available in current context");
  }

  return handleVectorNumberState(
    "vector-query",
    args,
    pipe,
    ctx.getVectorQueryMessages,
    (raw) => normalizeVectorPositiveNumber("vector-query", raw),
    ctx.setVectorQueryMessages,
  );
};

/** /vector-max-entries [number] - 查询或设置最大注入条目数 */
export const handleVectorMaxEntries: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.getVectorMaxEntries) {
    throw new Error("/vector-max-entries is not available in current context");
  }

  return handleVectorNumberState(
    "vector-max-entries",
    args,
    pipe,
    ctx.getVectorMaxEntries,
    (raw) => normalizeVectorPositiveNumber("vector-max-entries", raw),
    ctx.setVectorMaxEntries,
  );
};

/** /vector-chats-state [bool] - 查询或设置 chat 向量化开关 */
export const handleVectorChatsState: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.getVectorChatsState) {
    throw new Error("/vector-chats-state is not available in current context");
  }

  return handleVectorBooleanState(
    "vector-chats-state",
    args,
    pipe,
    ctx.getVectorChatsState,
    ctx.setVectorChatsState,
  );
};

/** /vector-files-state [bool] - 查询或设置 file 向量化开关 */
export const handleVectorFilesState: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.getVectorFilesState) {
    throw new Error("/vector-files-state is not available in current context");
  }

  return handleVectorBooleanState(
    "vector-files-state",
    args,
    pipe,
    ctx.getVectorFilesState,
    ctx.setVectorFilesState,
  );
};

/** /vector-worldinfo-state [bool] - 查询或设置 worldinfo 向量化开关 */
export const handleVectorWorldInfoState: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.getVectorWorldInfoState) {
    throw new Error("/vector-worldinfo-state is not available in current context");
  }

  const raw = (args.join(" ") || pipe || "").trim();
  if (!raw) {
    const current = await Promise.resolve(ctx.getVectorWorldInfoState());
    return String(current);
  }

  if (!ctx.setVectorWorldInfoState) {
    throw new Error("/vector-worldinfo-state set is not available in current context");
  }

  const nextState = normalizeVectorWorldInfoState(raw);
  const applied = await Promise.resolve(ctx.setVectorWorldInfoState(nextState));
  if (typeof applied === "boolean") {
    return String(applied);
  }

  const current = await Promise.resolve(ctx.getVectorWorldInfoState());
  return String(current);
};
