/**
 * @input  lib/slash-command/types, lib/slash-command/prompt-injection-store
 * @output 存储读写辅助函数、连接配置管理、作者注释注入、Persona 锁状态
 * @pos    Slash 执行上下文适配 - localStorage 持久化层
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        Storage Helpers                                    ║
 * ║                                                                           ║
 * ║  职责：封装 slash-context-adapter 依赖的全部 localStorage 读写           ║
 * ║  包含：AuthorNote / PersonaLock / ConnectionProfile 状态管理             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  AuthorNoteState,
  ConnectionProfileState,
  PersonaLockType,
} from "@/lib/slash-command/types";
import type { ApiCallContext } from "../types";
import {
  upsertPromptInjection,
  removePromptInjections,
} from "@/lib/slash-command/prompt-injection-store";

/* ── 常量 ──────────────────────────────────────────────────── */

const AUTHOR_NOTE_STORAGE_KEY = "dreamministage.author-note";
const PERSONA_NAME_STORAGE_KEY = "dreamministage.persona-name";
const PERSONA_LOCK_STORAGE_KEY = "dreamministage.persona-lock";
const CONNECTION_PROFILES_STORAGE_KEY = "dreamministage.connection-profiles";
const CONNECTION_PROFILE_SELECTED_KEY = "dreamministage.connection-profile-selected";
const AUTHOR_NOTE_INJECTION_PREFIX = "note_injection";

const DEFAULT_AUTHOR_NOTE_STATE: AuthorNoteState = {
  text: "", depth: 4, frequency: 1, position: "chat", role: "system",
};
const DEFAULT_PERSONA_LOCK_STATE: Record<PersonaLockType, boolean> = {
  chat: false, character: false, default: false,
};

/* ── 基础读写 ──────────────────────────────────────────────── */

function readStringFromStorage(storageKey: string): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(storageKey) || "";
  } catch {
    return "";
  }
}

function writeStringToStorage(storageKey: string, value: string): string {
  const normalized = String(value);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, normalized);
  }
  return normalized;
}

/* ── ConnectionProfile 管理 ────────────────────────────────── */

function createConnectionProfileId(name: string): string {
  const normalizedName = normalizeScopeToken(name.trim().toLowerCase() || "profile");
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `${normalizedName}_${Date.now().toString(36)}_${randomSuffix}`;
}

function normalizeConnectionProfile(value: unknown): ConnectionProfileState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
    return null;
  }

  const profile: ConnectionProfileState = {
    ...raw,
    id: typeof raw.id === "string" && raw.id.trim().length > 0
      ? raw.id
      : createConnectionProfileId(raw.name),
    name: raw.name.trim(),
  };
  return profile;
}

function normalizeConnectionProfiles(value: unknown): ConnectionProfileState[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenIds = new Set<string>();
  const profiles: ConnectionProfileState[] = [];
  for (const item of value) {
    const profile = normalizeConnectionProfile(item);
    if (!profile || seenIds.has(profile.id)) {
      continue;
    }
    seenIds.add(profile.id);
    profiles.push(profile);
  }
  return profiles;
}

function readConnectionProfilesFromStorage(): ConnectionProfileState[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CONNECTION_PROFILES_STORAGE_KEY);
    if (!raw || raw.trim().length === 0) {
      return [];
    }

    return normalizeConnectionProfiles(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeConnectionProfilesToStorage(
  profiles: ConnectionProfileState[],
): ConnectionProfileState[] {
  const normalized = normalizeConnectionProfiles(profiles);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      CONNECTION_PROFILES_STORAGE_KEY,
      JSON.stringify(normalized),
    );
  }
  return normalized;
}

function readSelectedProfileIdFromStorage(): string {
  return readStringFromStorage(CONNECTION_PROFILE_SELECTED_KEY).trim();
}

function writeSelectedProfileIdToStorage(profileId: string): string {
  return writeStringToStorage(CONNECTION_PROFILE_SELECTED_KEY, profileId.trim());
}

/* ── AuthorNote 状态管理 ───────────────────────────────────── */

function isAuthorNotePosition(value: unknown): value is AuthorNoteState["position"] {
  return value === "before" || value === "after" || value === "chat";
}

function isAuthorNoteRole(value: unknown): value is AuthorNoteState["role"] {
  return value === "system" || value === "user" || value === "assistant";
}

function normalizeAuthorNoteState(value: unknown): AuthorNoteState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_AUTHOR_NOTE_STATE };
  }

  const raw = value as Record<string, unknown>;
  const text = typeof raw.text === "string" ? raw.text : DEFAULT_AUTHOR_NOTE_STATE.text;
  const depth = Number.isInteger(raw.depth) && Number(raw.depth) >= 0
    ? Number(raw.depth)
    : DEFAULT_AUTHOR_NOTE_STATE.depth;
  const frequency = Number.isInteger(raw.frequency) && Number(raw.frequency) >= 0
    ? Number(raw.frequency)
    : DEFAULT_AUTHOR_NOTE_STATE.frequency;
  const position = isAuthorNotePosition(raw.position)
    ? raw.position
    : DEFAULT_AUTHOR_NOTE_STATE.position;
  const role = isAuthorNoteRole(raw.role)
    ? raw.role
    : DEFAULT_AUTHOR_NOTE_STATE.role;

  return {
    text,
    depth,
    frequency,
    position,
    role,
  };
}

function readAuthorNoteStateFromStorage(): AuthorNoteState {
  if (typeof window === "undefined") {
    return { ...DEFAULT_AUTHOR_NOTE_STATE };
  }

  try {
    const raw = window.localStorage.getItem(AUTHOR_NOTE_STORAGE_KEY);
    if (!raw || raw.trim().length === 0) {
      return { ...DEFAULT_AUTHOR_NOTE_STATE };
    }
    return normalizeAuthorNoteState(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_AUTHOR_NOTE_STATE };
  }
}

function writeAuthorNoteStateToStorage(state: AuthorNoteState): AuthorNoteState {
  const normalized = normalizeAuthorNoteState(state);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(AUTHOR_NOTE_STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

/* ── PersonaLock 状态管理 ──────────────────────────────────── */

function normalizePersonaLockState(value: unknown): Record<PersonaLockType, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_PERSONA_LOCK_STATE };
  }

  const raw = value as Record<string, unknown>;
  return {
    chat: raw.chat === true,
    character: raw.character === true,
    default: raw.default === true,
  };
}

export function readPersonaLockStateFromStorage(): Record<PersonaLockType, boolean> {
  if (typeof window === "undefined") {
    return { ...DEFAULT_PERSONA_LOCK_STATE };
  }

  try {
    const raw = window.localStorage.getItem(PERSONA_LOCK_STORAGE_KEY);
    if (!raw || raw.trim().length === 0) {
      return { ...DEFAULT_PERSONA_LOCK_STATE };
    }
    return normalizePersonaLockState(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PERSONA_LOCK_STATE };
  }
}

export function writePersonaLockStateToStorage(
  state: Record<PersonaLockType, boolean>,
): Record<PersonaLockType, boolean> {
  const normalized = normalizePersonaLockState(state);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PERSONA_LOCK_STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

/* ── 工具函数 & AuthorNote 注入同步 ────────────────────────── */

function normalizeScopeToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getAuthorNoteInjectionId(ctx: ApiCallContext): string {
  const scopeToken = [ctx.dialogueId, ctx.characterId, ctx.iframeId]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("_");
  return `${AUTHOR_NOTE_INJECTION_PREFIX}_${normalizeScopeToken(scopeToken || "global")}`;
}

/* ── 默认回调工厂 ─────────────────────────────────────────── */

export function createStorageDefaults(ctx: ApiCallContext) {
  const getAuthorNoteState = (): AuthorNoteState => readAuthorNoteStateFromStorage();
  const setAuthorNoteState = (patch: Partial<AuthorNoteState>): AuthorNoteState => {
    const current = readAuthorNoteStateFromStorage();
    const next = normalizeAuthorNoteState({ ...current, ...patch });
    const saved = writeAuthorNoteStateToStorage(next);
    syncAuthorNoteInjection(ctx, saved);
    return saved;
  };
  const getPersonaName = (): string => readStringFromStorage(PERSONA_NAME_STORAGE_KEY);
  const setPersonaName = (name: string): string => writeStringToStorage(PERSONA_NAME_STORAGE_KEY, name.trim());
  const listConnectionProfiles = () => readConnectionProfilesFromStorage();
  const getCurrentProfileName = (): string | null => {
    const selectedId = readSelectedProfileIdFromStorage();
    if (!selectedId) return null;
    const profile = readConnectionProfilesFromStorage().find((item) => item.id === selectedId);
    return profile?.name || null;
  };
  const setCurrentProfileName = (
    name: string | null,
    _options?: { await?: boolean; timeout?: number },
  ): string | null => {
    if (name === null) { writeSelectedProfileIdToStorage(""); return null; }
    const target = name.trim();
    const profiles = readConnectionProfilesFromStorage();
    const matched = profiles.find((p) => p.name === target);
    if (!matched) return "";
    writeSelectedProfileIdToStorage(matched.id);
    return matched.name;
  };
  const createConnectionProfile = (name: string) => {
    const nextName = name.trim();
    if (!nextName) throw new Error("/profile-create requires profile name");
    const profiles = readConnectionProfilesFromStorage();
    if (profiles.some((p) => p.name === nextName)) {
      throw new Error(`/profile-create duplicate profile name: ${nextName}`);
    }
    const created = { id: createConnectionProfileId(nextName), name: nextName };
    const nextProfiles = writeConnectionProfilesToStorage([...profiles, created]);
    const selected = nextProfiles.find((p) => p.id === created.id);
    if (!selected) throw new Error("/profile-create failed to persist profile");
    writeSelectedProfileIdToStorage(selected.id);
    return selected;
  };
  const updateConnectionProfile = () => {
    const selectedId = readSelectedProfileIdFromStorage();
    const profiles = readConnectionProfilesFromStorage();
    const selected = profiles.find((p) => p.id === selectedId);
    if (!selected) throw new Error("/profile-update no profile selected");
    return selected;
  };
  const getConnectionProfile = (name?: string) => {
    const profiles = readConnectionProfilesFromStorage();
    if (name && name.trim().length > 0) return profiles.find((p) => p.name === name.trim());
    const selectedId = readSelectedProfileIdFromStorage();
    if (!selectedId) return undefined;
    return profiles.find((p) => p.id === selectedId);
  };
  return {
    getAuthorNoteState,
    setAuthorNoteState,
    getPersonaName,
    setPersonaName,
    listConnectionProfiles,
    getCurrentProfileName,
    setCurrentProfileName,
    createConnectionProfile,
    updateConnectionProfile,
    getConnectionProfile,
  };
}

export function syncAuthorNoteInjection(
  ctx: ApiCallContext,
  state: AuthorNoteState,
): void {
  const injectionId = getAuthorNoteInjectionId(ctx);
  const normalizedText = state.text.trim();

  if (normalizedText.length === 0) {
    const removed = removePromptInjections([injectionId]);
    if (removed > 0 && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("DreamMiniStage:uninjectPrompts", {
          detail: {
            ids: [injectionId],
            removed,
            characterId: ctx.characterId,
            dialogueId: ctx.dialogueId,
            iframeId: ctx.iframeId,
          },
        }),
      );
    }
    return;
  }

  const injection = upsertPromptInjection(
    {
      id: injectionId,
      content: normalizedText,
      role: state.role,
      position: state.position === "chat" ? "in_chat" : state.position,
      depth: state.depth,
      should_scan: false,
    },
    {
      characterId: ctx.characterId,
      dialogueId: ctx.dialogueId,
      iframeId: ctx.iframeId,
    },
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("DreamMiniStage:injectPrompts", {
        detail: {
          prompts: [injection],
          once: false,
          characterId: ctx.characterId,
          dialogueId: ctx.dialogueId,
          iframeId: ctx.iframeId,
        },
      }),
    );
  }
}
