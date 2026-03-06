/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    World/Lore Command Handlers                            ║
 * ║                                                                           ║
 * ║  world/get*lore/find/create lore/vector-state 命令簇                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import { parseBoolean, parseNumber } from "../utils/helpers";

type WorldState = "on" | "off" | "toggle";
type LoreType = "primary" | "additional" | "all";

const LORE_FIELD_ALIASES: Record<string, string> = {
  key: "keys",
  keys: "keys",
  keysecondary: "secondary_keys",
  secondary_keys: "secondary_keys",
  secondarykeys: "secondary_keys",
};

function normalizeWorldState(raw: string | undefined): WorldState {
  const normalized = (raw || "toggle").trim().toLowerCase();
  if (normalized === "on" || normalized === "off" || normalized === "toggle") {
    return normalized;
  }
  throw new Error(`/world invalid state: ${raw || ""}`);
}

function normalizeLoreType(raw: string | undefined): LoreType {
  const normalized = (raw || "primary").trim().toLowerCase();
  if (normalized === "primary" || normalized === "additional" || normalized === "all") {
    return normalized;
  }
  throw new Error(`/getcharlore invalid type: ${raw || ""}`);
}

function normalizeLoreFieldName(raw: string | undefined): string {
  const field = (raw || "content").trim();
  if (!field) {
    throw new Error("/getlorefield requires a field name");
  }
  return LORE_FIELD_ALIASES[field.toLowerCase()] || field;
}

function stringifyLoreField(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => String(item)).join(",");
  return JSON.stringify(value);
}

function resolveLoreTarget(
  args: string[],
  namedArgs: Record<string, string>,
  commandName: "/getlorefield" | "/setlorefield",
): { file: string; uid: string; valueIndex: number } {
  let cursor = 0;
  let file = (namedArgs.file || "").trim();
  let uid = (namedArgs.uid || "").trim();

  if (!file) {
    file = (args[cursor] || "").trim();
    cursor += 1;
  }
  if (!uid) {
    uid = (args[cursor] || "").trim();
    cursor += 1;
  }

  if (!file) {
    throw new Error(`${commandName} requires file=<name>`);
  }
  if (!uid) {
    throw new Error(`${commandName} requires uid`);
  }

  return { file, uid, valueIndex: cursor };
}

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

function normalizeCreateLoreInput(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
): { file: string; key?: string; content?: string } {
  const file = (namedArgs.file || "").trim();
  if (!file) {
    throw new Error("/createlore requires file=<name>");
  }

  const key = (namedArgs.key || "").trim();
  const content = (args.join(" ") || pipe || "").trim();
  return {
    file,
    key: key || undefined,
    content: content || undefined,
  };
}

type VectorBooleanGetter = () => boolean | Promise<boolean>;
type VectorBooleanSetter = (value: boolean) => boolean | void | Promise<boolean | void>;
type VectorNumberGetter = () => number | Promise<number>;
type VectorNumberSetter = (value: number) => number | void | Promise<number | void>;

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

/** /world [name] [state=on|off|toggle] - 查询或切换全局世界书绑定 */
export const handleWorld: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.getGlobalLorebooks) {
    throw new Error("/world is not available in current context");
  }

  const worldName = (args.join(" ") || namedArgs.name || pipe || "").trim();
  if (!worldName) {
    const selected = await Promise.resolve(ctx.getGlobalLorebooks());
    return JSON.stringify(selected);
  }

  if (!ctx.setGlobalLorebooks) {
    throw new Error("/world set is not available in current context");
  }

  const state = normalizeWorldState(namedArgs.state);
  const selected = new Set(await Promise.resolve(ctx.getGlobalLorebooks()));
  const isEnabled = selected.has(worldName);

  if ((state === "on" && !isEnabled) || (state === "toggle" && !isEnabled)) {
    selected.add(worldName);
  }
  if ((state === "off" && isEnabled) || (state === "toggle" && isEnabled)) {
    selected.delete(worldName);
  }

  const next = Array.from(selected);
  await Promise.resolve(ctx.setGlobalLorebooks(next));
  return JSON.stringify(next);
};

/** /getcharlore [target] [type=primary|additional|all] - 获取角色绑定世界书 */
export const handleGetCharLore: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.getCharLorebooks) {
    throw new Error("/getcharlore is not available in current context");
  }

  const target = (args[0] || namedArgs.name || namedArgs.character || "").trim() || undefined;
  const loreType = normalizeLoreType(namedArgs.type);
  const bindings = await Promise.resolve(ctx.getCharLorebooks(target));

  if (loreType === "primary") {
    return bindings.primary || "";
  }
  if (loreType === "additional") {
    return JSON.stringify(bindings.additional);
  }

  const merged = bindings.primary
    ? [bindings.primary, ...bindings.additional]
    : bindings.additional.slice();
  return JSON.stringify(merged);
};

/** /getchatlore - 获取当前聊天绑定世界书 */
export const handleGetChatLore: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.getChatLorebook) {
    throw new Error("/getchatlore is not available in current context");
  }
  const lorebook = await Promise.resolve(ctx.getChatLorebook());
  return lorebook || "";
};

/** /getgloballore - 获取当前全局启用世界书列表 */
export const handleGetGlobalLore: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.getGlobalLorebooks) {
    throw new Error("/getgloballore is not available in current context");
  }
  const lorebooks = await Promise.resolve(ctx.getGlobalLorebooks());
  return JSON.stringify(lorebooks);
};

/** /getpersonalore - 获取当前 persona 绑定世界书 */
export const handleGetPersonaLore: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.getPersonaLorebook) {
    throw new Error("/getpersonalore is not available in current context");
  }
  const lorebook = await Promise.resolve(ctx.getPersonaLorebook());
  return lorebook || "";
};

/** /getlorefield file=<book> [field=content] <uid> - 获取条目字段 */
export const handleGetLoreField: CommandHandler = async (args, namedArgs, ctx, _pipe) => {
  if (!ctx.getLoreField) {
    throw new Error("/getlorefield is not available in current context");
  }

  const { file, uid } = resolveLoreTarget(args, namedArgs, "/getlorefield");
  const field = normalizeLoreFieldName(namedArgs.field);
  const value = await Promise.resolve(ctx.getLoreField(file, uid, field));
  return stringifyLoreField(value);
};

/** /setlorefield file=<book> uid=<uid> [field=content] <value> - 更新条目字段 */
export const handleSetLoreField: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.setLoreField) {
    throw new Error("/setlorefield is not available in current context");
  }

  const { file, uid, valueIndex } = resolveLoreTarget(args, namedArgs, "/setlorefield");
  const valueFromArgs = args.slice(valueIndex).join(" ");
  const hasValue = valueFromArgs.length > 0 || pipe.length > 0;
  if (!hasValue) {
    throw new Error("/setlorefield requires a value");
  }

  const field = normalizeLoreFieldName(namedArgs.field);
  const nextValue = valueFromArgs || pipe;
  await Promise.resolve(ctx.setLoreField(file, uid, field, nextValue));
  return "";
};

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

/** /createlore file=<book> [key=<text>] [content] - 创建 lore 条目并返回 uid */
export const handleCreateLore: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.createWorldBookEntry) {
    throw new Error("/createlore is not available in current context");
  }

  const { file, key, content } = normalizeCreateLoreInput(args, namedArgs, pipe);
  const created = await Promise.resolve(ctx.createWorldBookEntry({
    keys: key ? [key] : [],
    comment: key,
    content: content || "",
    enabled: true,
  }, file));

  if (!created?.id) {
    throw new Error(`/createlore failed for file=${file}`);
  }
  return String(created.id);
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
