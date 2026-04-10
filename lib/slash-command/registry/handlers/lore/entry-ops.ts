/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    World/Lore Entry CRUD Handlers                        ║
 * ║                                                                          ║
 * ║  world/get/set/create/delete/activate/timed-effect 命令簇                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../../types";

// ============================================================================
//                              类型与常量
// ============================================================================

type WorldState = "on" | "off" | "toggle";
type LoreType = "primary" | "additional" | "all";
type TimedEffectName = "sticky" | "cooldown" | "delay";
type TimedEffectFormat = "boolean" | "number";
type TimedEffectState = "on" | "off" | "toggle";

export const LORE_FIELD_ALIASES: Record<string, string> = {
  key: "keys",
  keys: "keys",
  keysecondary: "secondary_keys",
  secondary_keys: "secondary_keys",
  secondarykeys: "secondary_keys",
};

// ============================================================================
//                              规范化函数
// ============================================================================

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

export function normalizeLoreFieldName(raw: string | undefined): string {
  const field = (raw || "content").trim();
  if (!field) {
    throw new Error("/getlorefield requires a field name");
  }
  return LORE_FIELD_ALIASES[field.toLowerCase()] || field;
}

function normalizeTimedEffectName(raw: string | undefined, commandName: string): TimedEffectName {
  const normalized = (raw || "").trim().toLowerCase();
  if (normalized === "sticky" || normalized === "cooldown" || normalized === "delay") {
    return normalized;
  }
  throw new Error(`/${commandName} invalid effect: ${raw || ""}`);
}

function normalizeTimedEffectFormat(raw: string | undefined): TimedEffectFormat {
  const normalized = (raw || "boolean").trim().toLowerCase();
  if (normalized === "boolean" || normalized === "bool") {
    return "boolean";
  }
  if (normalized === "number") {
    return "number";
  }
  throw new Error(`/wi-get-timed-effect invalid format: ${raw || ""}`);
}

function normalizeTimedEffectState(raw: string | undefined): TimedEffectState {
  const normalized = (raw || "").trim().toLowerCase();
  if (normalized === "on" || normalized === "off" || normalized === "toggle") {
    return normalized;
  }
  throw new Error(`/wi-set-timed-effect invalid state: ${raw || ""}`);
}

function stringifyLoreField(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => String(item)).join(",");
  return JSON.stringify(value);
}

// ============================================================================
//                              目标解析
// ============================================================================

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

function resolveTimedEffectTarget(
  args: string[],
  namedArgs: Record<string, string>,
  commandName: "wi-get-timed-effect" | "wi-set-timed-effect",
): { file: string; uid: string; valueIndex: number } {
  let cursor = 0;
  let file = (namedArgs.file || "").trim();
  let uid = (namedArgs.uid || "").trim();

  if (!uid && commandName === "wi-get-timed-effect") {
    uid = (args[cursor] || "").trim();
    cursor += 1;
  }

  if (!file) {
    throw new Error(`/${commandName} requires file=<name>`);
  }

  if (!uid) {
    uid = (args[cursor] || "").trim();
    if (uid) {
      cursor += 1;
    }
  }

  if (!uid) {
    throw new Error(`/${commandName} requires uid`);
  }

  return { file, uid, valueIndex: cursor };
}

function normalizeTimedEffectBooleanResult(value: unknown): string {
  if (typeof value !== "boolean") {
    throw new Error("/wi-get-timed-effect host returned non-boolean result");
  }
  return String(value);
}

function normalizeTimedEffectNumberResult(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("/wi-get-timed-effect host returned invalid numeric result");
  }
  return String(value);
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

// ============================================================================
//                              命令处理器
// ============================================================================

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

/** /wi-get-timed-effect file=<book> effect=<sticky|cooldown|delay> [format=bool|number] <uid> */
export const handleGetWorldInfoTimedEffect: CommandHandler = async (args, namedArgs, ctx, _pipe) => {
  if (!ctx.getWorldInfoTimedEffect) {
    throw new Error("/wi-get-timed-effect is not available in current context");
  }
  if (!ctx.dialogueId) {
    throw new Error("/wi-get-timed-effect requires active chat context");
  }

  const { file, uid } = resolveTimedEffectTarget(args, namedArgs, "wi-get-timed-effect");
  const effect = normalizeTimedEffectName(namedArgs.effect, "wi-get-timed-effect");
  const format = normalizeTimedEffectFormat(namedArgs.format);
  const result = await Promise.resolve(ctx.getWorldInfoTimedEffect(file, uid, effect, { format }));

  return format === "number"
    ? normalizeTimedEffectNumberResult(result)
    : normalizeTimedEffectBooleanResult(result);
};

/** /wi-set-timed-effect file=<book> uid=<uid> effect=<sticky|cooldown|delay> <on|off|toggle> */
export const handleSetWorldInfoTimedEffect: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.setWorldInfoTimedEffect) {
    throw new Error("/wi-set-timed-effect is not available in current context");
  }
  if (!ctx.dialogueId) {
    throw new Error("/wi-set-timed-effect requires active chat context");
  }

  const { file, uid, valueIndex } = resolveTimedEffectTarget(args, namedArgs, "wi-set-timed-effect");
  const effect = normalizeTimedEffectName(namedArgs.effect, "wi-set-timed-effect");
  const rawState = (args.slice(valueIndex).join(" ") || pipe || "").trim();
  if (!rawState) {
    throw new Error("/wi-set-timed-effect requires state value");
  }

  const state = normalizeTimedEffectState(rawState);
  await Promise.resolve(ctx.setWorldInfoTimedEffect(file, uid, effect, state));
  return "";
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
