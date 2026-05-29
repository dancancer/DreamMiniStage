/**
 * @input  hooks/script-bridge/host-debug-state, types/character-dialogue, types/script-message
 * @output useScriptBridge, ScriptStatus
 * @pos    Story runtime 脚本桥接边界
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Story Script Boundary                            ║
 * ║                                                                           ║
 * ║  SAC-Phase 6a 后，/session 不再执行第三方脚本、TavernHelper、MVU 或 slash。   ║
 * ║  UI 仍保留一个显式 fail-fast 边界，避免旧脚本桥静默进入 story runtime。        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback, useMemo } from "react";
import {
  readHostDebugSnapshot,
  type ScriptHostApiCallRecord,
  type ScriptHostDebugSnapshot,
  type ScriptHostDebugState,
  type ScriptHostRuntimeState,
} from "./script-bridge/host-debug-state";
import type { DialogueMessage } from "@/types/character-dialogue";
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
  hostCapabilitySources?: Record<string, unknown>;
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

export function useScriptBridge(options: UseScriptBridgeOptions): UseScriptBridgeReturn {
  const snapshot = useMemo(
    () => readHostDebugSnapshot(options.hostDebugState),
    [options.hostDebugState],
  );

  const handleScriptMessage = useCallback(async () => {
    const entry = {
      method: "script-message",
      capability: "story-runtime-script-execution",
      resolvedPath: "fail-fast" as const,
      outcome: "fail-fast" as const,
      timestamp: Date.now(),
    };
    options.hostDebugState.recordApiCall(entry);
    options.onHostDebugUpdate(readHostDebugSnapshot(options.hostDebugState));
    throw new Error("Script bridge execution is not supported in story runtime");
  }, [options]);

  return {
    scriptVariables: {},
    scriptStatuses: [],
    scriptHostDebug: snapshot,
    handleScriptMessage,
    broadcastCharacterChange: () => undefined,
    broadcastMessage: () => undefined,
  };
}
