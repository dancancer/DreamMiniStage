/**
 * @input  hooks/script-bridge/types, lib/slash-command/executor, lib/audio/store, lib/data/roleplay/*
 * @output slashHandlers
 * @pos    Slash Command API Handlers - iframe 到 Slash 执行器的桥接
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command API Handlers                         ║
 * ║                                                                            ║
 * ║  桥接 iframe 调用到 Slash Command 执行器                                    ║
 * ║  Requirements: 1.1, 8.1                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiHandlerMap, ApiCallContext } from "./types";
import type {
  ExecutionContext,
  ExecutionResult,
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

// ============================================================================
//                              上下文适配器
// ============================================================================

/**
 * 将 ApiCallContext 适配为 ExecutionContext
 */
function adaptContext(ctx: ApiCallContext): ExecutionContext {
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

  const onSend = ctx.onSend ?? (async (_text?: string, _options?: SendOptions) => { console.warn("[adaptContext] onSend 未提供"); });
  const onTrigger = ctx.onTrigger ?? (async (_member?: string) => { console.warn("[adaptContext] onTrigger 未提供"); });
  const onSendAs = ctx.onSendAs;
  const onSendSystem = ctx.onSendSystem;
  const onImpersonate = ctx.onImpersonate;
  const onContinue = ctx.onContinue;
  const onSwipe = ctx.onSwipe;
  const onReloadPage = ctx.onReloadPage;
  const onSwitchCharacter = ctx.onSwitchCharacter;

  // ═══════════════════════════════════════════════════════════════════════════
  // WorldBook 扩展操作
  // ═══════════════════════════════════════════════════════════════════════════
  const getWorldBookEntry = async (id: string): Promise<WorldBookEntryData | undefined> => {
    if (!ctx.characterId) return undefined;
    const wb = await WorldBookOperations.getWorldBook(ctx.characterId);
    if (!wb) return undefined;
    const entry = Object.values(wb).find(
      (e: WorldBookEntry) => String(e.id) === id || String(e.entry_id) === id
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
        e.content?.toLowerCase().includes(lowerQuery)
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Preset 扩展操作
  // ═══════════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Audio 扩展操作
  // ═══════════════════════════════════════════════════════════════════════════
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
    reloadPage: onReloadPage,
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
    // ─── WorldBook 扩展 ───
    getWorldBookEntry,
    searchWorldBook,
    listWorldBookEntries,
    // ─── Preset 扩展 ───
    getPreset,
    setPreset,
    listPresets,
    // ─── Audio 扩展 ───
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
    // ─── Character 扩展 ───
    getCurrentCharacter,
    listCharacters,
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

// ============================================================================
//                              Slash Handlers
// ============================================================================

export const slashHandlers: ApiHandlerMap = {
  /**
   * triggerSlash - 执行 Slash 命令
   * @param args [command: string]
   * @returns ExecutionResult
   */
  triggerSlash: async (args, ctx): Promise<ExecutionResult> => {
    console.log("[slashHandlers.triggerSlash] 收到调用, args:", args);
    const [command] = args as [string];

    const execCtx = adaptContext(ctx);
    console.log("[slashHandlers.triggerSlash] 执行上下文已构建, onSend:", !!ctx.onSend, "onTrigger:", !!ctx.onTrigger);

    const result = await executeSlashCommandScript(command, execCtx);
    console.log("[slashHandlers.triggerSlash] 执行完成, result:", result);
    return result;
  },

  /**
   * triggerSlashWithResult - triggerSlash 的别名
   * 保持与 SillyTavern API 的兼容性
   */
  triggerSlashWithResult: async (args, ctx): Promise<ExecutionResult> => {
    return slashHandlers.triggerSlash(args, ctx) as Promise<ExecutionResult>;
  },
};
