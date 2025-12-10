/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          Session Page Component                            ║
 * ║                                                                            ║
 * ║  会话交互页面：聊天、世界书、正则脚本、预设管理                               ║
 * ║  路由参数：id (sessionId) - 会话的唯一标识符                                ║
 * ║  状态管理：Zustand Store 统一管理视图切换（单一数据源）                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/app/i18n";
import CharacterChatPanel from "@/components/CharacterChatPanel";
import WorldBookEditor from "@/components/WorldBookEditor";
import RegexScriptEditor from "@/components/RegexScriptEditor";
import PresetEditor from "@/components/PresetEditor";
import { toast } from "@/lib/store/toast-store";
import LoginModal from "@/components/LoginModal";
import { useHeaderContent } from "@/contexts/header-content";
import { ChatTopBarContent } from "@/components/chat/ChatTopBarContent";

import { useCharacterDialogue } from "@/hooks/useCharacterDialogue";
import { useCharacterLoader } from "@/hooks/useCharacterLoader";
import { useUIStore } from "@/lib/store/ui-store";
import { useUserStore } from "@/lib/store/user-store";
import { useSessionStore } from "@/lib/store/session-store";
import DialogueTreeModal from "@/components/DialogueTreeModal";

// ============================================================================
//                              主组件
// ============================================================================

export default function SessionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("id");
  const { t, fontClass, serifFontClass, language } = useLanguage();

  // ========== Session Store - 获取 characterId ==========
  const getSessionById = useSessionStore((state) => state.getSessionById);
  const fetchAllSessions = useSessionStore((state) => state.fetchAllSessions);
  const sessions = useSessionStore((state) => state.sessions);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // ========== 参数校验：缺少 id 时重定向到首页 ==========
  useEffect(() => {
    if (!sessionId) {
      router.replace("/");
    }
  }, [sessionId, router]);

  // ========== 从 Session 获取 characterId ==========
  const isSessionsLoading = useSessionStore((state) => state.isLoading);
  const [hasTriedFetch, setHasTriedFetch] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) return;

      // 首次加载时获取所有 sessions
      if (!hasTriedFetch && sessions.length === 0) {
        setHasTriedFetch(true);
        await fetchAllSessions();
        return; // fetchAllSessions 完成后会触发 sessions 变化，重新执行此 effect
      }

      // 等待加载完成
      if (isSessionsLoading) return;

      const session = getSessionById(sessionId);
      if (session) {
        setCharacterId(session.characterId);
        setSessionError(null);
      } else if (hasTriedFetch) {
        // 只有在已尝试加载后才显示错误
        setSessionError(t("characterChat.sessionNotFound") || "Session not found");
      }
    };

    loadSession();
  }, [sessionId, sessions, isSessionsLoading, hasTriedFetch, getSessionById, fetchAllSessions, t]);

  // ========== Zustand Store - 单一数据源 ==========
  const characterView = useUIStore((state) => state.characterView);
  const setCharacterView = useUIStore((state) => state.setCharacterView);
  const presetViewPayload = useUIStore((state) => state.presetViewPayload);
  const resetPresetViewPayload = useUIStore((state) => state.resetPresetViewPayload);
  const displayUsername = useUserStore((state) => state.displayUsername);

  // ========== 对话 Hook ==========
  const dialogue = useCharacterDialogue({
    characterId,
    sessionId,
    dialogueKey: sessionId,
    onError: toast.error,
    t,
  });

  // ========== 加载 Hook ==========
  const loader = useCharacterLoader({
    characterId,
    sessionId,
    dialogueKey: sessionId,
    initializeNewDialogue: dialogue.initializeNewDialogue,
    t,
  });

  // ========== 业务状态 ==========
  const [userInput, setUserInput] = useState("");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [activeModes, setActiveModes] = useState<Record<string, any>>({
    "story-progress": false,
    perspective: { active: false, mode: "novel" },
    "scene-setting": false,
  });
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const { setHeaderContent } = useHeaderContent();

  useEffect(() => {
    if (!loader.character) {
      setHeaderContent(null);
      return;
    }
    setHeaderContent(
      <ChatTopBarContent
        character={loader.character}
        activeView={characterView}
        onOpenBranches={() => setIsBranchOpen(true)}
      />,
    );
    return () => setHeaderContent(null);
  }, [loader.character, characterView, setHeaderContent]);

  // ═══════════════════════════════════════════════════════════════
  // 同步加载数据到对话状态
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (loader.dialogueData) {
      dialogue.setMessages(loader.dialogueData.messages);
      dialogue.setSuggestedInputs(loader.dialogueData.suggestedInputs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loader.dialogueData]);

  // ========== 监听 Store 变化 ==========
  useEffect(() => {
    if (presetViewPayload && characterView === "preset") {
      if (presetViewPayload.presetId) {
        sessionStorage.setItem("activate_preset_id", presetViewPayload.presetId);
      } else if (presetViewPayload.presetName) {
        sessionStorage.setItem("activate_preset_name", presetViewPayload.presetName);
      }
      resetPresetViewPayload();
    }
  }, [presetViewPayload, characterView, resetPresetViewPayload]);

  // ═══════════════════════════════════════════════════════════════
  // 响应用户名变化，重新加载对话
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (sessionId) {
      dialogue.fetchLatestDialogue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayUsername, sessionId]);

  // ========== 提交消息 ==========
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!userInput.trim() || dialogue.isSending) return;

      const hints: string[] = [];

      if (activeModes["story-progress"]) {
        hints.push(t("characterChat.storyProgressHint"));
      }
      if (activeModes["perspective"].active) {
        const hintKey =
          activeModes["perspective"].mode === "novel"
            ? "characterChat.novelPerspectiveHint"
            : "characterChat.protagonistPerspectiveHint";
        hints.push(t(hintKey));
      }
      if (activeModes["scene-setting"]) {
        hints.push(t("characterChat.sceneTransitionHint"));
      }

      let message: string;
      if (hints.length > 0) {
        message = `
      <input_message>
      ${t("characterChat.playerInput")}：${userInput}
      </input_message>
      <response_instructions>
      ${t("characterChat.responseInstructions")}：${hints.join(" ")}
      </response_instructions>
        `.trim();
      } else {
        message = `
      <input_message>
      ${t("characterChat.playerInput")}：${userInput}
      </input_message>
        `.trim();
      }

      setUserInput("");
      await dialogue.handleSendMessage(message);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userInput, dialogue.isSending, dialogue.handleSendMessage, activeModes, t],
  );

  // ========== 渲染：缺少 sessionId ==========
  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-sm text-foreground">{t("characterChat.redirecting") || "Redirecting..."}</p>
      </div>
    );
  }

  // ========== 渲染：Session 不存在 ==========
  if (sessionError) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl text-cream mb-4">{t("characterChat.error")}</h1>
        <p className="text-primary-soft mb-6">{sessionError}</p>
        <Link
          href="/"
          className="bg-muted-surface hover:bg-muted-surface text-cream font-medium py-2 px-4 rounded border border-border"
        >
          {t("characterChat.backToHome") || t("characterChat.backToCharacters")}
        </Link>
      </div>
    );
  }

  // ========== 渲染：等待 characterId 加载 ==========
  if (!characterId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-sm text-foreground">{t("characterChat.loading") || "Loading..."}</p>
      </div>
    );
  }

  // ========== 渲染：加载状态 ==========
  if (loader.isLoading || loader.isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-sm text-foreground">{loader.loadingPhase}</p>
        {loader.isInitializing && (
          <p className={`text-ink-soft text-xs max-w-xs text-center ${fontClass}`}>
            {t("characterChat.loadingTimeHint")}
          </p>
        )}
      </div>
    );
  }

  // ========== 渲染：错误状态（包括 sessionId 无效） ==========
  if (loader.error || !loader.character) {
    return (
      <div className="flex flex-col items-center justify-center h-full ">
        <h1 className="text-2xl text-cream mb-4">{t("characterChat.error")}</h1>
        <p className="text-primary-soft mb-6">
          {loader.error || t("characterChat.sessionNotFound") || t("characterChat.characterNotFound")}
        </p>
        <Link
          href="/"
          className="bg-muted-surface hover:bg-muted-surface text-cream font-medium py-2 px-4 rounded border border-border"
        >
          {t("characterChat.backToHome") || t("characterChat.backToCharacters")}
        </Link>
      </div>
    );
  }

  // ========== 渲染：主界面 ==========
  return (
    <div className="flex h-full relative overflow-hidden">
      <div className="flex-1 h-full flex flex-col min-w-0">
        {characterView === "chat" ? (
          <CharacterChatPanel
            character={loader.character}
            messages={dialogue.messages}
            openingMessages={dialogue.openingMessages}
            openingIndex={dialogue.openingIndex}
            openingLocked={dialogue.openingLocked}
            userInput={userInput}
            setUserInput={setUserInput}
            isSending={dialogue.isSending}
            suggestedInputs={dialogue.suggestedInputs}
            onSubmit={handleSubmit}
            onSuggestedInput={setUserInput}
            onTruncate={dialogue.truncateMessagesAfter}
            onRegenerate={dialogue.handleRegenerate}
            onOpeningNavigate={dialogue.handleOpeningNavigate}
            fontClass={fontClass}
            serifFontClass={serifFontClass}
            t={t}
            activeModes={activeModes}
            setActiveModes={setActiveModes}
            language={language as "zh" | "en"}
            onSendMessage={dialogue.addUserMessage}
            onTriggerGeneration={dialogue.triggerGeneration}
            onSendAs={(role, text) => dialogue.addRoleMessage(role, text)}
            onSendSystem={(text) => dialogue.addRoleMessage("system", text)}
            onImpersonate={(text) => dialogue.addRoleMessage("assistant", text)}
            onContinue={dialogue.triggerGeneration}
          />
        ) : characterView === "worldbook" ? (
          <WorldBookEditor
            onClose={() => setCharacterView("chat")}
            characterName={loader.character?.name || ""}
            characterId={characterId || ""}
          />
        ) : characterView === "preset" ? (
          <PresetEditor
            onClose={() => setCharacterView("chat")}
            characterName={loader.character?.name || ""}
            characterId={characterId || ""}
          />
        ) : (
          <RegexScriptEditor
            onClose={() => setCharacterView("chat")}
            characterName={loader.character?.name || ""}
            characterId={characterId || ""}
          />
        )}
      </div>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      <DialogueTreeModal
        isOpen={isBranchOpen}
        onClose={() => setIsBranchOpen(false)}
        characterId={characterId || undefined}
        sessionId={sessionId || undefined}
        onDialogueEdit={() => dialogue.fetchLatestDialogue()}
      />
    </div>
  );
}
