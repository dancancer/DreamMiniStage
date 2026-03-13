/**
 * @input  react, components/*, app/session/*
 * @output SessionPageLayout
 * @pos    /session 内容页主视图装配
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      Session Page Layout                                 ║
 * ║                                                                           ║
 * ║  收口 chat/editor/modal 组合，让内容页只保留状态与装配入口。                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import WorldBookEditor from "@/components/WorldBookEditor";
import RegexScriptEditor from "@/components/RegexScriptEditor";
import PresetEditor from "@/components/PresetEditor";
import LoginModal from "@/components/LoginModal";
import DialogueTreeModal from "@/components/DialogueTreeModal";
import CharacterChatPanel from "@/components/CharacterChatPanel";
import SessionContentView from "@/app/session/session-content-view";
import SessionChatView from "@/app/session/session-chat-view";
import type { Character, DialogueMessage } from "@/types/character-dialogue";
import type { SessionGalleryItem } from "@/app/session/session-gallery";
import type {
  ScriptHostDebugSnapshot,
  ScriptHostDebugState,
} from "@/hooks/script-bridge/host-debug-state";
import type { useSessionPageActions } from "@/app/session/use-session-page-actions";
import type { SendOptions } from "@/lib/slash-command/types";

interface DialogueController {
  messages: DialogueMessage[];
  openingMessages: { id: string; content: string }[];
  openingIndex: number;
  openingLocked: boolean;
  suggestedInputs: string[];
  isSending: boolean;
  addUserMessage: React.ComponentProps<typeof CharacterChatPanel>["onSendMessage"];
  addRoleMessage: (role: string, text: string, options?: SendOptions) => void | Promise<void>;
  triggerGeneration: () => Promise<void>;
  handleSwipe: (target?: string) => Promise<void>;
  handleRegenerate: (nodeId: string) => Promise<void>;
  handleOpeningNavigate: (direction: "prev" | "next") => Promise<void>;
  truncateMessagesAfter: (nodeId: string) => Promise<void>;
  exportJsonl: () => Promise<void>;
  importJsonl: (file: File) => Promise<void>;
  fetchLatestDialogue: () => Promise<void>;
}

interface Props {
  characterView: "chat" | "worldbook" | "preset" | "regex";
  currentCharacter: Character;
  characterId: string;
  currentCharacterName: string;
  currentSessionName: string;
  sessionId: string;
  userInput: string;
  setUserInput: (value: string) => void;
  activeModes: Record<string, unknown>;
  setActiveModes: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  fontClass: string;
  serifFontClass: string;
  language: "zh" | "en";
  t: (key: string) => string;
  galleryState: {
    open: boolean;
    items: SessionGalleryItem[];
    target?: { character?: string; group?: string };
  };
  setGalleryState: React.Dispatch<React.SetStateAction<{
    open: boolean;
    items: SessionGalleryItem[];
    target?: { character?: string; group?: string };
  }>>;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isBranchOpen: boolean;
  setIsBranchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dialogue: DialogueController;
  actions: ReturnType<typeof useSessionPageActions>;
  setCharacterView: (view: "chat" | "worldbook" | "preset" | "regex") => void;
  hostDebug: ScriptHostDebugSnapshot;
  hostDebugState: ScriptHostDebugState;
  onHostDebugUpdate: (snapshot: ScriptHostDebugSnapshot) => void;
}

function buildChatPanelProps(params: Omit<Props, "characterView" | "galleryState" | "setGalleryState" | "isLoginModalOpen" | "setIsLoginModalOpen" | "isBranchOpen" | "setIsBranchOpen" | "setCharacterView">): React.ComponentProps<typeof CharacterChatPanel> {
  const {
    currentCharacter,
    currentSessionName,
    sessionId,
    userInput,
    setUserInput,
    activeModes,
    setActiveModes,
    fontClass,
    serifFontClass,
    language,
    t,
    dialogue,
    actions,
    hostDebug,
    hostDebugState,
    onHostDebugUpdate,
  } = params;

  return {
    character: currentCharacter,
    messages: dialogue.messages,
    openingMessages: dialogue.openingMessages,
    openingIndex: dialogue.openingIndex,
    openingLocked: dialogue.openingLocked,
    userInput,
    setUserInput,
    isSending: dialogue.isSending,
    suggestedInputs: dialogue.suggestedInputs,
    onSubmit: (event) => actions.handleSubmit(event, userInput),
    onSuggestedInput: setUserInput,
    onTruncate: dialogue.truncateMessagesAfter,
    onRegenerate: dialogue.handleRegenerate,
    onOpeningNavigate: dialogue.handleOpeningNavigate,
    fontClass,
    serifFontClass,
    t,
    activeModes,
    setActiveModes,
    language,
    dialogueKey: sessionId,
    chatName: currentSessionName,
    onSendMessage: dialogue.addUserMessage,
    onTriggerGeneration: dialogue.triggerGeneration,
    onSendAs: dialogue.addRoleMessage,
    onSendSystem: (text, options) => dialogue.addRoleMessage?.("system", text, options),
    onImpersonate: (text) => dialogue.addRoleMessage?.("assistant", text),
    onContinue: dialogue.triggerGeneration,
    onSwipe: dialogue.handleSwipe,
    onRenameChat: actions.handleRenameChat,
    onCreateCheckpoint: actions.handleCreateCheckpoint,
    onCreateBranch: actions.handleCreateBranch,
    onGetCheckpoint: actions.handleGetCheckpoint,
    onListCheckpoints: actions.handleListCheckpoints,
    onGoCheckpoint: actions.handleGoCheckpoint,
    onExitCheckpoint: actions.handleExitCheckpoint,
    onGetCheckpointParent: actions.handleGetCheckpointParent,
    onOpenTemporaryChat: actions.handleOpenTemporaryChat,
    onForceSaveChat: actions.handleForceSaveChat,
    onHideMessages: actions.handleHideMessages,
    onUnhideMessages: actions.handleUnhideMessages,
    onTranslateText: actions.handleTranslateText,
    onGetYouTubeTranscript: actions.handleGetYouTubeTranscript,
    onGetClipboardText: actions.handleGetClipboardText,
    onSetClipboardText: actions.handleSetClipboardText,
    onIsExtensionInstalled: actions.handleIsExtensionInstalled,
    onGetExtensionEnabledState: actions.handleGetExtensionEnabledState,
    onSetExtensionEnabled: actions.handleSetExtensionEnabled,
    hostCapabilitySources: actions.resolveSessionHostBridge().capabilitySources,
    hasHostOverrides: actions.resolveSessionHostBridge().hasHostOverrides,
    hostDebug,
    hostDebugState,
    onHostDebugUpdate,
    onSelectProxyPreset: actions.handleSelectProxyPreset,
    onGetWorldInfoTimedEffect: actions.handleGetWorldInfoTimedEffect,
    onSetWorldInfoTimedEffect: actions.handleSetWorldInfoTimedEffect,
    onGetGroupMember: actions.handleGetGroupMember,
    onAddGroupMember: actions.handleAddGroupMember,
    onRemoveGroupMember: actions.handleRemoveGroupMember,
    onMoveGroupMember: actions.handleMoveGroupMember,
    onPeekGroupMember: actions.handlePeekGroupMember,
    onGetGroupMemberCount: actions.handleGetGroupMemberCount,
    onSetGroupMemberEnabled: actions.handleSetGroupMemberEnabled,
    onListGallery: actions.handleListGallery,
    onShowGallery: actions.handleShowGallery,
    onJumpToMessage: actions.handleJumpToMessage,
    onSwitchCharacter: actions.handleSwitchCharacter,
    onRenameCurrentCharacter: actions.handleRenameCurrentCharacter,
    onExportJsonl: dialogue.exportJsonl,
    onImportJsonl: dialogue.importJsonl,
  };
}

export default function SessionPageLayout(props: Props) {
  const {
    characterView,
    characterId,
    currentCharacterName,
    sessionId,
    galleryState,
    setGalleryState,
    isLoginModalOpen,
    setIsLoginModalOpen,
    isBranchOpen,
    setIsBranchOpen,
    dialogue,
    actions,
    setCharacterView,
  } = props;
  const chatPanelProps = buildChatPanelProps(props);

  return (
    <SessionContentView
      characterView={characterView}
      chatView={(
        <SessionChatView
          sessionId={sessionId}
          messages={dialogue.messages}
          onExecuteQuickReply={actions.handleExecuteQuickReplyPanel}
          galleryState={galleryState}
          onCloseGallery={() => setGalleryState((current) => ({ ...current, open: false }))}
          chatPanelProps={chatPanelProps}
        />
      )}
      worldbookView={(
        <WorldBookEditor
          onClose={() => setCharacterView("chat")}
          characterName={currentCharacterName}
          characterId={characterId}
        />
      )}
      presetView={(
        <PresetEditor
          onClose={() => setCharacterView("chat")}
          characterName={currentCharacterName}
          characterId={characterId}
        />
      )}
      regexView={(
        <RegexScriptEditor
          onClose={() => setCharacterView("chat")}
          characterName={currentCharacterName}
          characterId={characterId}
        />
      )}
      loginModal={(
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
        />
      )}
      dialogueTreeModal={(
        <DialogueTreeModal
          isOpen={isBranchOpen}
          onClose={() => setIsBranchOpen(false)}
          characterId={characterId}
          sessionId={sessionId}
          onDialogueEdit={() => dialogue.fetchLatestDialogue()}
        />
      )}
    />
  );
}
