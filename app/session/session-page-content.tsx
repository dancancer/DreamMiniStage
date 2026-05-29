/**
 * @input  react, next/navigation, app/i18n, hooks/*, lib/store/*, app/session/*
 * @output SessionPageContent
 * @pos    /session 页面内容编排
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Session Page Content                                 ║
 * ║                                                                           ║
 * ║  收口 /session 的状态装配与 guard，具体副作用与视图组合下沉到独立模块。     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/app/i18n";
import { toast } from "@/lib/store/toast-store";
import { useCharacterDialogue } from "@/hooks/useCharacterDialogue";
import { useCharacterLoader } from "@/hooks/useCharacterLoader";
import { useUIStore } from "@/lib/store/ui-store";
import { useUserStore } from "@/lib/store/user-store";
import { useSessionStore } from "@/lib/store/session-store";
import {
  useSessionToolModesStore,
  type SessionToolModes,
} from "@/lib/store/session-tool-modes";
import { useSessionPageActions } from "@/app/session/use-session-page-actions";
import SessionPageLayout from "@/app/session/session-page-layout";
import { useSessionHostDebug } from "@/app/session/use-session-host-debug";
import { useSessionRouteState } from "@/app/session/use-session-route-state";
import {
  useSessionDialogueDataSync,
  useSessionDisplayUsernameReload,
  useSessionHeaderContent,
  useSessionMessageEvents,
  useSessionPresetActivation,
  useSessionUiEvents,
} from "@/app/session/use-session-page-effects";
import {
  EmptySessionScreen,
  ErrorScreen,
  LoadingScreen,
} from "@/app/session/session-state-screens";
import type { SessionGalleryItem } from "@/app/session/session-gallery";

function SessionPageContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");
  const { t, fontClass, serifFontClass, language } = useLanguage();

  const { characterId, sessionError } = useSessionRouteState(sessionId, t);
  const characterView = useUIStore((state) => state.characterView);
  const setCharacterView = useUIStore((state) => state.setCharacterView);
  const presetViewPayload = useUIStore((state) => state.presetViewPayload);
  const resetPresetViewPayload = useUIStore((state) => state.resetPresetViewPayload);
  const displayUsername = useUserStore((state) => state.displayUsername);
  const getSessionById = useSessionStore((state) => state.getSessionById);

  const dialogue = useCharacterDialogue({
    characterId,
    sessionId,
    dialogueKey: sessionId,
    onError: toast.error,
    t,
  });

  const loader = useCharacterLoader({
    characterId,
    sessionId,
    dialogueKey: sessionId,
    initializeNewDialogue: dialogue.initializeNewDialogue,
    t,
  });

  const [userInput, setUserInput] = useState("");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const [characterNameOverride, setCharacterNameOverride] = useState<string | null>(null);
  const [galleryState, setGalleryState] = useState<{
    open: boolean;
    items: SessionGalleryItem[];
    target?: { character?: string; group?: string };
  }>({
    open: false,
    items: [],
  });
  const activeModes = useSessionToolModesStore((state) => state.activeModes);
  const setActiveModes = useSessionToolModesStore((state) => state.setActiveModes);
  const resetModes = useSessionToolModesStore((state) => state.resetModes);
  const setActiveModesBridge = useCallback(
    (updater: React.SetStateAction<Record<string, unknown>>) => {
      setActiveModes((prev) => {
        const prevRecord = prev as unknown as Record<string, unknown>;
        const nextRecord = typeof updater === "function"
          ? updater(prevRecord)
          : updater;
        return nextRecord as unknown as SessionToolModes;
      });
    },
    [setActiveModes],
  );
  const sessionHostDebug = useSessionHostDebug();

  const currentCharacterName = characterNameOverride || loader.character?.name || "";
  const currentSessionName = sessionId ? getSessionById(sessionId)?.name || "" : "";
  const currentCharacter = useMemo(() => {
    if (!loader.character) {
      return null;
    }
    return { ...loader.character, name: currentCharacterName };
  }, [loader.character, currentCharacterName]);
  const normalizedCharacterView = characterView === "chat"
    || characterView === "worldbook"
    || characterView === "preset"
    ? characterView
    : "regex";

  useEffect(() => {
    setCharacterNameOverride(null);
  }, [characterId]);

  useEffect(() => {
    resetModes();
  }, [resetModes, sessionId]);

  const handleOpenBranches = useCallback(() => {
    setIsBranchOpen(true);
  }, []);

  useSessionHeaderContent({
    currentCharacter,
    characterView: normalizedCharacterView,
  });
  useSessionUiEvents({
    onOpenBranches: handleOpenBranches,
  });
  useSessionDialogueDataSync({
    dialogueData: loader.dialogueData,
    setMessages: dialogue.setMessages,
    setSuggestedInputs: dialogue.setSuggestedInputs,
  });
  useSessionPresetActivation({
    presetViewPayload,
    characterView,
    resetPresetViewPayload,
  });
  useSessionDisplayUsernameReload({
    sessionId,
    displayUsername,
    fetchLatestDialogue: dialogue.fetchLatestDialogue,
  });
  useSessionMessageEvents({
    characterId,
    dialogueMessages: dialogue.messages,
    setDialogueMessages: dialogue.setMessages,
    regenerateDialogueMessage: dialogue.handleRegenerate,
    onError: (message) => toast.error(message),
  });

  const actions = useSessionPageActions({
    sessionId,
    characterId,
    currentCharacter,
    currentCharacterName,
    currentSessionName,
    language,
    dialogue,
    setUserInput,
    activeModes: activeModes as unknown as Record<string, unknown>,
    setCharacterNameOverride,
    setGalleryState,
    t,
    hostDebugState: sessionHostDebug.hostDebugState,
    syncHostDebug: sessionHostDebug.syncHostDebug,
  });

  if (!sessionId) {
    return (
      <EmptySessionScreen
        eyebrow={language === "zh" ? "会话入口" : "Session Entry"}
        title={language === "zh" ? "还没有打开会话" : "No session selected"}
        message={language === "zh"
          ? "从首页选择已有会话，或先创建一个新的叙事会话。"
          : "Choose an existing session from Home, or create a new storytelling session first."}
        note={language === "zh"
          ? "会话页只负责继续叙事，不负责替你猜下一步去哪里。"
          : "The session page is for continuing the story, not for guessing where you meant to go next."}
        primaryHref="/"
        primaryLabel={language === "zh" ? "返回首页" : "Go to Home"}
        secondaryHref="/story-agent-import"
        secondaryLabel={language === "zh" ? "导入 Agent" : "Import Agent"}
      />
    );
  }

  if (sessionError) {
    return (
      <ErrorScreen
        title={t("characterChat.error")}
        message={sessionError}
        backLabel={t("characterChat.backToHome") || t("characterChat.backToCharacters")}
      />
    );
  }

  if (!characterId) {
    return <LoadingScreen text={t("characterChat.loading") || "Loading..."} />;
  }

  if (loader.isLoading || loader.isInitializing) {
    return (
      <LoadingScreen
        text={loader.loadingPhase}
        hint={loader.isInitializing ? t("characterChat.loadingTimeHint") : undefined}
        fontClass={fontClass}
      />
    );
  }

  if (loader.error || !loader.character || !currentCharacter) {
    return (
      <ErrorScreen
        title={t("characterChat.error")}
        message={loader.error || t("characterChat.sessionNotFound") || t("characterChat.characterNotFound")}
        backLabel={t("characterChat.backToHome") || t("characterChat.backToCharacters")}
      />
    );
  }

  return (
    <SessionPageLayout
      characterView={normalizedCharacterView}
      currentCharacter={currentCharacter}
      characterId={characterId}
      currentCharacterName={currentCharacterName}
      currentSessionName={currentSessionName}
      sessionId={sessionId}
      userInput={userInput}
      setUserInput={setUserInput}
      activeModes={activeModes as unknown as Record<string, unknown>}
      setActiveModes={setActiveModesBridge}
      fontClass={fontClass}
      serifFontClass={serifFontClass}
      language={language as "zh" | "en"}
      t={t}
      galleryState={galleryState}
      setGalleryState={setGalleryState}
      isLoginModalOpen={isLoginModalOpen}
      setIsLoginModalOpen={setIsLoginModalOpen}
      isBranchOpen={isBranchOpen}
      setIsBranchOpen={setIsBranchOpen}
      dialogue={dialogue}
      actions={actions}
      setCharacterView={setCharacterView}
      hostDebug={sessionHostDebug.hostDebug}
      hostDebugState={sessionHostDebug.hostDebugState}
      onHostDebugUpdate={sessionHostDebug.syncHostDebug}
    />
  );
}

export default SessionPageContent;
