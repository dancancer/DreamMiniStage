/**
 * @input  hooks/script-bridge/types, lib/slash-command/executor, lib/audio/store, lib/data/roleplay/*
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
import type { WorldBookEntry } from "@/lib/models/world-book-model";
import { createLoreRegexAdapters } from "./slash-context-lore-regex";

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
  const onGetChatName = ctx.onGetChatName;
  const onSetInput = ctx.onSetInput;
  const onReloadPage = ctx.onReloadPage;
  const onTogglePanels = ctx.onTogglePanels;
  const onResetPanels = ctx.onResetPanels;
  const onToggleVisualNovelMode = ctx.onToggleVisualNovelMode;
  const onSetBackground = ctx.onSetBackground;
  const onSetTheme = ctx.onSetTheme;
  const onSetMovingUiPreset = ctx.onSetMovingUiPreset;
  const onSetCssVariable = ctx.onSetCssVariable;
  const onJumpToMessage = ctx.onJumpToMessage;
  const onRenderChatMessages = ctx.onRenderChatMessages;
  const onSwitchCharacter = ctx.onSwitchCharacter;

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
    getCurrentChatName: onGetChatName,
    setInputText: onSetInput,
    reloadPage: onReloadPage,
    togglePanels: onTogglePanels,
    resetPanels: onResetPanels,
    toggleVisualNovelMode: onToggleVisualNovelMode,
    setBackground: onSetBackground,
    setTheme: onSetTheme,
    setMovingUiPreset: onSetMovingUiPreset,
    setCssVariable: onSetCssVariable,
    jumpToMessage: onJumpToMessage,
    renderChatMessages: onRenderChatMessages,
    switchCharacter: onSwitchCharacter,
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
