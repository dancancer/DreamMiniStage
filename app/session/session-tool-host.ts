/**
 * @input  app/session/session-host*, app/session/session-store-hosts, app/session/session-gallery, lib/* stores, lib/model-runtime
 * @output createSessionToolHost
 * @pos    /session 工具宿主装配
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Session Tool Host                                ║
 * ║                                                                           ║
 * ║  统一装配 /session 工具宿主，页面 hook 不再直接认识底层 store 与桥接细节。  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCheckpointStore } from "@/lib/checkpoint/store";
import { useGroupChatStore } from "@/lib/group-chat/store";
import { syncModelConfigToStorage } from "@/lib/model-runtime";
import { useModelStore } from "@/lib/store/model-store";
import { createSessionDefaultHostBridge } from "@/app/session/session-host-defaults";
import { resolveSessionSlashHostBridge } from "@/app/session/session-host-bridge";
import { createSessionHostActions } from "@/app/session/session-host-actions";
import {
  createSessionHostCallbacks,
  resolveSessionHostBridgeState,
  type ResolvedSessionHostBridgeState,
} from "@/app/session/session-host";
import { listSessionGalleryItems, type SessionGalleryItem } from "@/app/session/session-gallery";
import { createSessionStoreHostCallbacks } from "@/app/session/session-store-hosts";
import { getSessionWorldInfoTimedEffect, setSessionWorldInfoTimedEffect } from "@/app/session/session-timed-world-info";
import type { Character, DialogueMessage, OpeningMessage } from "@/types/character-dialogue";

interface SessionGalleryState {
  open: boolean;
  items: SessionGalleryItem[];
  target?: { character?: string; group?: string };
}

interface CreateSessionToolHostOptions {
  sessionId: string | null;
  language: "zh" | "en";
  currentCharacter: Character | null;
  openingMessages: OpeningMessage[];
  messages: DialogueMessage[];
  setGalleryState: Dispatch<SetStateAction<SessionGalleryState>>;
}

interface SessionToolHost {
  resolveSessionHostBridge: () => ResolvedSessionHostBridgeState;
  storeHostCallbacks: ReturnType<typeof createSessionStoreHostCallbacks>;
  hostActions: ReturnType<typeof createSessionHostActions>;
}

type SessionStoreHostDeps = Parameters<typeof createSessionStoreHostCallbacks>[0]["deps"];
type SessionStoreHostCallbacks = ReturnType<typeof createSessionStoreHostCallbacks>;

const SESSION_TOOL_STORE_DEPS: SessionStoreHostDeps = {
  createCheckpoint: (dialogueId, messageId, requestedName) =>
    useCheckpointStore.getState().createCheckpoint(dialogueId, messageId, requestedName),
  createBranch: (dialogueId, messageId, parentSessionId) =>
    useCheckpointStore.getState().createBranch(dialogueId, messageId, parentSessionId),
  getCheckpoint: (dialogueId, messageId) =>
    useCheckpointStore.getState().getCheckpoint(dialogueId, messageId),
  listCheckpoints: (dialogueId, messages, links) =>
    useCheckpointStore.getState().listCheckpoints(dialogueId, messages, links),
  goCheckpoint: (dialogueId, messageId, parentSessionId) =>
    useCheckpointStore.getState().goCheckpoint(dialogueId, messageId, parentSessionId),
  exitCheckpoint: (dialogueId) =>
    useCheckpointStore.getState().exitCheckpoint(dialogueId),
  getCheckpointParent: (dialogueId) =>
    useCheckpointStore.getState().getCheckpointParent(dialogueId),
  getWorldInfoTimedEffect: getSessionWorldInfoTimedEffect,
  setWorldInfoTimedEffect: setSessionWorldInfoTimedEffect,
  getGroupMember: (dialogueId, target, field) =>
    useGroupChatStore.getState().getGroupMember(dialogueId, target, field),
  getGroupMemberCount: (dialogueId) =>
    useGroupChatStore.getState().getGroupMemberCount(dialogueId),
  addGroupMember: (dialogueId, target) =>
    useGroupChatStore.getState().addGroupMember(dialogueId, target),
  removeGroupMember: (dialogueId, target) =>
    useGroupChatStore.getState().removeGroupMember(dialogueId, target),
  moveGroupMember: (dialogueId, target, direction) =>
    useGroupChatStore.getState().moveGroupMember(dialogueId, target, direction),
  peekGroupMember: (dialogueId, target) =>
    useGroupChatStore.getState().peekGroupMember(dialogueId, target),
  setGroupMemberEnabled: (dialogueId, target, enabled) =>
    useGroupChatStore.getState().setGroupMemberEnabled(dialogueId, target, enabled),
};

function createSessionHostBridgeResolver(language: "zh" | "en") {
  const defaultSessionHostBridge = createSessionDefaultHostBridge({ language });

  return () => {
    const injectedBridge = typeof window === "undefined" ? null : resolveSessionSlashHostBridge(window);
    return resolveSessionHostBridgeState(defaultSessionHostBridge, injectedBridge);
  };
}

function createSessionToolStoreHost(
  sessionId: string | null,
  messages: DialogueMessage[],
): SessionStoreHostCallbacks {
  return createSessionStoreHostCallbacks({
    sessionId,
    dialogueMessages: messages,
    deps: SESSION_TOOL_STORE_DEPS,
  });
}

function createSessionToolActions(
  options: CreateSessionToolHostOptions,
  hostCallbacks: ReturnType<typeof createSessionHostCallbacks>,
  storeHostCallbacks: SessionStoreHostCallbacks,
) {
  const hostActions = createSessionHostActions({
    currentCharacter: options.currentCharacter,
    openingMessages: options.openingMessages,
    messages: options.messages,
    setGalleryState: options.setGalleryState,
    listSessionGalleryItems,
    getModelConfigs: () => useModelStore.getState(),
    syncModelConfigToStorage,
    hostCallbacks,
    storeHostCallbacks,
  });
  return hostActions;
}

export function createSessionToolHost(options: CreateSessionToolHostOptions): SessionToolHost {
  const resolveSessionHostBridge = createSessionHostBridgeResolver(options.language);
  const hostCallbacks = createSessionHostCallbacks(resolveSessionHostBridge);
  const storeHostCallbacks = createSessionToolStoreHost(options.sessionId, options.messages);
  const hostActions = createSessionToolActions(options, hostCallbacks, storeHostCallbacks);

  return {
    resolveSessionHostBridge,
    storeHostCallbacks,
    hostActions,
  };
}
