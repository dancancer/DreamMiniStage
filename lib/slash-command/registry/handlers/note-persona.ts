/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                Note & Persona Command Handlers                           ║
 * ║                                                                           ║
 * ║  note-* 与 persona-* 命令，统一单路径状态读写与 fail-fast 校验               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import type { AuthorNoteState, PersonaLockType, PersonaSetMode } from "../../types";

const NOTE_POSITION_ALIASES: Record<string, AuthorNoteState["position"]> = {
  after: "after",
  scenario: "after",
  chat: "chat",
  before: "before",
  before_scenario: "before",
};

const NOTE_ROLE_VALUES = new Set<AuthorNoteState["role"]>([
  "system",
  "user",
  "assistant",
]);

const PERSONA_SET_MODES = new Set<PersonaSetMode>(["lookup", "temp", "all"]);
const PERSONA_LOCK_TYPES = new Set<PersonaLockType>(["chat", "character", "default"]);

function ensureHostCallback<T>(
  callback: T | undefined,
  commandName: string,
): T {
  if (!callback) {
    throw new Error(`/${commandName} is not available in current context`);
  }
  return callback;
}

function normalizeAuthorNoteState(commandName: string, value: unknown): AuthorNoteState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`/${commandName} host returned invalid note state`);
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.text !== "string") {
    throw new Error(`/${commandName} host returned invalid note text`);
  }
  if (!Number.isInteger(raw.depth) || Number(raw.depth) < 0) {
    throw new Error(`/${commandName} host returned invalid note depth`);
  }
  if (!Number.isInteger(raw.frequency) || Number(raw.frequency) < 0) {
    throw new Error(`/${commandName} host returned invalid note frequency`);
  }
  if (raw.position !== "before" && raw.position !== "after" && raw.position !== "chat") {
    throw new Error(`/${commandName} host returned invalid note position`);
  }
  if (!NOTE_ROLE_VALUES.has(raw.role as AuthorNoteState["role"])) {
    throw new Error(`/${commandName} host returned invalid note role`);
  }

  return {
    text: raw.text,
    depth: Number(raw.depth),
    frequency: Number(raw.frequency),
    position: raw.position,
    role: raw.role as AuthorNoteState["role"],
  };
}

function resolveNoteText(args: string[], namedArgs: Record<string, string>, pipe: string): string {
  const fromArgs = args.join(" ");
  const fromNamed = namedArgs.text;
  return (fromArgs || fromNamed || pipe || "").trim();
}

function parseNonNegativeInteger(
  value: string,
  commandName: string,
  fieldName: string,
): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`/${commandName} invalid ${fieldName}: ${value}`);
  }
  return parsed;
}

function normalizeNotePosition(raw: string, commandName: string): AuthorNoteState["position"] {
  const normalized = raw.trim().toLowerCase();
  const mapped = NOTE_POSITION_ALIASES[normalized];
  if (!mapped) {
    throw new Error(`/${commandName} invalid position: ${raw}`);
  }
  return mapped;
}

function normalizeNoteRole(raw: string, commandName: string): AuthorNoteState["role"] {
  const normalized = raw.trim().toLowerCase();
  if (!NOTE_ROLE_VALUES.has(normalized as AuthorNoteState["role"])) {
    throw new Error(`/${commandName} invalid role: ${raw}`);
  }
  return normalized as AuthorNoteState["role"];
}

function normalizePersonaSetMode(raw: string | undefined): PersonaSetMode {
  const normalized = (raw || "all").trim().toLowerCase();
  if (!PERSONA_SET_MODES.has(normalized as PersonaSetMode)) {
    throw new Error(`/persona-set invalid mode: ${raw || ""}`);
  }
  return normalized as PersonaSetMode;
}

function normalizePersonaLockType(raw: string | undefined): PersonaLockType {
  const normalized = (raw || "chat").trim().toLowerCase();
  if (!PERSONA_LOCK_TYPES.has(normalized as PersonaLockType)) {
    throw new Error(`/persona-lock invalid type: ${raw || ""}`);
  }
  return normalized as PersonaLockType;
}

function parsePersonaLockState(raw: string): "on" | "off" | "toggle" {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "toggle" || normalized === "t") {
    return "toggle";
  }
  if (normalized === "on" || normalized === "true" || normalized === "1") {
    return "on";
  }
  if (normalized === "off" || normalized === "false" || normalized === "0") {
    return "off";
  }
  throw new Error(`/persona-lock invalid state: ${raw}`);
}

async function readNoteState(
  ctx: Parameters<CommandHandler>[2],
  commandName: string,
): Promise<AuthorNoteState> {
  const callback = ensureHostCallback(ctx.getAuthorNoteState, commandName);
  const state = await Promise.resolve(callback());
  return normalizeAuthorNoteState(commandName, state);
}

async function writeNoteState(
  ctx: Parameters<CommandHandler>[2],
  commandName: string,
  patch: Partial<AuthorNoteState>,
): Promise<AuthorNoteState> {
  const callback = ensureHostCallback(ctx.setAuthorNoteState, commandName);
  const state = await Promise.resolve(callback(patch));
  return normalizeAuthorNoteState(commandName, state);
}

/** /note [text] - 读写作者注释文本 */
export const handleNote: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const nextText = resolveNoteText(args, namedArgs, pipe);
  if (!nextText) {
    const state = await readNoteState(ctx, "note");
    return state.text;
  }

  const state = await writeNoteState(ctx, "note", { text: nextText });
  return state.text;
};

/** /note-depth|/depth [number] - 读写作者注释深度 */
export const handleNoteDepth: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const rawValue = (args[0] || namedArgs.depth || pipe || "").trim();
  if (!rawValue) {
    const state = await readNoteState(ctx, "note-depth");
    return String(state.depth);
  }

  const depth = parseNonNegativeInteger(rawValue, "note-depth", "depth");
  const state = await writeNoteState(ctx, "note-depth", { depth });
  return String(state.depth);
};

/** /note-frequency|/note-freq|/freq [number] - 读写作者注释插入频率 */
export const handleNoteFrequency: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const rawValue = (args[0] || namedArgs.frequency || namedArgs.freq || pipe || "").trim();
  if (!rawValue) {
    const state = await readNoteState(ctx, "note-frequency");
    return String(state.frequency);
  }

  const frequency = parseNonNegativeInteger(rawValue, "note-frequency", "frequency");
  const state = await writeNoteState(ctx, "note-frequency", { frequency });
  return String(state.frequency);
};

/** /note-position|/note-pos|/pos [position] - 读写作者注释注入位置 */
export const handleNotePosition: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const rawPosition = (args[0] || namedArgs.position || pipe || "").trim();
  if (!rawPosition) {
    const state = await readNoteState(ctx, "note-position");
    return state.position;
  }

  const position = normalizeNotePosition(rawPosition, "note-position");
  const state = await writeNoteState(ctx, "note-position", { position });
  return state.position;
};

/** /note-role [role] - 读写作者注释注入角色 */
export const handleNoteRole: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const rawRole = (args[0] || namedArgs.role || pipe || "").trim();
  if (!rawRole) {
    const state = await readNoteState(ctx, "note-role");
    return state.role;
  }

  const role = normalizeNoteRole(rawRole, "note-role");
  const state = await writeNoteState(ctx, "note-role", { role });
  return state.role;
};

/** /persona-set|/persona [name] - 读写当前 persona 名称 */
export const handlePersonaSet: CommandHandler = async (args, namedArgs, ctx, _pipe) => {
  const nextName = args.join(" ").trim();
  if (!nextName) {
    const getPersonaName = ensureHostCallback(ctx.getPersonaName, "persona");
    const current = await Promise.resolve(getPersonaName());
    if (typeof current !== "string") {
      throw new Error("/persona host returned non-string persona name");
    }
    return current;
  }

  const mode = normalizePersonaSetMode(namedArgs.mode);
  const setPersonaName = ensureHostCallback(ctx.setPersonaName, "persona-set");
  const updated = await Promise.resolve(setPersonaName(nextName, { mode }));
  if (typeof updated !== "string") {
    throw new Error("/persona-set host returned non-string persona name");
  }
  return updated;
};

/** /persona-lock [state] - 读写 persona 锁定状态 */
export const handlePersonaLock: CommandHandler = async (args, namedArgs, ctx, _pipe) => {
  const type = normalizePersonaLockType(namedArgs.type);
  const rawState = (namedArgs.state || args[0] || "").trim();

  if (!rawState) {
    const getPersonaLockState = ensureHostCallback(ctx.getPersonaLockState, "persona-lock");
    const current = await Promise.resolve(getPersonaLockState({ type }));
    if (typeof current !== "boolean") {
      throw new Error("/persona-lock host returned non-boolean lock state");
    }
    return String(current);
  }

  const state = parsePersonaLockState(rawState);
  const setPersonaLock = ensureHostCallback(ctx.setPersonaLock, "persona-lock");
  const nextState = await Promise.resolve(setPersonaLock(state, { type }));
  if (typeof nextState !== "boolean") {
    throw new Error("/persona-lock host returned non-boolean lock state");
  }
  return String(nextState);
};

/** /persona-sync|/sync - 触发 persona 同步 */
export const handlePersonaSync: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const syncPersona = ensureHostCallback(ctx.syncPersona, "persona-sync");
  await Promise.resolve(syncPersona());
  return "";
};
