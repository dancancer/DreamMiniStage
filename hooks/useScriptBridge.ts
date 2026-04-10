/**
 * @input  lib/store/script-variables, hooks/script-bridge, types/character-dialogue, types/script-message, lib/slash-command/types
 * @output useScriptBridge, ScriptStatus
 * @pos    脚本桥接 Hook - 脚本系统与 React 组件之间的通信层
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         useScriptBridge Hook                               ║
 * ║                                                                            ║
 * ║  处理脚本事件桥接：变量管理、世界书访问、消息广播                            ║
 * ║  单一职责：脚本系统与 React 组件之间的通信层                                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useScriptVariables } from "@/lib/store/script-variables";
import { handleApiCall } from "./script-bridge";
import {
  readHostDebugSnapshot,
  type ScriptHostApiCallRecord,
  type ScriptHostDebugSnapshot,
  type ScriptHostDebugState,
  type ScriptHostRuntimeState,
} from "./script-bridge/host-debug-state";
import type { ScriptHostDebugResolvedPath } from "./script-bridge/host-debug-state";
import type { DialogueMessage } from "@/types/character-dialogue";
import type { CharacterSwitchResult } from "@/lib/slash-command/types";
import type { ScriptMessageData } from "@/types/script-message";
import type {
  MessageCallbacks,
  ChatManagementCallbacks,
  CheckpointCallbacks,
  GroupMemberCallbacks,
  QuickReplyCallbacks,
  ExpressionCallbacks,
  HostCapabilityCallbacks,
  WorldInfoCallbacks,
  UICallbacks,
  NavigationCallbacks,
} from "@/types/slash-callback-domains";

// ============================================================================
//                              类型定义
// ============================================================================

export interface ScriptStatus {
  scriptName?: string;
  status: "running" | "completed" | "error";
  message?: string;
  timestamp: number;
}

interface UseScriptBridgeOptions {
  characterId?: string;
  characterName?: string;
  dialogueId?: string;
  messages?: DialogueMessage[];
  maxStatusHistory?: number;
  // ─── 域回调分组 ───
  messageCallbacks?: MessageCallbacks;
  chatManagementCallbacks?: ChatManagementCallbacks;
  checkpointCallbacks?: CheckpointCallbacks;
  groupMemberCallbacks?: GroupMemberCallbacks;
  quickReplyCallbacks?: QuickReplyCallbacks;
  expressionCallbacks?: ExpressionCallbacks;
  hostCapabilityCallbacks?: HostCapabilityCallbacks;
  worldInfoCallbacks?: WorldInfoCallbacks;
  uiCallbacks?: UICallbacks;
  navigationCallbacks?: NavigationCallbacks;
  // ─── debug ───
  hostCapabilitySources?: Partial<Record<
    "translation" | "youtubeTranscript" | "clipboardRead" | "clipboardWrite" | "extensionRead" | "extensionWrite" | "galleryList" | "galleryShow",
    Extract<ScriptHostDebugResolvedPath, "session-default" | "api-context">
  >>;
  hasHostOverrides?: boolean;
  hostDebugState: ScriptHostDebugState;
  onHostDebugUpdate: (snapshot: ScriptHostDebugSnapshot) => void;
}

interface UseScriptBridgeReturn {
  scriptVariables: Record<string, unknown>;
  scriptStatuses: ScriptStatus[];
  scriptHostDebug: {
    recentApiCalls: ScriptHostApiCallRecord[];
    runtimeState: ScriptHostRuntimeState;
  };
  handleScriptMessage: (data: ScriptMessageData) => Promise<unknown>;
  broadcastCharacterChange: () => void;
  broadcastMessage: (message: DialogueMessage) => void;
}

function isCharacterSwitchResult(value: unknown): value is CharacterSwitchResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CharacterSwitchResult>;
  return (
    typeof candidate.target === "string" &&
    typeof candidate.characterId === "string" &&
    typeof candidate.characterName === "string" &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.sessionName === "string"
  );
}

// ============================================================================
//                              主 Hook
// ============================================================================

export function useScriptBridge(options: UseScriptBridgeOptions): UseScriptBridgeReturn {
  const {
    characterId,
    characterName,
    dialogueId,
    messages = [],
    maxStatusHistory = 50,
    messageCallbacks,
    chatManagementCallbacks,
    checkpointCallbacks,
    groupMemberCallbacks,
    quickReplyCallbacks,
    expressionCallbacks,
    hostCapabilityCallbacks,
    worldInfoCallbacks,
    uiCallbacks,
    navigationCallbacks,
    hostCapabilitySources,
    hasHostOverrides,
    hostDebugState,
    onHostDebugUpdate,
  } = options;

  // ─── 从域分组提取单个回调（仅在 hook 内部需要直接引用的） ───
  const onSwitchCharacter = navigationCallbacks?.onSwitchCharacter;
  const [scriptStatuses, setScriptStatuses] = useState<ScriptStatus[]>([]);
  const [scriptHostDebug, setScriptHostDebug] = useState(() => readHostDebugSnapshot(hostDebugState));

  const {
    variables: scriptVariablesStore,
    setVariable: setScriptVariable,
    deleteVariable: deleteScriptVariable,
  } = useScriptVariables();

  // 合并全局和角色变量 - 使用 useMemo 避免每次渲染创建新对象
  const scriptVariables = useMemo<Record<string, unknown>>(() => ({
    ...scriptVariablesStore.global,
    ...(characterId ? scriptVariablesStore.character[characterId] : {}),
  }), [scriptVariablesStore.global, scriptVariablesStore.character, characterId]);

  // ─── 使用 ref 存储 messages，避免 callback 依赖数组变化 ───
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const broadcastEvent = useCallback((eventName: string, data: unknown) => {
    window.dispatchEvent(
      new CustomEvent("DreamMiniStage:broadcast", {
        detail: { eventName, data },
      }),
    );
  }, []);

  const syncScriptHostDebug = useCallback(() => {
    const snapshot = readHostDebugSnapshot(hostDebugState);
    setScriptHostDebug(snapshot);
    onHostDebugUpdate(snapshot);
  }, [hostDebugState, onHostDebugUpdate]);

  const inferredHostOverrides = Boolean(
    hostCapabilityCallbacks?.onGetClipboardText ||
    hostCapabilityCallbacks?.onSetClipboardText ||
    hostCapabilityCallbacks?.onIsExtensionInstalled ||
    hostCapabilityCallbacks?.onGetExtensionEnabledState ||
    hostCapabilityCallbacks?.onSetExtensionEnabled,
  );
  const effectiveHasHostOverrides = hasHostOverrides ?? inferredHostOverrides;

  useEffect(() => {
    hostDebugState.setHasHostOverrides(effectiveHasHostOverrides);
    syncScriptHostDebug();
  }, [effectiveHasHostOverrides, hostDebugState, syncScriptHostDebug]);

  const handleCharacterSwitch = useCallback(
    async (target: string): Promise<CharacterSwitchResult | void> => {
      if (!onSwitchCharacter) {
        return undefined;
      }

      const sourceCharacter = {
        id: characterId ?? "",
        name: characterName ?? "",
      };
      broadcastEvent("character:switch_requested", {
        target,
        from: sourceCharacter,
      });

      try {
        const result = await onSwitchCharacter(target);
        if (isCharacterSwitchResult(result)) {
          broadcastEvent("character:switch_completed", {
            from: sourceCharacter,
            to: {
              id: result.characterId,
              name: result.characterName,
            },
            sessionId: result.sessionId,
            sessionName: result.sessionName,
            target: result.target,
          });
          return result;
        }

        broadcastEvent("character:switch_completed", {
          from: sourceCharacter,
          target,
        });
        return result;
      } catch (error) {
        broadcastEvent("character:switch_failed", {
          from: sourceCharacter,
          target,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [broadcastEvent, characterId, characterName, onSwitchCharacter],
  );

  // ─── 处理脚本消息 ───
  // 【性能优化】不依赖 messages，通过 ref 获取最新值
  const handleScriptMessage = useCallback(
    async (data: ScriptMessageData): Promise<unknown> => {
      const { type, payload = {} } = data;
      const getVariablesSnapshot = () => useScriptVariables.getState().variables;

      if (type === "CONSOLE_LOG") {
        if (process.env.NODE_ENV === "development") {
          console.log("[Script]", ...((payload.args as unknown[]) || []));
        }
        return undefined;
      }

      if (type === "API_CALL") {
        const { method = "", args = [] } = payload;
        // ─── 构建 ApiCallContext：域对象直接透传，角色切换走包装函数 ───
        const switchNav = onSwitchCharacter
          ? { ...navigationCallbacks, onSwitchCharacter: handleCharacterSwitch }
          : navigationCallbacks;
        const result = await handleApiCall(method, args, {
          characterId,
          dialogueId,
          chatId: dialogueId,
          messageId: messagesRef.current[messagesRef.current.length - 1]?.id,
          messages: messagesRef.current,
          hostDebugState,
          hostCapabilitySources,
          setScriptVariable,
          deleteScriptVariable,
          getVariablesSnapshot,
          messageCallbacks,
          chatManagementCallbacks,
          checkpointCallbacks,
          groupMemberCallbacks,
          quickReplyCallbacks,
          expressionCallbacks,
          hostCapabilityCallbacks,
          worldInfoCallbacks,
          uiCallbacks,
          navigationCallbacks: switchNav,
        });
        syncScriptHostDebug();
        return result;
      }

      // 事件透传
      if (type === "EVENT_EMIT") {
        const eventName = (payload as Record<string, unknown>).eventName as string;
        const eventData = (payload as Record<string, unknown>).data;
        window.dispatchEvent(
          new CustomEvent(`DreamMiniStage:${eventName}`, { detail: eventData }),
        );
        return eventName;
      }

      // 脚本状态更新
      if (type === "SCRIPT_STATUS") {
        setScriptStatuses((prev) => {
          const newStatus: ScriptStatus = {
            ...payload,
            timestamp: Date.now(),
          } as ScriptStatus;
          return [newStatus, ...prev].slice(0, maxStatusHistory);
        });
        return undefined;
      }

      return undefined;
    },
    [
      characterId,
      dialogueId,
      setScriptVariable,
      deleteScriptVariable,
      maxStatusHistory,
      messageCallbacks,
      chatManagementCallbacks,
      checkpointCallbacks,
      groupMemberCallbacks,
      quickReplyCallbacks,
      expressionCallbacks,
      hostCapabilityCallbacks,
      worldInfoCallbacks,
      uiCallbacks,
      navigationCallbacks,
      onSwitchCharacter,
      handleCharacterSwitch,
      syncScriptHostDebug,
      hostCapabilitySources,
      effectiveHasHostOverrides,
    ],
  );

  // ─── 广播角色变更 ───
  const broadcastCharacterChange = useCallback(() => {
    if (!characterId) return;
    window.dispatchEvent(
      new CustomEvent("DreamMiniStage:broadcast", {
        detail: {
          eventName: "character:changed",
          data: { id: characterId, name: characterName },
        },
      }),
    );
  }, [characterId, characterName]);

  // ─── 广播消息 ───
  const broadcastMessage = useCallback((message: DialogueMessage) => {
    const eventName = message.role === "user" ? "message:sent" : "message:received";
    window.dispatchEvent(
      new CustomEvent("DreamMiniStage:broadcast", {
        detail: { eventName, data: message },
      }),
    );
  }, []);

  // ─── 角色变更时广播 ───
  useEffect(() => {
    if (!characterId) return;
    window.dispatchEvent(
      new CustomEvent("DreamMiniStage:broadcast", {
        detail: {
          eventName: "character:changed",
          data: { id: characterId, name: characterName },
        },
      }),
    );
  }, [characterId, characterName]);

  return {
    scriptVariables,
    scriptStatuses,
    scriptHostDebug,
    handleScriptMessage,
    broadcastCharacterChange,
    broadcastMessage,
  };
}
