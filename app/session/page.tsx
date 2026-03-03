/**
 * @input  react, next/navigation, next/link, app/i18n, components/*, hooks/*, lib/store/*, lib/slash-command, contexts/*
 * @output SessionPage (default export)
 * @pos    页面组件 - 会话交互页面，聊天/世界书/正则/预设管理
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          Session Page Component                            ║
 * ║                                                                            ║
 * ║  会话交互页面：聊天、世界书、正则脚本、预设管理                               ║
 * ║  路由参数：id (sessionId) - 会话的唯一标识符                                ║
 * ║  状态管理：Zustand Store 统一管理视图切换（单一数据源）                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
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
import { useScriptVariables } from "@/lib/store/script-variables";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import { buildSwitchedSessionName } from "@/app/session/session-switch";
import { executeSlashCommandScript } from "@/lib/slash-command";
import type { CharacterSwitchResult, ExecutionContext } from "@/lib/slash-command/types";
import DialogueTreeModal from "@/components/DialogueTreeModal";

// ============================================================================
//                              主组件
// ============================================================================

function SessionPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("id");
  const { t, fontClass, serifFontClass, language } = useLanguage();

  // ========== Session Store - 获取 characterId ==========
  const getSessionById = useSessionStore((state) => state.getSessionById);
  const fetchAllSessions = useSessionStore((state) => state.fetchAllSessions);
  const createSession = useSessionStore((state) => state.createSession);
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
  const setScriptVariable = useScriptVariables((state) => state.setVariable);
  const deleteScriptVariable = useScriptVariables((state) => state.deleteVariable);

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

  /**
   * 活动模式配置
   * 使用明确的类型定义，避免 any
   */
  type PerspectiveMode = { active: boolean; mode: "novel" | "screenplay" | "chat" };
  type ActiveModesConfig = {
    "story-progress": boolean;
    perspective: PerspectiveMode;
    "scene-setting": boolean;
  };

  const [activeModes, setActiveModes] = useState<ActiveModesConfig>({
    "story-progress": false,
    perspective: { active: false, mode: "novel" },
    "scene-setting": false,
  });
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const { setHeaderContent } = useHeaderContent();
  const currentCharacterName = loader.character?.name;

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

  const resolveCharacterSwitchTarget = useCallback(async (target: string): Promise<string> => {
    const normalized = target.trim();
    if (!normalized) {
      throw new Error("Character target is required");
    }

    const records = await LocalCharacterRecordOperations.getAllCharacters();
    const exactId = records.find((record) => record.id === normalized);
    if (exactId) {
      return exactId.id;
    }

    const lower = normalized.toLowerCase();
    const exactNameMatches = records.filter((record) =>
      (record.data?.name ?? "").trim().toLowerCase() === lower,
    );
    if (exactNameMatches.length === 1) {
      return exactNameMatches[0].id;
    }
    if (exactNameMatches.length > 1) {
      throw new Error(`Character name is ambiguous: ${normalized}`);
    }

    const fuzzyMatches = records.filter((record) =>
      (record.data?.name ?? "").toLowerCase().includes(lower),
    );
    if (fuzzyMatches.length === 1) {
      return fuzzyMatches[0].id;
    }
    if (fuzzyMatches.length > 1) {
      throw new Error(`Character target is ambiguous: ${normalized}`);
    }

    throw new Error(`Character not found: ${normalized}`);
  }, []);

  const handleSwitchCharacter = useCallback(async (target: string): Promise<CharacterSwitchResult> => {
    const nextCharacterId = await resolveCharacterSwitchTarget(target);
    const nextCharacterRecord = await LocalCharacterRecordOperations.getCharacterById(nextCharacterId);
    const nextCharacterName = nextCharacterRecord?.data?.name?.trim() || nextCharacterId;
    const switchedSessionName = buildSwitchedSessionName(nextCharacterName, currentCharacterName);
    const nextSessionId = await createSession(nextCharacterId, { name: switchedSessionName });
    if (!nextSessionId) {
      throw new Error(`Failed to create session for character: ${nextCharacterId}`);
    }
    router.push(`/session?id=${encodeURIComponent(nextSessionId)}`);
    return {
      target,
      characterId: nextCharacterId,
      characterName: nextCharacterName,
      sessionId: nextSessionId,
      sessionName: switchedSessionName,
    };
  }, [createSession, currentCharacterName, resolveCharacterSwitchTarget, router]);

  const executeSessionSlashInput = useCallback(async (script: string) => {
    const snapshot = useScriptVariables.getState().variables;
    const globalVariables: Record<string, unknown> = { ...snapshot.global };
    const characterVariables: Record<string, unknown> = characterId && snapshot.character[characterId]
      ? { ...snapshot.character[characterId] }
      : {};

    const hasCharacterVariable = (key: string): boolean =>
      Object.prototype.hasOwnProperty.call(characterVariables, key);

    const getVariable = (key: string): unknown => {
      if (hasCharacterVariable(key)) {
        return characterVariables[key];
      }
      return globalVariables[key];
    };

    const setVariable = (key: string, value: unknown): void => {
      if (characterId) {
        characterVariables[key] = value;
        setScriptVariable(key, value, "character", characterId);
        return;
      }

      globalVariables[key] = value;
      setScriptVariable(key, value, "global");
    };

    const deleteVariable = (key: string): void => {
      if (characterId) {
        delete characterVariables[key];
        deleteScriptVariable(key, "character", characterId);
        return;
      }

      delete globalVariables[key];
      deleteScriptVariable(key, "global");
    };

    const executionContext: ExecutionContext = {
      characterId: characterId || undefined,
      messages: dialogue.messages,
      onSend: async (text, options) => dialogue.addUserMessage(text, options),
      onTrigger: async () => dialogue.triggerGeneration(),
      onSendAs: async (role, text) => dialogue.addRoleMessage(role, text),
      onSendSystem: async (text) => dialogue.addRoleMessage("system", text),
      onImpersonate: async (text) => dialogue.addRoleMessage("assistant", text),
      onContinue: async () => dialogue.triggerGeneration(),
      onSwipe: dialogue.handleSwipe,
      switchCharacter: handleSwitchCharacter,
      getVariable,
      setVariable,
      deleteVariable,
      listVariables: () => {
        const keys = new Set<string>(Object.keys(globalVariables));
        for (const key of Object.keys(characterVariables)) {
          keys.add(key);
        }
        return Array.from(keys);
      },
      dumpVariables: () => ({
        ...globalVariables,
        ...characterVariables,
      }),
      getScopedVariable: (scope, key) => {
        if (scope === "global") {
          return globalVariables[key];
        }
        return getVariable(key);
      },
      setScopedVariable: (scope, key, value) => {
        if (scope === "global") {
          globalVariables[key] = value;
          setScriptVariable(key, value, "global");
          return;
        }
        setVariable(key, value);
      },
      deleteScopedVariable: (scope, key) => {
        if (scope === "global") {
          delete globalVariables[key];
          deleteScriptVariable(key, "global");
          return;
        }
        deleteVariable(key);
      },
      listScopedVariables: (scope) => {
        if (scope === "global") {
          return Object.keys(globalVariables);
        }
        const keys = new Set<string>(Object.keys(globalVariables));
        for (const key of Object.keys(characterVariables)) {
          keys.add(key);
        }
        return Array.from(keys);
      },
      dumpScopedVariables: (scope) => {
        if (scope === "global") {
          return { ...globalVariables };
        }
        return {
          ...globalVariables,
          ...characterVariables,
        };
      },
    };

    executionContext.runSlashCommand = async (nestedScript: string) => {
      const nestedResult = await executeSlashCommandScript(nestedScript, executionContext);
      if (nestedResult.isError) {
        throw new Error(nestedResult.errorMessage || "runSlashCommand failed");
      }
      return nestedResult.pipe;
    };

    const result = await executeSlashCommandScript(script, executionContext);
    if (result.isError) {
      throw new Error(result.errorMessage || "Slash command execution failed");
    }
  }, [
    dialogue,
    characterId,
    handleSwitchCharacter,
    setScriptVariable,
    deleteScriptVariable,
  ]);

  // ========== 提交消息 ==========
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const inputText = userInput;
      const trimmedInput = inputText.trim();
      if (!trimmedInput || dialogue.isSending) return;
      setUserInput("");

      if (trimmedInput.startsWith("/")) {
        try {
          await executeSessionSlashInput(trimmedInput);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          toast.error(errorMessage);
        }
        return;
      }

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
      ${t("characterChat.playerInput")}：${inputText}
      </input_message>
      <response_instructions>
      ${t("characterChat.responseInstructions")}：${hints.join(" ")}
      </response_instructions>
        `.trim();
      } else {
        message = `
      <input_message>
      ${t("characterChat.playerInput")}：${inputText}
      </input_message>
        `.trim();
      }

      await dialogue.handleSendMessage(message);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userInput, dialogue.isSending, dialogue.handleSendMessage, activeModes, t, executeSessionSlashInput],
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
            activeModes={activeModes as Record<string, unknown>}
            setActiveModes={setActiveModes as React.Dispatch<React.SetStateAction<Record<string, unknown>>>}
            language={language as "zh" | "en"}
            dialogueKey={sessionId}
            onSendMessage={dialogue.addUserMessage}
            onTriggerGeneration={dialogue.triggerGeneration}
            onSendAs={(role, text) => dialogue.addRoleMessage(role, text)}
            onSendSystem={(text) => dialogue.addRoleMessage("system", text)}
            onImpersonate={(text) => dialogue.addRoleMessage("assistant", text)}
            onContinue={dialogue.triggerGeneration}
            onSwipe={dialogue.handleSwipe}
            onSwitchCharacter={handleSwitchCharacter}
            onExportJsonl={dialogue.exportJsonl}
            onImportJsonl={dialogue.importJsonl}
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

// ============================================================================
//                              Suspense 包装
// ============================================================================

export default function SessionPage() {
  const { t } = useLanguage();

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <p className="text-sm text-foreground">{t("characterChat.loading") || "Loading..."}</p>
        </div>
      }
    >
      <SessionPageContent />
    </Suspense>
  );
}
