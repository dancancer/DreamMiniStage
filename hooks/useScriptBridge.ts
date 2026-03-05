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
import type { DialogueMessage } from "@/types/character-dialogue";
import type { CharacterSwitchResult, SendOptions } from "@/lib/slash-command/types";
import type { ScriptMessageData } from "@/types/script-message";

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
  // ─── Slash Command 回调 ───
  onSend?: (text: string, options?: SendOptions) => void | Promise<void>;
  onTrigger?: (member?: string) => void | Promise<void>;
  onSendAs?: (role: string, text: string) => void | Promise<void>;
  onSendSystem?: (text: string) => void | Promise<void>;
  onImpersonate?: (text: string) => void | Promise<void>;
  onContinue?: () => void | Promise<void>;
  onSwipe?: (target?: string) => void | Promise<void>;
  onGetChatName?: () => string | Promise<string>;
  onSetInput?: (text: string) => void | Promise<void>;
  onJumpToMessage?: (index: number) => void | Promise<void>;
  onRenderChatMessages?: (
    count: number,
    options?: { scroll?: boolean },
  ) => void | Promise<void>;
  onSwitchCharacter?: (
    target: string
  ) => CharacterSwitchResult | void | Promise<CharacterSwitchResult | void>;
}

interface UseScriptBridgeReturn {
  scriptVariables: Record<string, unknown>;
  scriptStatuses: ScriptStatus[];
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
    onSend,
    onTrigger,
    onSendAs,
    onSendSystem,
    onImpersonate,
    onContinue,
    onSwipe,
    onGetChatName,
    onSetInput,
    onJumpToMessage,
    onRenderChatMessages,
    onSwitchCharacter,
  } = options;
  const [scriptStatuses, setScriptStatuses] = useState<ScriptStatus[]>([]);

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

      // 控制台日志
      if (type === "CONSOLE_LOG") {
        console.log("[Script]", ...((payload.args as unknown[]) || []));
        return undefined;
      }

      // API 调用 - 委托给 handler registry
      if (type === "API_CALL") {
        const { method = "", args = [] } = payload;
        console.log("[useScriptBridge] 处理 API_CALL:", method, "args:", args);
        const result = await handleApiCall(method, args, {
          characterId,
          dialogueId,
          chatId: dialogueId,
          messageId: messagesRef.current[messagesRef.current.length - 1]?.id,
          messages: messagesRef.current,  // 通过 ref 获取最新 messages
          setScriptVariable,
          deleteScriptVariable,
          getVariablesSnapshot,
          onSend,
          onTrigger,
          onSendAs,
          onSendSystem,
          onImpersonate,
          onContinue,
          onSwipe,
          onGetChatName,
          onSetInput,
          onJumpToMessage,
          onRenderChatMessages,
          onSwitchCharacter: onSwitchCharacter ? handleCharacterSwitch : undefined,
        });
        console.log("[useScriptBridge] API_CALL 返回:", method, "result:", result);
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
      onSend,
      onTrigger,
      onSendAs,
      onSendSystem,
      onImpersonate,
      onContinue,
      onSwipe,
      onGetChatName,
      onSetInput,
      onJumpToMessage,
      onRenderChatMessages,
      onSwitchCharacter,
      handleCharacterSwitch,
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
    handleScriptMessage,
    broadcastCharacterChange,
    broadcastMessage,
  };
}
