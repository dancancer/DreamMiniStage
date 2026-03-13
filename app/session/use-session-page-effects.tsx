/**
 * @input  react, components/chat/ChatTopBarContent, contexts/header-content, lib/store/ui-store, lib/store/toast-store, app/session/session-message-events
 * @output 页面副作用 hooks
 * @pos    /session 内容页副作用拆分
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      Session Page Effects                                ║
 * ║                                                                           ║
 * ║  收口 header / preset / reload / message events 这批页面级副作用。         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useEffect } from "react";
import { ChatTopBarContent } from "@/components/chat/ChatTopBarContent";
import { useHeaderContent } from "@/contexts/header-content";
import { createSessionMessageEventHandlers } from "@/app/session/session-message-events";
import type { Character, DialogueMessage } from "@/types/character-dialogue";

export function useSessionHeaderContent(params: {
  currentCharacter: Character | null;
  characterView: "chat" | "worldbook" | "preset" | "regex";
  onOpenBranches: () => void;
}) {
  const { currentCharacter, characterView, onOpenBranches } = params;
  const { setHeaderContent } = useHeaderContent();

  useEffect(() => {
    if (!currentCharacter) {
      setHeaderContent(null);
      return;
    }

    setHeaderContent(
      <ChatTopBarContent
        character={currentCharacter}
        activeView={characterView}
        onOpenBranches={onOpenBranches}
      />,
    );
    return () => setHeaderContent(null);
  }, [currentCharacter, characterView, onOpenBranches, setHeaderContent]);
}

export function useSessionDialogueDataSync(params: {
  dialogueData?: {
    messages: DialogueMessage[];
    suggestedInputs: string[];
  } | null;
  setMessages: (messages: DialogueMessage[]) => void;
  setSuggestedInputs: (inputs: string[]) => void;
}) {
  const { dialogueData, setMessages, setSuggestedInputs } = params;

  useEffect(() => {
    if (!dialogueData) {
      return;
    }

    setMessages(dialogueData.messages);
    setSuggestedInputs(dialogueData.suggestedInputs);
  }, [dialogueData, setMessages, setSuggestedInputs]);
}

export function useSessionPresetActivation(params: {
  presetViewPayload: {
    presetId?: string;
    presetName?: string;
  } | null;
  characterView: string;
  resetPresetViewPayload: () => void;
}) {
  const { presetViewPayload, characterView, resetPresetViewPayload } = params;

  useEffect(() => {
    if (!presetViewPayload || characterView !== "preset") {
      return;
    }

    if (presetViewPayload.presetId) {
      sessionStorage.setItem("activate_preset_id", presetViewPayload.presetId);
    } else if (presetViewPayload.presetName) {
      sessionStorage.setItem("activate_preset_name", presetViewPayload.presetName);
    }

    resetPresetViewPayload();
  }, [presetViewPayload, characterView, resetPresetViewPayload]);
}

export function useSessionDisplayUsernameReload(params: {
  sessionId: string | null;
  displayUsername: string;
  fetchLatestDialogue: () => Promise<void>;
}) {
  const { sessionId, displayUsername, fetchLatestDialogue } = params;

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    void fetchLatestDialogue();
  }, [displayUsername, sessionId, fetchLatestDialogue]);
}

export function useSessionMessageEvents(params: {
  characterId: string | null;
  dialogueMessages: DialogueMessage[];
  setDialogueMessages: (messages: DialogueMessage[]) => void;
  regenerateDialogueMessage: (nodeId: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const {
    characterId,
    dialogueMessages,
    setDialogueMessages,
    regenerateDialogueMessage,
    onError,
  } = params;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlers = createSessionMessageEventHandlers({
      characterId,
      dialogueMessages,
      setDialogueMessages,
      regenerateDialogueMessage,
      onError,
    });

    window.addEventListener("DreamMiniStage:setChatMessages", handlers.handleSetChatMessages as EventListener);
    window.addEventListener("DreamMiniStage:createChatMessages", handlers.handleCreateChatMessages as EventListener);
    window.addEventListener("DreamMiniStage:deleteChatMessages", handlers.handleDeleteChatMessages as EventListener);
    window.addEventListener("DreamMiniStage:refreshOneMessage", handlers.handleRefreshOneMessage as EventListener);

    return () => {
      window.removeEventListener("DreamMiniStage:setChatMessages", handlers.handleSetChatMessages as EventListener);
      window.removeEventListener("DreamMiniStage:createChatMessages", handlers.handleCreateChatMessages as EventListener);
      window.removeEventListener("DreamMiniStage:deleteChatMessages", handlers.handleDeleteChatMessages as EventListener);
      window.removeEventListener("DreamMiniStage:refreshOneMessage", handlers.handleRefreshOneMessage as EventListener);
    };
  }, [characterId, dialogueMessages, regenerateDialogueMessage, setDialogueMessages, onError]);
}
