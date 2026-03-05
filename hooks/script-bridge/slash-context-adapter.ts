/**
 * @input  hooks/script-bridge/types, lib/slash-command/executor, lib/audio/store, lib/data/roleplay/*, lib/slash-command/prompt-injection-store
 * @output adaptSlashExecutionContext
 * @pos    Slash 执行上下文适配器
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import type { ApiCallContext } from "./types";
import type {
  ExecutionContext,
  SendOptions,
  WorldBookEntryData,
  PresetInfo,
  AudioChannelType,
  AudioChannelSnapshot,
  CharacterSummary,
} from "@/lib/slash-command/types";
import { executeSlashCommandScript } from "@/lib/slash-command/executor";
import { getAudioManager } from "@/lib/audio/store";
import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import { PresetOperations } from "@/lib/data/roleplay/preset-operation";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import {
  isVectorMemoryEnabled,
  setVectorMemoryEnabled,
} from "@/lib/vector-memory/manager";
import {
  upsertPromptInjection,
  listPromptInjections,
  removePromptInjections,
} from "@/lib/slash-command/prompt-injection-store";
import type { WorldBookEntry } from "@/lib/models/world-book-model";
import { createLoreRegexAdapters } from "./slash-context-lore-regex";

interface HostPluginRegistryEntry {
  manifest?: {
    id?: string;
    name?: string;
  };
  enabled?: boolean;
}

interface HostPluginOperationResult {
  success?: boolean;
  error?: string;
  message?: string;
}

interface HostPluginRegistry {
  initialize?: () => Promise<void> | void;
  getPlugins?: () => unknown[];
  enablePlugin?: (pluginId: string) => Promise<HostPluginOperationResult> | HostPluginOperationResult;
  disablePlugin?: (pluginId: string) => Promise<HostPluginOperationResult> | HostPluginOperationResult;
}

function normalizeExtensionToken(value: string): string {
  return value.trim().toLowerCase();
}

function resolveHostPluginRegistry(): HostPluginRegistry | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const registry = (window as Window & { pluginRegistry?: unknown }).pluginRegistry;
  if (!registry || typeof registry !== "object") {
    return undefined;
  }
  return registry as HostPluginRegistry;
}

function readPluginEntries(registry: HostPluginRegistry): HostPluginRegistryEntry[] {
  const entries = registry.getPlugins?.();
  if (!Array.isArray(entries)) {
    throw new Error("plugin registry getPlugins is not available");
  }
  return entries as HostPluginRegistryEntry[];
}

function findPluginEntry(
  entries: HostPluginRegistryEntry[],
  extensionName: string,
): HostPluginRegistryEntry | undefined {
  const target = normalizeExtensionToken(extensionName);
  return entries.find((entry) => {
    const id = typeof entry.manifest?.id === "string"
      ? normalizeExtensionToken(entry.manifest.id)
      : "";
    const name = typeof entry.manifest?.name === "string"
      ? normalizeExtensionToken(entry.manifest.name)
      : "";
    return id === target || name === target;
  });
}

function resolvePluginId(entry: HostPluginRegistryEntry, extensionName: string): string {
  const manifestId = typeof entry.manifest?.id === "string" ? entry.manifest.id.trim() : "";
  if (manifestId.length > 0) {
    return manifestId;
  }
  return extensionName.trim();
}

function isCssColorValue(value: string): boolean {
  if (typeof document === "undefined") {
    return value.trim().length > 0;
  }

  const probe = document.createElement("span");
  probe.style.color = "";
  probe.style.color = value;
  return probe.style.color.length > 0;
}

function applyChatDisplayMode(mode: "default" | "bubble" | "document"): void {
  if (typeof document === "undefined") {
    throw new Error("chat display mode is not available in current context");
  }

  const body = document.body;
  if (!body) {
    throw new Error("chat display mode host body is not available");
  }

  body.classList.remove("bubblechat", "documentstyle");
  if (mode === "bubble") {
    body.classList.add("bubblechat");
    return;
  }
  if (mode === "document") {
    body.classList.add("documentstyle");
  }
}

function resolveAutoBackgroundColor(): string {
  if (typeof document === "undefined") {
    throw new Error("bgcol is not available in current context");
  }

  const rootStyle = getComputedStyle(document.documentElement);
  const bodyStyle = getComputedStyle(document.body);
  const candidates = [
    rootStyle.getPropertyValue("--SmartThemeBlurTintColor"),
    bodyStyle.backgroundColor,
    rootStyle.backgroundColor,
  ];

  for (const candidate of candidates) {
    const normalized = candidate.trim();
    if (normalized.length > 0 && normalized !== "rgba(0, 0, 0, 0)" && normalized !== "transparent") {
      return normalized;
    }
  }

  return "rgb(0, 0, 0)";
}

async function defaultShowButtonsPopup(
  text: string,
  labels: string[],
  options?: { multiple?: boolean },
): Promise<string | string[]> {
  if (typeof window === "undefined" || typeof window.prompt !== "function") {
    throw new Error("/buttons host popup is not available in current context");
  }

  const promptBody = labels
    .map((label, index) => `${index + 1}. ${label}`)
    .join("\n");
  const promptTitle = (text || "Select option").trim();

  if (options?.multiple) {
    const raw = window.prompt(
      `${promptTitle}\n${promptBody}\nInput comma-separated numbers:`,
      "",
    );
    if (!raw || raw.trim().length === 0) {
      return [];
    }

    const selected = Array.from(new Set(
      raw
        .split(",")
        .map((chunk) => Number.parseInt(chunk.trim(), 10))
        .filter((index) => Number.isInteger(index) && index > 0 && index <= labels.length),
    ));
    return selected.map((index) => labels[index - 1]);
  }

  const raw = window.prompt(
    `${promptTitle}\n${promptBody}\nInput number:`,
    "",
  );
  if (!raw || raw.trim().length === 0) {
    return "";
  }

  const index = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(index) || index <= 0 || index > labels.length) {
    return "";
  }
  return labels[index - 1];
}

async function defaultCloseCurrentChat(): Promise<void> {
  if (typeof document === "undefined") {
    throw new Error("/closechat is not available in current context");
  }

  const closeButton = document.querySelector<HTMLElement>("#option_close_chat");
  if (!closeButton) {
    throw new Error("/closechat host close button is not available");
  }

  closeButton.click();
}

export function adaptSlashExecutionContext(ctx: ApiCallContext): ExecutionContext {
  const snapshot = ctx.getVariablesSnapshot();
  const globalVariables: Record<string, unknown> = { ...snapshot.global };
  const characterVariables: Record<string, unknown> = ctx.characterId && snapshot.character[ctx.characterId]
    ? { ...snapshot.character[ctx.characterId] }
    : {};

  const hasCharacterVariable = (key: string): boolean =>
    Object.prototype.hasOwnProperty.call(characterVariables, key);

  const getLocalVariable = (key: string): unknown => {
    if (hasCharacterVariable(key)) {
      return characterVariables[key];
    }
    return globalVariables[key];
  };

  const setLocalVariable = (key: string, value: unknown): void => {
    if (ctx.characterId) {
      characterVariables[key] = value;
      ctx.setScriptVariable(key, value, "character", ctx.characterId);
      return;
    }

    globalVariables[key] = value;
    ctx.setScriptVariable(key, value, "global");
  };

  const deleteLocalVariable = (key: string): void => {
    if (ctx.characterId) {
      delete characterVariables[key];
      ctx.deleteScriptVariable(key, "character", ctx.characterId);
      return;
    }

    delete globalVariables[key];
    ctx.deleteScriptVariable(key, "global");
  };

  const setGlobalVariable = (key: string, value: unknown): void => {
    globalVariables[key] = value;
    ctx.setScriptVariable(key, value, "global");
  };

  const deleteGlobalVariable = (key: string): void => {
    delete globalVariables[key];
    ctx.deleteScriptVariable(key, "global");
  };

  const listLocalVariables = (): string[] => {
    const keys = new Set<string>(Object.keys(globalVariables));
    for (const key of Object.keys(characterVariables)) {
      keys.add(key);
    }
    return Array.from(keys);
  };

  const dumpLocalVariables = (): Record<string, unknown> => ({
    ...globalVariables,
    ...characterVariables,
  });

  const onSend = ctx.onSend ?? (async (_text?: string, _options?: SendOptions) => {
    console.warn("[adaptContext] onSend 未提供");
  });
  const onTrigger = ctx.onTrigger ?? (async (_member?: string) => {
    console.warn("[adaptContext] onTrigger 未提供");
  });
  const onSendAs = ctx.onSendAs;
  const onSendSystem = ctx.onSendSystem;
  const onImpersonate = ctx.onImpersonate;
  const onContinue = ctx.onContinue;
  const onSwipe = ctx.onSwipe;
  const onCloseChat = ctx.onCloseChat ?? (typeof document !== "undefined" ? defaultCloseCurrentChat : undefined);
  const onGetChatName = ctx.onGetChatName;
  const onSetInput = ctx.onSetInput;
  const onGenerateImage = ctx.onGenerateImage;
  const onGetImageGenerationConfig = ctx.onGetImageGenerationConfig;
  const onSetImageGenerationConfig = ctx.onSetImageGenerationConfig;
  const onGetInstructMode = ctx.onGetInstructMode;
  const onSetInstructMode = ctx.onSetInstructMode;
  const onGetGroupMember = ctx.onGetGroupMember;
  const onGetGroupMemberCount = ctx.onGetGroupMemberCount;
  const onAddGroupMember = ctx.onAddGroupMember;
  const onSetGroupMemberEnabled = ctx.onSetGroupMemberEnabled;
  const onAddSwipe = ctx.onAddSwipe;
  const onAskCharacter = ctx.onAskCharacter;
  const onSetPersonaLock = ctx.onSetPersonaLock;
  const onReloadPage = ctx.onReloadPage;
  const onGetClipboardText = ctx.onGetClipboardText;
  const onSetClipboardText = ctx.onSetClipboardText;
  const onOpenDataBank = ctx.onOpenDataBank;
  const onListDataBankEntries = ctx.onListDataBankEntries;
  const onGetDataBankText = ctx.onGetDataBankText;
  const onAddDataBankText = ctx.onAddDataBankText;
  const onUpdateDataBankText = ctx.onUpdateDataBankText;
  const onDeleteDataBankEntry = ctx.onDeleteDataBankEntry;
  const onSetDataBankEntryEnabled = ctx.onSetDataBankEntryEnabled;
  const onIngestDataBank = ctx.onIngestDataBank;
  const onPurgeDataBank = ctx.onPurgeDataBank;
  const onSearchDataBank = ctx.onSearchDataBank;
  const hostPluginRegistry = resolveHostPluginRegistry();
  const defaultIsExtensionInstalled = hostPluginRegistry
    ? async (extensionName: string): Promise<boolean> => {
      await Promise.resolve(hostPluginRegistry.initialize?.());
      const entries = readPluginEntries(hostPluginRegistry);
      return !!findPluginEntry(entries, extensionName);
    }
    : undefined;
  const defaultGetExtensionEnabledState = hostPluginRegistry
    ? async (extensionName: string): Promise<boolean> => {
      await Promise.resolve(hostPluginRegistry.initialize?.());
      const entries = readPluginEntries(hostPluginRegistry);
      const entry = findPluginEntry(entries, extensionName);
      if (!entry) {
        throw new Error(`/extension-state extension not installed: ${extensionName}`);
      }
      if (typeof entry.enabled !== "boolean") {
        throw new Error(`/extension-state host returned non-boolean enabled state: ${extensionName}`);
      }
      return entry.enabled;
    }
    : undefined;
  const defaultSetExtensionEnabled = hostPluginRegistry
    ? async (extensionName: string, enabled: boolean): Promise<string> => {
      await Promise.resolve(hostPluginRegistry.initialize?.());
      const entries = readPluginEntries(hostPluginRegistry);
      const entry = findPluginEntry(entries, extensionName);
      if (!entry) {
        throw new Error(`/extension-toggle extension not installed: ${extensionName}`);
      }

      const pluginId = resolvePluginId(entry, extensionName);
      const action = enabled ? hostPluginRegistry.enablePlugin : hostPluginRegistry.disablePlugin;
      if (!action) {
        throw new Error("/extension-toggle host callback is not available in current context");
      }

      const result = await Promise.resolve(action.call(hostPluginRegistry, pluginId));
      if (result && result.success === false) {
        throw new Error(result.error || result.message || `/extension-toggle failed for ${pluginId}`);
      }

      return pluginId;
    }
    : undefined;
  const defaultSetAverageBackgroundColor = typeof document !== "undefined"
    ? async (color?: string): Promise<string> => {
      const nextColor = (color || resolveAutoBackgroundColor()).trim();
      if (!nextColor) {
        throw new Error("/bgcol could not resolve target color");
      }
      if (!isCssColorValue(nextColor)) {
        throw new Error(`/bgcol invalid color value: ${color}`);
      }
      document.documentElement.style.setProperty("--SmartThemeBlurTintColor", nextColor);
      return nextColor;
    }
    : undefined;
  const defaultSetChatDisplayMode = typeof document !== "undefined"
    ? async (mode: "default" | "bubble" | "document"): Promise<void> => {
      applyChatDisplayMode(mode);
    }
    : undefined;
  const defaultButtonsPopupCallback = typeof window !== "undefined"
    ? defaultShowButtonsPopup
    : undefined;
  const onIsExtensionInstalled = ctx.onIsExtensionInstalled ?? defaultIsExtensionInstalled;
  const onGetExtensionEnabledState = ctx.onGetExtensionEnabledState ?? defaultGetExtensionEnabledState;
  const onSetExtensionEnabled = ctx.onSetExtensionEnabled ?? defaultSetExtensionEnabled;
  const onTogglePanels = ctx.onTogglePanels;
  const onResetPanels = ctx.onResetPanels;
  const onToggleVisualNovelMode = ctx.onToggleVisualNovelMode;
  const onSetBackground = ctx.onSetBackground;
  const onLockBackground = ctx.onLockBackground;
  const onUnlockBackground = ctx.onUnlockBackground;
  const onAutoBackground = ctx.onAutoBackground;
  const onSetTheme = ctx.onSetTheme;
  const onSetMovingUiPreset = ctx.onSetMovingUiPreset;
  const onSetCssVariable = ctx.onSetCssVariable;
  const onSetAverageBackgroundColor = ctx.onSetAverageBackgroundColor ?? defaultSetAverageBackgroundColor;
  const onSetChatDisplayMode = ctx.onSetChatDisplayMode ?? defaultSetChatDisplayMode;
  const onShowButtonsPopup = ctx.onShowButtonsPopup ?? defaultButtonsPopupCallback;
  const onGenerateCaption = ctx.onGenerateCaption;
  const onPlayNotificationSound = ctx.onPlayNotificationSound;
  const onSetExpression = ctx.onSetExpression;
  const onSetExpressionFolderOverride = ctx.onSetExpressionFolderOverride;
  const onGetLastExpression = ctx.onGetLastExpression;
  const onListExpressions = ctx.onListExpressions;
  const onClassifyExpression = ctx.onClassifyExpression;
  const onJumpToMessage = ctx.onJumpToMessage;
  const onRenderChatMessages = ctx.onRenderChatMessages;
  const onSelectContextPreset = ctx.onSelectContextPreset;
  const onSwitchCharacter = ctx.onSwitchCharacter;
  const onRemovePromptInjections = ctx.onRemovePromptInjections;

  const getWorldBookEntry = async (id: string): Promise<WorldBookEntryData | undefined> => {
    if (!ctx.characterId) return undefined;
    const wb = await WorldBookOperations.getWorldBook(ctx.characterId);
    if (!wb) return undefined;
    const entry = Object.values(wb).find(
      (e: WorldBookEntry) => String(e.id) === id || String(e.entry_id) === id,
    );
    if (!entry) return undefined;
    return {
      id: String(entry.id || entry.entry_id || ""),
      keys: entry.keys || [],
      content: entry.content || "",
      enabled: entry.enabled !== false,
      comment: entry.comment,
      priority: (entry as WorldBookEntry & { priority?: number }).priority,
      depth: (entry as WorldBookEntry & { depth?: number }).depth,
    };
  };

  const searchWorldBook = async (query: string): Promise<WorldBookEntryData[]> => {
    if (!ctx.characterId || !query) return [];
    const wb = await WorldBookOperations.getWorldBook(ctx.characterId);
    if (!wb) return [];
    const lowerQuery = query.toLowerCase();
    return Object.values(wb)
      .filter((e: WorldBookEntry) =>
        e.keys?.some((k: string) => k.toLowerCase().includes(lowerQuery)) ||
        e.content?.toLowerCase().includes(lowerQuery),
      )
      .map((e: WorldBookEntry) => ({
        id: String(e.id || e.entry_id || ""),
        keys: e.keys || [],
        content: e.content || "",
        enabled: e.enabled !== false,
        comment: e.comment,
      }));
  };

  const listWorldBookEntries = async (_bookName?: string): Promise<WorldBookEntryData[]> => {
    const targetName = _bookName || ctx.characterId;
    if (!targetName) return [];
    const wb = await WorldBookOperations.getWorldBook(targetName);
    if (!wb) return [];
    return Object.values(wb).map((e: WorldBookEntry) => ({
      id: String(e.id || e.entry_id || ""),
      keys: e.keys || [],
      content: e.content || "",
      enabled: e.enabled !== false,
      comment: e.comment,
    }));
  };

  const createWorldBookEntry = async (
    data: Partial<WorldBookEntryData>,
    bookName?: string,
  ): Promise<WorldBookEntryData | undefined> => {
    const targetBook = (bookName || ctx.characterId || "").trim();
    if (!targetBook) {
      throw new Error("/createlore requires file=<book>");
    }

    const worldBook = await WorldBookOperations.getWorldBook(targetBook) || {};
    const nextUid = Object.values(worldBook).reduce((maxUid, entry) => {
      const ids = [entry.id, entry.entry_id]
        .map((candidate) => Number.parseInt(String(candidate), 10))
        .filter((candidate) => Number.isInteger(candidate) && candidate >= 0);
      if (ids.length === 0) {
        return maxUid;
      }
      return Math.max(maxUid, ...ids);
    }, 0) + 1;

    const keys = Array.isArray(data.keys)
      ? data.keys.map((item) => String(item).trim()).filter((item) => item.length > 0)
      : [];
    const content = typeof data.content === "string" ? data.content : "";
    const comment = typeof data.comment === "string" ? data.comment : undefined;
    const enabled = data.enabled !== false;

    const entry: WorldBookEntry = {
      id: nextUid,
      entry_id: String(nextUid),
      keys,
      content,
      comment,
      enabled,
      selective: false,
      constant: false,
      position: 4,
    };

    const nextEntryIndex = Object.keys(worldBook).reduce((maxIndex, entryKey) => {
      const matched = /^entry_(\d+)$/.exec(entryKey);
      if (!matched) {
        return maxIndex;
      }
      const parsed = Number.parseInt(matched[1], 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        return maxIndex;
      }
      return Math.max(maxIndex, parsed);
    }, -1) + 1;

    worldBook[`entry_${nextEntryIndex}`] = entry;
    const saved = await WorldBookOperations.updateWorldBook(targetBook, worldBook);
    if (!saved) {
      throw new Error(`/createlore failed to persist entry in file=${targetBook}`);
    }

    return {
      id: String(nextUid),
      keys,
      content,
      comment,
      enabled,
    };
  };

  const getVectorWorldInfoState = (): boolean => isVectorMemoryEnabled();

  const setVectorWorldInfoState = (enabled: boolean): boolean => {
    setVectorMemoryEnabled(enabled);
    return isVectorMemoryEnabled();
  };

  const getPreset = async (): Promise<PresetInfo | undefined> => {
    const presets = await PresetOperations.getAllPresets();
    const active = presets.find((p) => p.enabled !== false);
    return active ? { name: active.name, type: "openai" } : undefined;
  };

  const setPreset = async (name: string): Promise<void> => {
    const presets = await PresetOperations.getAllPresets();
    const target = presets.find((p) => p.name === name);
    if (!target?.id) return;
    for (const p of presets) {
      if (p.id && p.id !== target.id && p.enabled !== false) {
        await PresetOperations.updatePreset(p.id, { enabled: false });
      }
    }
    await PresetOperations.updatePreset(target.id, { enabled: true });
  };

  const listPresets = async (): Promise<PresetInfo[]> => {
    const presets = await PresetOperations.getAllPresets();
    return presets.map((p) => ({ name: p.name, type: "openai" as const }));
  };

  const getActivePreset = async () => {
    const presets = await PresetOperations.getAllPresets();
    return presets.find((preset) => preset.enabled !== false && typeof preset.id === "string");
  };

  const listPromptEntries = async () => {
    const activePreset = await getActivePreset();
    if (!activePreset) {
      return [];
    }

    return (activePreset.prompts || [])
      .map((prompt) => {
        const identifier = (prompt.identifier || "").trim();
        if (!identifier) {
          return null;
        }

        const normalizedName = (prompt.name || identifier).trim();
        return {
          identifier,
          name: normalizedName || identifier,
          enabled: prompt.enabled !== false,
        };
      })
      .filter((entry): entry is { identifier: string; name: string; enabled: boolean } => !!entry);
  };

  const setPromptEntriesEnabled = async (
    updates: Array<{ identifier: string; enabled: boolean }>,
  ): Promise<void> => {
    if (updates.length === 0) {
      return;
    }

    const activePreset = await getActivePreset();
    if (!activePreset?.id) {
      throw new Error("active preset is not available");
    }

    const enabledMap = new Map(
      updates.map((item) => [item.identifier, item.enabled] as const),
    );
    const nextPrompts = (activePreset.prompts || []).map((prompt) => {
      const identifier = (prompt.identifier || "").trim();
      if (!identifier || !enabledMap.has(identifier)) {
        return prompt;
      }
      return {
        ...prompt,
        enabled: enabledMap.get(identifier),
      };
    });

    const saved = await PresetOperations.updatePreset(activePreset.id, {
      prompts: nextPrompts,
    });
    if (!saved) {
      throw new Error("failed to update prompt entries");
    }
  };

  const playAudio = (url: string, audioOptions?: { volume?: number; loop?: boolean }) => {
    const audioManager = getAudioManager();
    audioManager.playAudio("bgm", { url, title: url, ...audioOptions });
  };

  const stopAudio = () => {
    getAudioManager().stopAudio("bgm");
  };

  const pauseAudio = () => {
    getAudioManager().pauseAudio("bgm");
  };

  const resumeAudio = () => {
    const channel = getAudioManager().getChannel("bgm");
    channel.play();
  };

  const setAudioVolume = (volume: number) => {
    getAudioManager().setGlobalVolume(volume);
  };

  const playAudioByType = (type: AudioChannelType, track?: { url: string; title?: string }) => {
    getAudioManager().playAudio(type, track);
  };

  const pauseAudioByType = (type: AudioChannelType) => {
    getAudioManager().pauseAudio(type);
  };

  const stopAudioByType = (type: AudioChannelType) => {
    getAudioManager().stopAudio(type);
  };

  const setAudioEnabledByType = (type: AudioChannelType, enabled: boolean) => {
    getAudioManager().getChannel(type).setEnabled(enabled);
  };

  const setAudioModeByType = (type: AudioChannelType, mode: AudioChannelSnapshot["mode"]) => {
    getAudioManager().getChannel(type).setMode(mode);
  };

  const getAudioListByType = (type: AudioChannelType) => {
    return getAudioManager().getAudioList(type);
  };

  const appendAudioListByType = (type: AudioChannelType, list: Array<{ url: string; title?: string }>) => {
    getAudioManager().appendAudioList(type, list);
  };

  const replaceAudioListByType = (type: AudioChannelType, list: Array<{ url: string; title?: string }>) => {
    getAudioManager().replaceAudioList(type, list);
  };

  const getAudioStateByType = (type: AudioChannelType): AudioChannelSnapshot => {
    const channelState = getAudioManager().getChannel(type).getState();
    return {
      enabled: channelState.enabled,
      mode: channelState.mode,
      currentUrl: channelState.currentUrl,
      playlist: channelState.playlist.map((track) => ({ url: track.url, title: track.title })),
      isPlaying: channelState.isPlaying,
    };
  };

  const toCharacterSummary = (
    record: {
      id: string;
      data?: { name?: string };
    },
  ): CharacterSummary => ({
    id: record.id,
    name: record.data?.name?.trim() || record.id,
  });

  const getCurrentCharacter = async (): Promise<CharacterSummary | undefined> => {
    if (!ctx.characterId) return undefined;
    const record = await LocalCharacterRecordOperations.getCharacterById(ctx.characterId);
    if (!record) return undefined;
    return toCharacterSummary(record);
  };

  const listCharacters = async (): Promise<CharacterSummary[]> => {
    const records = await LocalCharacterRecordOperations.getAllCharacters();
    return records.map(toCharacterSummary);
  };

  const getMessageReasoning = async (index: number): Promise<string | undefined> => {
    const message = ctx.messages[index];
    if (!message) {
      throw new Error(`/get-reasoning message index out of range: ${index}`);
    }
    return message.thinkingContent || "";
  };

  const setMessageReasoning = async (index: number, reasoning: string): Promise<void> => {
    const message = ctx.messages[index];
    if (!message) {
      throw new Error(`/set-reasoning message index out of range: ${index}`);
    }
    message.thinkingContent = reasoning;
  };

  const injectPrompt = async (prompt: string, options?: {
    position?: "before" | "after" | "chat" | "in_chat" | "none";
    depth?: number;
    role?: "system" | "user" | "assistant";
    ephemeral?: boolean;
  }): Promise<void> => {
    const injection = upsertPromptInjection(
      {
        content: prompt,
        role: options?.role,
        position: options?.position || "in_chat",
        depth: options?.depth,
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
            once: options?.ephemeral === true,
            characterId: ctx.characterId,
            dialogueId: ctx.dialogueId,
            iframeId: ctx.iframeId,
          },
        }),
      );
    }
  };

  const listInjectedPrompts = async () => {
    return listPromptInjections({
      characterId: ctx.characterId,
      dialogueId: ctx.dialogueId,
      iframeId: ctx.iframeId,
    });
  };

  const removeInjectedPrompts = async (id?: string): Promise<number> => {
    if (onRemovePromptInjections) {
      const removed = await Promise.resolve(onRemovePromptInjections(id));
      if (!Number.isInteger(removed) || removed < 0) {
        throw new Error("removePromptInjections host callback must return non-negative integer");
      }
      return removed;
    }

    const scopedInjections = listPromptInjections({
      characterId: ctx.characterId,
      dialogueId: ctx.dialogueId,
      iframeId: ctx.iframeId,
    });
    const targetIds = id
      ? scopedInjections.filter((item) => item.id === id).map((item) => item.id)
      : scopedInjections.map((item) => item.id);
    if (targetIds.length === 0) {
      return 0;
    }

    const removed = removePromptInjections(targetIds);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("DreamMiniStage:uninjectPrompts", {
          detail: {
            ids: targetIds,
            removed,
            characterId: ctx.characterId,
            dialogueId: ctx.dialogueId,
            iframeId: ctx.iframeId,
          },
        }),
      );
    }
    return removed;
  };

  const loreRegexAdapters = createLoreRegexAdapters(ctx);

  const executionContext: ExecutionContext = {
    characterId: ctx.characterId,
    messages: ctx.messages,
    onSend,
    onTrigger,
    onSendAs,
    onSendSystem,
    onImpersonate,
    onContinue,
    onSwipe,
    closeCurrentChat: onCloseChat,
    getCurrentChatName: onGetChatName,
    setInputText: onSetInput,
    generateImage: onGenerateImage,
    getImageGenerationConfig: onGetImageGenerationConfig,
    setImageGenerationConfig: onSetImageGenerationConfig,
    getInstructMode: onGetInstructMode,
    setInstructMode: onSetInstructMode,
    getGroupMember: onGetGroupMember,
    getGroupMemberCount: onGetGroupMemberCount,
    addGroupMember: onAddGroupMember,
    setGroupMemberEnabled: onSetGroupMemberEnabled,
    addSwipe: onAddSwipe,
    askCharacter: onAskCharacter,
    setPersonaLock: onSetPersonaLock,
    reloadPage: onReloadPage,
    getClipboardText: onGetClipboardText,
    setClipboardText: onSetClipboardText,
    openDataBank: onOpenDataBank,
    listDataBankEntries: onListDataBankEntries,
    getDataBankText: onGetDataBankText,
    addDataBankText: onAddDataBankText,
    updateDataBankText: onUpdateDataBankText,
    deleteDataBankEntry: onDeleteDataBankEntry,
    setDataBankEntryEnabled: onSetDataBankEntryEnabled,
    ingestDataBank: onIngestDataBank,
    purgeDataBank: onPurgeDataBank,
    searchDataBank: onSearchDataBank,
    isExtensionInstalled: onIsExtensionInstalled,
    getExtensionEnabledState: onGetExtensionEnabledState,
    setExtensionEnabled: onSetExtensionEnabled,
    togglePanels: onTogglePanels,
    resetPanels: onResetPanels,
    toggleVisualNovelMode: onToggleVisualNovelMode,
    setBackground: onSetBackground,
    lockBackground: onLockBackground,
    unlockBackground: onUnlockBackground,
    autoBackground: onAutoBackground,
    setTheme: onSetTheme,
    setMovingUiPreset: onSetMovingUiPreset,
    setCssVariable: onSetCssVariable,
    setAverageBackgroundColor: onSetAverageBackgroundColor,
    setChatDisplayMode: onSetChatDisplayMode,
    showButtonsPopup: onShowButtonsPopup,
    generateCaption: onGenerateCaption,
    playNotificationSound: onPlayNotificationSound,
    setExpression: onSetExpression,
    setExpressionFolderOverride: onSetExpressionFolderOverride,
    getLastExpression: onGetLastExpression,
    listExpressions: onListExpressions,
    classifyExpression: onClassifyExpression,
    jumpToMessage: onJumpToMessage,
    renderChatMessages: onRenderChatMessages,
    selectContextPreset: onSelectContextPreset,
    switchCharacter: onSwitchCharacter,
    getVectorWorldInfoState,
    setVectorWorldInfoState,
    getVariable: getLocalVariable,
    setVariable: setLocalVariable,
    deleteVariable: deleteLocalVariable,
    listVariables: listLocalVariables,
    dumpVariables: dumpLocalVariables,
    getScopedVariable: (scope, key) => scope === "global" ? globalVariables[key] : getLocalVariable(key),
    setScopedVariable: (scope, key, value) => {
      if (scope === "global") {
        setGlobalVariable(key, value);
        return;
      }
      setLocalVariable(key, value);
    },
    deleteScopedVariable: (scope, key) => {
      if (scope === "global") {
        deleteGlobalVariable(key);
        return;
      }
      deleteLocalVariable(key);
    },
    listScopedVariables: (scope) => scope === "global"
      ? Object.keys(globalVariables)
      : listLocalVariables(),
    dumpScopedVariables: (scope) => scope === "global"
      ? { ...globalVariables }
      : dumpLocalVariables(),
    getWorldBookEntry,
    searchWorldBook,
    listWorldBookEntries,
    createWorldBookEntry,
    getPreset,
    setPreset,
    listPresets,
    listPromptEntries,
    setPromptEntriesEnabled,
    setMessageRole: async (index, role) => {
      const message = ctx.messages[index];
      if (!message) {
        throw new Error(`/message-role message index out of range: ${index}`);
      }
      message.role = role;
    },
    setMessageName: async (index, name) => {
      const message = ctx.messages[index];
      if (!message) {
        throw new Error(`/message-name message index out of range: ${index}`);
      }
      message.name = name;
    },
    getMessageReasoning,
    setMessageReasoning,
    injectPrompt,
    listPromptInjections: listInjectedPrompts,
    removePromptInjections: removeInjectedPrompts,
    playAudio,
    stopAudio,
    pauseAudio,
    resumeAudio,
    setAudioVolume,
    playAudioByType,
    pauseAudioByType,
    stopAudioByType,
    setAudioEnabledByType,
    setAudioModeByType,
    getAudioListByType,
    replaceAudioListByType,
    appendAudioListByType,
    getAudioStateByType,
    getCurrentCharacter,
    listCharacters,
    ...loreRegexAdapters,
  };

  executionContext.runSlashCommand = async (script: string) => {
    const result = await executeSlashCommandScript(script, executionContext);
    if (result.isError) {
      throw new Error(result.errorMessage || "runSlashCommand failed");
    }
    return result.pipe;
  };

  return executionContext;
}
