/**
 * @input  lib/audio/store, lib/slash-command/prompt-injection-store, hooks/script-bridge/tool-handlers
 * @output createAudioAdapters, createToolAdapters, createPromptInjectionAdapters
 * @pos    Slash 执行上下文适配 - 音频通道、工具注册、Prompt 注入
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    Tool & Prompt Adapter                                  ║
 * ║                                                                           ║
 * ║  职责：音频播放控制 / 脚本工具 CRUD / Prompt 注入管理                   ║
 * ║  模式：三个独立工厂函数，各自接收最小闭包依赖                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  AudioChannelType,
  AudioChannelSnapshot,
  SlashToolRegistration,
  ExecutionContext,
} from "@/lib/slash-command/types";
import type { ApiCallContext } from "../types";
import { getAudioManager } from "@/lib/audio/store";
import {
  upsertPromptInjection,
  listPromptInjections,
  removePromptInjections,
} from "@/lib/slash-command/prompt-injection-store";
import {
  getRegisteredScriptTools,
  invokeScriptTool,
  registerScriptTool,
  unregisterScriptTool,
} from "../tool-handlers";

/* ────────────────────────────────────────────────────────────
 *  音频适配器
 * ──────────────────────────────────────────────────────────── */

export function createAudioAdapters() {
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

  return {
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
    appendAudioListByType,
    replaceAudioListByType,
    getAudioStateByType,
  };
}

/* ────────────────────────────────────────────────────────────
 *  工具适配器
 * ──────────────────────────────────────────────────────────── */

interface ToolAdapterDeps {
  characterId: string | undefined;
  characterVariables: Record<string, unknown>;
  globalVariables: Record<string, unknown>;
  setLocalVariable: (key: string, value: unknown) => void;
  deleteLocalVariable: (key: string) => void;
  getExecutionContext: () => ExecutionContext;
}

export function createToolAdapters(deps: ToolAdapterDeps) {

  const listTools = async () => {
    return getRegisteredScriptTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  };

  const invokeTool = async (name: string, parameters: Record<string, unknown>) => {
    return invokeScriptTool(name, parameters);
  };

  const resolveToolVariableEntries = (
    value: unknown,
    prefix = "arg",
  ): Array<[string, unknown]> => {
    const entries: Array<[string, unknown]> = [];
    const visit = (currentValue: unknown, currentKey: string) => {
      if (
        typeof currentValue === "string"
        || typeof currentValue === "number"
        || typeof currentValue === "boolean"
      ) {
        entries.push([currentKey, currentValue]);
      } else {
        entries.push([currentKey, JSON.stringify(currentValue)]);
      }

      if (Array.isArray(currentValue)) {
        currentValue.forEach((item, index) => {
          visit(item, `${currentKey}.${index}`);
        });
        return;
      }

      if (currentValue && typeof currentValue === "object") {
        Object.entries(currentValue).forEach(([key, item]) => {
          visit(item, `${currentKey}.${key}`);
        });
      }
    };

    visit(value, prefix);
    return entries;
  };

  const captureToolVariableSnapshot = (key: string): { key: string; existed: boolean; value: unknown } => {
    const target = deps.characterId ? deps.characterVariables : deps.globalVariables;
    return Object.prototype.hasOwnProperty.call(target, key)
      ? { key, existed: true, value: target[key] }
      : { key, existed: false, value: undefined };
  };

  const withTemporaryToolVariables = async <T>(
    parameters: Record<string, unknown>,
    runner: () => Promise<T>,
  ): Promise<T> => {
    const entries = resolveToolVariableEntries(parameters);
    const snapshots = entries.map(([key]) => captureToolVariableSnapshot(key));

    entries.forEach(([key, value]) => {
      deps.setLocalVariable(key, value);
    });

    try {
      return await runner();
    } finally {
      snapshots.forEach((snapshot) => {
        if (snapshot.existed) {
          deps.setLocalVariable(snapshot.key, snapshot.value);
          return;
        }
        deps.deleteLocalVariable(snapshot.key);
      });
    }
  };

  const registerTool = async (registration: SlashToolRegistration): Promise<boolean> => {
    if (registration.shouldRegister === false) {
      return false;
    }

    return registerScriptTool(
      registration.name,
      registration.description,
      {
        type: "object",
        properties: registration.parameters.properties ?? {},
        required: registration.parameters.required,
      },
      async (parameters) => withTemporaryToolVariables(parameters, async () => {
        const ec = deps.getExecutionContext();
        return ec.runSlashCommand
          ? ec.runSlashCommand(registration.action)
          : "";
      }),
    );
  };

  const unregisterTool = async (name: string): Promise<boolean> => {
    return unregisterScriptTool(name);
  };

  return {
    listTools,
    invokeTool,
    registerTool,
    unregisterTool,
  };
}

/* ────────────────────────────────────────────────────────────
 *  Prompt 注入适配器
 * ──────────────────────────────────────────────────────────── */

export function createPromptInjectionAdapters(
  ctx: ApiCallContext,
  onRemovePromptInjections?: (id?: string) => number | Promise<number>,
) {

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

  return {
    getMessageReasoning,
    setMessageReasoning,
    injectPrompt,
    listInjectedPrompts,
    removeInjectedPrompts,
  };
}
