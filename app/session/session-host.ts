/**
 * @input  app/session/session-host-bridge, lib/slash-command/types
 * @output resolveSessionHostBridgeState, createSessionHostCallbacks
 * @pos    /session 宿主桥接合并与命令回调适配
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        Session Host Utilities                            ║
 * ║                                                                           ║
 * ║  收口 /session 默认宿主与注入宿主的合并、来源解析与高价值命令回调。          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import {
  buildSessionSlashHostBridgeDetail,
  type SessionSlashHostBridge,
} from "@/app/session/session-host-bridge";
import type {
  TranslateTextOptions,
  YouTubeTranscriptOptions,
} from "@/lib/slash-command/types";

export type SessionHostCapabilitySources = Partial<Record<
  "translation" | "youtubeTranscript" | "clipboardRead" | "clipboardWrite" | "extensionRead" | "extensionWrite",
  "session-default" | "api-context"
>>;

export interface ResolvedSessionHostBridgeState {
  bridge: SessionSlashHostBridge;
  capabilitySources: SessionHostCapabilitySources;
  hasHostOverrides: boolean;
}

export interface SessionHostCallbacks {
  translateText: (
    text: string,
    options?: TranslateTextOptions,
  ) => Promise<string>;
  getYouTubeTranscript: (
    urlOrId: string,
    options?: YouTubeTranscriptOptions,
  ) => Promise<string>;
  getClipboardText: () => Promise<string>;
  setClipboardText: (text: string) => Promise<void>;
  isExtensionInstalled: (extensionName: string) => Promise<boolean>;
  getExtensionEnabledState: (extensionName: string) => Promise<boolean>;
  setExtensionEnabled: (
    extensionName: string,
    enabled: boolean,
    options?: { reload?: boolean },
  ) => Promise<string | void>;
}

function resolveSessionHostMethodSource(
  injectedBridge: SessionSlashHostBridge | null,
  method: keyof SessionSlashHostBridge,
): "session-default" | "api-context" {
  return typeof injectedBridge?.[method] === "function" ? "api-context" : "session-default";
}

function hasSessionHostOverrides(bridge: SessionSlashHostBridge | null): boolean {
  if (!bridge) {
    return false;
  }

  return [
    "translateText",
    "getYouTubeTranscript",
    "getClipboardText",
    "setClipboardText",
    "isExtensionInstalled",
    "getExtensionEnabledState",
    "setExtensionEnabled",
  ].some((method) => typeof bridge[method as keyof SessionSlashHostBridge] === "function");
}

function buildSessionSlashHostError(commandName: string, detail: string): Error {
  return new Error(`${commandName} is not wired in /session host yet: ${detail}`);
}

function expectStringResult(commandName: string, value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    throw new Error(`${commandName} host returned non-string ${fallback}`);
  }
  return value;
}

function expectBooleanResult(commandName: string, extensionName: string, value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${commandName} host returned non-boolean ${label}: ${extensionName}`);
  }
  return value;
}

export function resolveSessionHostBridgeState(
  defaultBridge: SessionSlashHostBridge,
  injectedBridge: SessionSlashHostBridge | null,
): ResolvedSessionHostBridgeState {
  return {
    bridge: {
      ...defaultBridge,
      ...(injectedBridge || {}),
    },
    capabilitySources: {
      translation: resolveSessionHostMethodSource(injectedBridge, "translateText"),
      youtubeTranscript: resolveSessionHostMethodSource(injectedBridge, "getYouTubeTranscript"),
      clipboardRead: resolveSessionHostMethodSource(injectedBridge, "getClipboardText"),
      clipboardWrite: resolveSessionHostMethodSource(injectedBridge, "setClipboardText"),
      extensionRead: resolveSessionHostMethodSource(injectedBridge, "getExtensionEnabledState"),
      ...(typeof injectedBridge?.setExtensionEnabled === "function"
        ? { extensionWrite: "api-context" as const }
        : {}),
    },
    hasHostOverrides: hasSessionHostOverrides(injectedBridge),
  };
}

export function createSessionHostCallbacks(
  resolveState: () => ResolvedSessionHostBridgeState,
): SessionHostCallbacks {
  return {
    translateText: async (text, options) => {
      const hostBridge = resolveState().bridge;
      if (!hostBridge.translateText) {
        throw buildSessionSlashHostError("/translate", buildSessionSlashHostBridgeDetail("translateText"));
      }
      return expectStringResult(
        "/translate",
        await Promise.resolve(hostBridge.translateText(text, options)),
        "result",
      );
    },
    getYouTubeTranscript: async (urlOrId, options) => {
      const hostBridge = resolveState().bridge;
      if (!hostBridge.getYouTubeTranscript) {
        throw buildSessionSlashHostError("/yt-script", buildSessionSlashHostBridgeDetail("getYouTubeTranscript"));
      }
      return expectStringResult(
        "/yt-script",
        await Promise.resolve(hostBridge.getYouTubeTranscript(urlOrId, options)),
        "result",
      );
    },
    getClipboardText: async () => {
      const hostBridge = resolveState().bridge;
      if (!hostBridge.getClipboardText) {
        throw buildSessionSlashHostError("/clipboard-get", buildSessionSlashHostBridgeDetail("getClipboardText"));
      }
      return expectStringResult(
        "/clipboard-get",
        await Promise.resolve(hostBridge.getClipboardText()),
        "clipboard text",
      );
    },
    setClipboardText: async (text) => {
      const hostBridge = resolveState().bridge;
      if (!hostBridge.setClipboardText) {
        throw buildSessionSlashHostError("/clipboard-set", buildSessionSlashHostBridgeDetail("setClipboardText"));
      }
      await Promise.resolve(hostBridge.setClipboardText(text));
    },
    isExtensionInstalled: async (extensionName) => {
      const hostBridge = resolveState().bridge;
      if (!hostBridge.isExtensionInstalled) {
        throw buildSessionSlashHostError("/extension-state", buildSessionSlashHostBridgeDetail("isExtensionInstalled"));
      }
      return expectBooleanResult(
        "/extension-state",
        extensionName,
        await Promise.resolve(hostBridge.isExtensionInstalled(extensionName)),
        "installed state",
      );
    },
    getExtensionEnabledState: async (extensionName) => {
      const hostBridge = resolveState().bridge;
      if (!hostBridge.getExtensionEnabledState) {
        throw buildSessionSlashHostError("/extension-state", buildSessionSlashHostBridgeDetail("getExtensionEnabledState"));
      }
      return expectBooleanResult(
        "/extension-state",
        extensionName,
        await Promise.resolve(hostBridge.getExtensionEnabledState(extensionName)),
        "enabled state",
      );
    },
    setExtensionEnabled: async (extensionName, enabled, options) => {
      const hostBridge = resolveState().bridge;
      if (!hostBridge.setExtensionEnabled) {
        throw new Error("/extension-toggle is not available in current context");
      }
      return Promise.resolve(hostBridge.setExtensionEnabled(extensionName, enabled, options));
    },
  };
}
