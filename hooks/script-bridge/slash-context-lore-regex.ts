/**
 * @input  hooks/script-bridge/types, lib/data/roleplay/world-book-operation, lib/data/roleplay/regex-*
 * @output createLoreRegexAdapters
 * @pos    Slash 执行上下文适配 - world/lore 与 regex 能力
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import type { ExecutionContext } from "@/lib/slash-command/types";
import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import { RegexPresetOperations } from "@/lib/data/roleplay/regex-preset-operation";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";
import type { WorldBookEntry } from "@/lib/models/world-book-model";
import type { ApiCallContext } from "./types";

const GLOBAL_LOREBOOK_BINDING_KEY = "global_binding";
const PERSONA_LOREBOOK_BINDING_KEY = "persona_binding";
const REGEX_PRESET_STORAGE_KEY = "dreamministage.regex-preset.current";

const LORE_FIELD_ALIAS: Record<string, string> = {
  key: "keys",
  keys: "keys",
  keysecondary: "secondary_keys",
  secondary_keys: "secondary_keys",
  secondarykeys: "secondary_keys",
};

const LORE_NUMBER_FIELDS = new Set([
  "id",
  "entry_id",
  "depth",
  "position",
  "insertion_order",
  "probability",
  "scanDepth",
  "sticky",
  "cooldown",
  "delay",
]);

const LORE_BOOLEAN_FIELDS = new Set([
  "enabled",
  "selective",
  "constant",
  "use_regex",
  "useProbability",
  "matchWholeWords",
  "caseSensitive",
  "preventRecursion",
]);

type LoreRegexContextKeys =
  | "getGlobalLorebooks"
  | "setGlobalLorebooks"
  | "getCharLorebooks"
  | "getChatLorebook"
  | "getPersonaLorebook"
  | "getLoreField"
  | "setLoreField"
  | "listRegexScripts"
  | "getRegexScript"
  | "setRegexScriptEnabled"
  | "getRegexPreset"
  | "setRegexPreset";

type LoreRegexContext = Pick<ExecutionContext, LoreRegexContextKeys>;

function toMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
}

function normalizeLoreFieldName(raw: string): string {
  const normalized = raw.trim();
  if (!normalized) {
    return "content";
  }
  return LORE_FIELD_ALIAS[normalized.toLowerCase()] || normalized;
}

function resolveEntryKeyByUid(
  entries: Record<string, WorldBookEntry>,
  uid: string,
): string | null {
  if (entries[uid]) {
    return uid;
  }

  for (const [entryKey, entry] of Object.entries(entries)) {
    const idCandidates = [entry.id, entry.entry_id].filter((candidate) => candidate !== undefined);
    if (idCandidates.some((candidate) => String(candidate) === uid)) {
      return entryKey;
    }
  }

  return null;
}

function parseLoreFieldValue(field: string, rawValue: string): unknown {
  if (field === "keys" || field === "secondary_keys") {
    return rawValue
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (LORE_BOOLEAN_FIELDS.has(field)) {
    const lowered = rawValue.trim().toLowerCase();
    if (lowered === "true" || lowered === "1" || lowered === "on") return true;
    if (lowered === "false" || lowered === "0" || lowered === "off") return false;
  }

  if (LORE_NUMBER_FIELDS.has(field)) {
    const parsed = Number(rawValue.trim());
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return rawValue;
}

function readRegexPresetSelection(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(REGEX_PRESET_STORAGE_KEY);
    return value ? value : null;
  } catch {
    return null;
  }
}

function writeRegexPresetSelection(name: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(REGEX_PRESET_STORAGE_KEY, name);
  } catch {
    // ignore
  }
}

export function createLoreRegexAdapters(ctx: ApiCallContext): LoreRegexContext {
  const getGlobalLorebooks = async (): Promise<string[]> => {
    const settings = await WorldBookOperations.getWorldBookSettings(GLOBAL_LOREBOOK_BINDING_KEY);
    const metadata = toMetadataRecord(settings.metadata);
    return normalizeStringArray(metadata.selected);
  };

  const setGlobalLorebooks = async (bookNames: string[]): Promise<void> => {
    const settings = await WorldBookOperations.getWorldBookSettings(GLOBAL_LOREBOOK_BINDING_KEY);
    const metadata = toMetadataRecord(settings.metadata);
    const normalized = Array.from(new Set(bookNames.map((item) => item.trim()).filter((item) => item.length > 0)));

    await WorldBookOperations.updateWorldBookSettings(GLOBAL_LOREBOOK_BINDING_KEY, {
      metadata: {
        ...metadata,
        selected: normalized,
      },
    });
  };

  const getCharLorebooks = async (target?: string): Promise<{ primary: string | null; additional: string[] }> => {
    const key = target && target !== "current"
      ? target
      : ctx.characterId;
    if (!key) {
      return { primary: null, additional: [] };
    }

    const settings = await WorldBookOperations.getWorldBookSettings(key);
    const metadata = toMetadataRecord(settings.metadata);
    const bindings = toMetadataRecord(metadata.bindings);
    const characterBindings = toMetadataRecord(bindings.character);

    return {
      primary: typeof characterBindings.primary === "string"
        ? characterBindings.primary
        : null,
      additional: normalizeStringArray(characterBindings.additional),
    };
  };

  const getChatLorebook = async (): Promise<string | null> => {
    const key = ctx.dialogueId || ctx.chatId || ctx.characterId;
    if (!key) {
      return null;
    }

    const settings = await WorldBookOperations.getWorldBookSettings(key);
    const metadata = toMetadataRecord(settings.metadata);
    const bindings = toMetadataRecord(metadata.bindings);
    return typeof bindings.chat === "string" ? bindings.chat : null;
  };

  const getPersonaLorebook = async (): Promise<string | null> => {
    const settings = await WorldBookOperations.getWorldBookSettings(PERSONA_LOREBOOK_BINDING_KEY);
    const metadata = toMetadataRecord(settings.metadata);
    return typeof metadata.current === "string" ? metadata.current : null;
  };

  const getLoreField = async (file: string, uid: string, field: string): Promise<unknown> => {
    const worldbook = await WorldBookOperations.getWorldBook(file);
    if (!worldbook) {
      throw new Error(`Lorebook not found: ${file}`);
    }

    const entryKey = resolveEntryKeyByUid(worldbook, uid);
    if (!entryKey) {
      throw new Error(`Lorebook entry not found: ${uid}`);
    }

    const entry = worldbook[entryKey];
    const normalizedField = normalizeLoreFieldName(field);
    return (entry as unknown as Record<string, unknown>)[normalizedField];
  };

  const setLoreField = async (
    file: string,
    uid: string,
    field: string,
    value: string,
  ): Promise<void> => {
    const worldbook = await WorldBookOperations.getWorldBook(file);
    if (!worldbook) {
      throw new Error(`Lorebook not found: ${file}`);
    }

    const entryKey = resolveEntryKeyByUid(worldbook, uid);
    if (!entryKey) {
      throw new Error(`Lorebook entry not found: ${uid}`);
    }

    const normalizedField = normalizeLoreFieldName(field);
    const nextEntry = { ...(worldbook[entryKey] as unknown as Record<string, unknown>) };
    nextEntry[normalizedField] = parseLoreFieldValue(normalizedField, value);
    worldbook[entryKey] = nextEntry as unknown as WorldBookEntry;
    await WorldBookOperations.updateWorldBook(file, worldbook);
  };

  const listRegexScripts = async () => {
    if (!ctx.characterId) {
      return [];
    }

    const scripts = await RegexScriptOperations.getRegexScripts(ctx.characterId);
    if (!scripts) {
      return [];
    }

    return Object.values(scripts).map((script) => ({
      name: script.scriptName || script.scriptKey,
      enabled: script.disabled !== true,
      pattern: script.findRegex,
      replacement: script.replaceString || undefined,
    }));
  };

  const getRegexScript = async (name: string) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized || !ctx.characterId) {
      return undefined;
    }

    const scripts = await RegexScriptOperations.getRegexScripts(ctx.characterId);
    if (!scripts) {
      return undefined;
    }

    for (const script of Object.values(scripts)) {
      const candidateName = (script.scriptName || script.scriptKey || "").trim().toLowerCase();
      if (candidateName === normalized) {
        return {
          name: script.scriptName || script.scriptKey,
          enabled: script.disabled !== true,
          pattern: script.findRegex,
          replacement: script.replaceString || undefined,
        };
      }
    }

    return undefined;
  };

  const setRegexScriptEnabled = async (name: string, enabled: boolean) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized || !ctx.characterId) {
      throw new Error("regex owner is not available");
    }

    const scripts = await RegexScriptOperations.getRegexScripts(ctx.characterId);
    if (!scripts) {
      throw new Error(`Regex script not found: ${name}`);
    }

    for (const [scriptId, script] of Object.entries(scripts)) {
      const candidateName = (script.scriptName || script.scriptKey || "").trim().toLowerCase();
      if (candidateName !== normalized) {
        continue;
      }

      const updated = await RegexScriptOperations.updateRegexScript(ctx.characterId, scriptId, {
        disabled: !enabled,
      });
      if (!updated) {
        throw new Error(`Failed to update regex script: ${name}`);
      }
      return;
    }

    throw new Error(`Regex script not found: ${name}`);
  };

  const getRegexPreset = async (): Promise<string | null> => {
    return readRegexPresetSelection();
  };

  const setRegexPreset = async (nameOrId: string): Promise<string | null> => {
    if (!ctx.characterId) {
      throw new Error("regex owner is not available");
    }

    const target = nameOrId.trim().toLowerCase();
    const presets = await RegexPresetOperations.listPresets();
    const matched = presets.find((preset) => preset.name.trim().toLowerCase() === target);
    if (!matched) {
      return null;
    }

    await RegexPresetOperations.applyPreset(matched.name, ctx.characterId);
    writeRegexPresetSelection(matched.name);
    return matched.name;
  };

  return {
    getGlobalLorebooks,
    setGlobalLorebooks,
    getCharLorebooks,
    getChatLorebook,
    getPersonaLorebook,
    getLoreField,
    setLoreField,
    listRegexScripts,
    getRegexScript,
    setRegexScriptEnabled,
    getRegexPreset,
    setRegexPreset,
  };
}
