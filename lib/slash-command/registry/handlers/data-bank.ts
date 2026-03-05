/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Data Bank Command Handlers                            ║
 * ║                                                                           ║
 * ║  Data Bank 命令 - data-bank-* / databank-*                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  DataBankEntrySnapshot,
  DataBankSource,
} from "../../types";
import type { CommandHandler } from "../types";

const DATA_BANK_SOURCES: DataBankSource[] = ["global", "character", "chat"];
const DATA_BANK_FIELDS = ["name", "url"] as const;

type DataBankListField = (typeof DATA_BANK_FIELDS)[number];
type DataBankSearchReturnType = "urls" | "chunks";

function parseSource(
  raw: string | undefined,
  commandName: string,
  fallback?: DataBankSource,
): DataBankSource | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (DATA_BANK_SOURCES.includes(normalized as DataBankSource)) {
    return normalized as DataBankSource;
  }

  throw new Error(`/${commandName} invalid source: ${raw}`);
}

function normalizeListField(raw: string | undefined): DataBankListField {
  if (raw === undefined || raw.trim().length === 0) {
    return "url";
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "name" || normalized === "url") {
    return normalized;
  }

  throw new Error(`/data-bank-list invalid field: ${raw}`);
}

function normalizeSearchReturnType(raw: string | undefined): DataBankSearchReturnType {
  if (raw === undefined || raw.trim().length === 0) {
    return "urls";
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "urls" || normalized === "chunks") {
    return normalized;
  }

  throw new Error(`/data-bank-search invalid return value: ${raw}`);
}

function parseThreshold(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`/data-bank-search invalid threshold: ${raw}`);
  }
  return parsed;
}

function parseCount(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`/data-bank-search invalid count: ${raw}`);
  }
  return parsed;
}

function resolveDataTarget(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
  commandName: string,
): string {
  const namedTarget = namedArgs.url || namedArgs.name || namedArgs.target;
  const positionalTarget = args.join(" ");
  const target = (namedTarget || positionalTarget || pipe || "").trim();
  if (!target) {
    throw new Error(`/${commandName} requires a name or url target`);
  }
  return target;
}

function resolveDataContent(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
  commandName: string,
): string {
  const content = (namedArgs.text || args.join(" ") || pipe || "").trim();
  if (!content) {
    throw new Error(`/${commandName} requires content`);
  }
  return content;
}

function resolveUpdatePayload(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
): { target: string; content: string } {
  const namedTarget = (namedArgs.url || namedArgs.name || namedArgs.target || "").trim();
  if (namedTarget) {
    const content = resolveDataContent(args, namedArgs, pipe, "data-bank-update");
    return { target: namedTarget, content };
  }

  const textFromPipe = pipe.trim();
  if (args.length >= 2) {
    const target = args[0].trim();
    const content = args.slice(1).join(" ").trim() || textFromPipe;
    if (!target) {
      throw new Error("/data-bank-update requires a name or url target");
    }
    if (!content) {
      throw new Error("/data-bank-update requires content");
    }
    return { target, content };
  }

  if (args.length === 1 && textFromPipe) {
    return { target: args[0].trim(), content: textFromPipe };
  }

  throw new Error("/data-bank-update requires target and content");
}

function normalizeDataBankEntries(value: unknown): DataBankEntrySnapshot[] {
  if (!Array.isArray(value)) {
    throw new Error("/data-bank-list host returned non-array entries");
  }

  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("/data-bank-list host returned invalid entry");
    }

    const entry = item as Record<string, unknown>;
    if (typeof entry.name !== "string" || typeof entry.url !== "string") {
      throw new Error("/data-bank-list host returned entry without name/url");
    }

    return {
      name: entry.name,
      url: entry.url,
      source: typeof entry.source === "string"
        ? parseSource(entry.source, "data-bank-list")
        : undefined,
      enabled: entry.enabled === undefined ? undefined : entry.enabled === true,
    } satisfies DataBankEntrySnapshot;
  });
}

function normalizeSearchUrls(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("/data-bank-search host returned non-array urls");
  }

  return value.map((item) => {
    if (typeof item !== "string") {
      throw new Error("/data-bank-search host returned non-string url item");
    }
    return item;
  });
}

/** /data-bank - 打开 Data Bank 管理器 */
export const handleDataBank: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.openDataBank) {
    throw new Error("/data-bank is not available in current context");
  }

  await Promise.resolve(ctx.openDataBank());
  return "";
};

/** /data-bank-list - 列出 Data Bank 项 */
export const handleDataBankList: CommandHandler = async (_args, namedArgs, ctx, _pipe) => {
  if (!ctx.listDataBankEntries) {
    throw new Error("/data-bank-list is not available in current context");
  }

  const source = parseSource(namedArgs.source, "data-bank-list");
  const field = normalizeListField(namedArgs.field);
  const entries = await Promise.resolve(ctx.listDataBankEntries({ source }));
  const normalized = normalizeDataBankEntries(entries);
  return JSON.stringify(normalized.map((entry) => entry[field]));
};

/** /data-bank-get - 获取 Data Bank 文本内容 */
export const handleDataBankGet: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.getDataBankText) {
    throw new Error("/data-bank-get is not available in current context");
  }

  const source = parseSource(namedArgs.source, "data-bank-get");
  const target = resolveDataTarget(args, namedArgs, pipe, "data-bank-get");
  const text = await Promise.resolve(ctx.getDataBankText(target, { source }));
  if (typeof text !== "string") {
    throw new Error("/data-bank-get host returned non-string text");
  }

  return text;
};

/** /data-bank-add - 新增 Data Bank 文本条目 */
export const handleDataBankAdd: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.addDataBankText) {
    throw new Error("/data-bank-add is not available in current context");
  }

  const source = parseSource(namedArgs.source, "data-bank-add", "chat");
  const name = namedArgs.name?.trim() || undefined;
  const content = resolveDataContent(args, namedArgs, pipe, "data-bank-add");
  const url = await Promise.resolve(ctx.addDataBankText(content, { source, name }));
  if (typeof url !== "string") {
    throw new Error("/data-bank-add host returned non-string url");
  }

  return url;
};

/** /data-bank-update - 更新 Data Bank 条目内容 */
export const handleDataBankUpdate: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.updateDataBankText) {
    throw new Error("/data-bank-update is not available in current context");
  }

  const source = parseSource(namedArgs.source, "data-bank-update", "chat");
  const { target, content } = resolveUpdatePayload(args, namedArgs, pipe);
  const result = await Promise.resolve(ctx.updateDataBankText(target, content, { source }));
  if (result === undefined || result === null) {
    return "";
  }
  if (typeof result !== "string") {
    throw new Error("/data-bank-update host returned non-string url");
  }

  return result;
};

/** /data-bank-delete - 删除 Data Bank 条目 */
export const handleDataBankDelete: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.deleteDataBankEntry) {
    throw new Error("/data-bank-delete is not available in current context");
  }

  const source = parseSource(namedArgs.source, "data-bank-delete", "chat");
  const target = resolveDataTarget(args, namedArgs, pipe, "data-bank-delete");
  await Promise.resolve(ctx.deleteDataBankEntry(target, { source }));
  return "";
};

/** /data-bank-disable - 禁用 Data Bank 条目 */
export const handleDataBankDisable: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.setDataBankEntryEnabled) {
    throw new Error("/data-bank-disable is not available in current context");
  }

  const source = parseSource(namedArgs.source, "data-bank-disable");
  const target = resolveDataTarget(args, namedArgs, pipe, "data-bank-disable");
  await Promise.resolve(ctx.setDataBankEntryEnabled(target, false, { source }));
  return "";
};

/** /data-bank-enable - 启用 Data Bank 条目 */
export const handleDataBankEnable: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.setDataBankEntryEnabled) {
    throw new Error("/data-bank-enable is not available in current context");
  }

  const source = parseSource(namedArgs.source, "data-bank-enable");
  const target = resolveDataTarget(args, namedArgs, pipe, "data-bank-enable");
  await Promise.resolve(ctx.setDataBankEntryEnabled(target, true, { source }));
  return "";
};

/** /data-bank-ingest - 触发 Data Bank 向量入库 */
export const handleDataBankIngest: CommandHandler = async (_args, namedArgs, ctx, _pipe) => {
  if (!ctx.ingestDataBank) {
    throw new Error("/data-bank-ingest is not available in current context");
  }

  const source = parseSource(namedArgs.source, "data-bank-ingest");
  await Promise.resolve(ctx.ingestDataBank({ source }));
  return "";
};

/** /data-bank-purge - 清理 Data Bank 向量索引 */
export const handleDataBankPurge: CommandHandler = async (_args, namedArgs, ctx, _pipe) => {
  if (!ctx.purgeDataBank) {
    throw new Error("/data-bank-purge is not available in current context");
  }

  const source = parseSource(namedArgs.source, "data-bank-purge");
  await Promise.resolve(ctx.purgeDataBank({ source }));
  return "";
};

/** /data-bank-search - 检索 Data Bank 向量结果 */
export const handleDataBankSearch: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.searchDataBank) {
    throw new Error("/data-bank-search is not available in current context");
  }

  const query = (args.join(" ") || namedArgs.query || pipe || "").trim();
  if (!query) {
    throw new Error("/data-bank-search requires a query");
  }

  const source = parseSource(namedArgs.source, "data-bank-search");
  const threshold = parseThreshold(namedArgs.threshold);
  const count = parseCount(namedArgs.count);
  const returnType = normalizeSearchReturnType(namedArgs.return);

  const result = await Promise.resolve(ctx.searchDataBank(query, {
    source,
    threshold,
    count,
    returnType,
  }));

  if (returnType === "chunks") {
    if (typeof result !== "string") {
      throw new Error("/data-bank-search host returned non-string chunks");
    }
    return result;
  }

  return JSON.stringify(normalizeSearchUrls(result));
};
