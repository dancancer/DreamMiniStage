/**
 * @input  lib/slash-command/types
 * @output SESSION_HOST_BRIDGE_WINDOW_KEY, SessionSlashHostBridge, resolveSessionSlashHostBridge, buildSessionSlashHostBridgeDetail
 * @pos    /session 宿主桥接协议与解析工具
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      Session Host Bridge Contract                        ║
 * ║                                                                           ║
 * ║  统一管理 /session 宿主桥接协议，避免 window 魔法字符串继续散落。          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  TranslateTextOptions,
  YouTubeTranscriptOptions,
} from "@/lib/slash-command/types";

export const SESSION_HOST_BRIDGE_WINDOW_KEY = "__DREAMMINISTAGE_SESSION_HOST__" as const;

export type SessionSlashHostBridge = {
  translateText?: (
    text: string,
    options?: TranslateTextOptions,
  ) => string | Promise<string>;
  getYouTubeTranscript?: (
    urlOrId: string,
    options?: YouTubeTranscriptOptions,
  ) => string | Promise<string>;
};

type SessionHostWindow = Window & {
  [SESSION_HOST_BRIDGE_WINDOW_KEY]?: SessionSlashHostBridge;
};

export function resolveSessionSlashHostBridge(owner?: Window | null): SessionSlashHostBridge | null {
  if (!owner) {
    return null;
  }

  const candidate = (owner as SessionHostWindow)[SESSION_HOST_BRIDGE_WINDOW_KEY];
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  return candidate;
}

export function buildSessionSlashHostBridgeDetail(
  method: keyof SessionSlashHostBridge,
): string {
  return `window.${SESSION_HOST_BRIDGE_WINDOW_KEY}.${method}`;
}
