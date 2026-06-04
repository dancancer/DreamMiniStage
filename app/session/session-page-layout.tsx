/**
 * @input  react, components/*, app/session/*
 * @output SessionPageLayout
 * @pos    /session 内容页主视图装配
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      Session Page Layout                                 ║
 * ║                                                                           ║
 * ║  收口 chat/editor/modal 组合，避免 chat 面板承载 Session host capability。   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import dynamic from "next/dynamic";
import CharacterChatPanel from "@/components/CharacterChatPanel";
import SessionContentView from "@/app/session/session-content-view";
import SessionChatView from "@/app/session/session-chat-view";
import type {
  Character,
  DialogueMessage,
  OpeningDirection,
  OpeningSelection,
} from "@/types/character-dialogue";
import type { SessionGalleryItem } from "@/app/session/session-gallery";
import type {
  ScriptHostDebugSnapshot,
} from "@/hooks/script-bridge/host-debug-state";
import type { useSessionPageActions } from "@/app/session/use-session-page-actions";

const LazyWorldBookEditor = dynamic(() => import("@/components/WorldBookEditor"), {
  ssr: false,
  loading: () => <SessionDeferredState label="正在载入世界书…" />,
});

const LazyRegexScriptEditor = dynamic(() => import("@/components/regex-editor/RegexScriptEditor"), {
  ssr: false,
  loading: () => <SessionDeferredState label="正在载入正则脚本…" />,
});

const LazyPresetEditor = dynamic(() => import("@/components/PresetEditor"), {
  ssr: false,
  loading: () => <SessionDeferredState label="正在载入预设…" />,
});

const LazyLoginModal = dynamic(() => import("@/components/LoginModal"), {
  ssr: false,
  loading: () => null,
});

const LazyDialogueTreeModal = dynamic(() => import("@/components/DialogueTreeModal"), {
  ssr: false,
  loading: () => null,
});

interface DialogueController {
  messages: DialogueMessage[];
  openingSelection: OpeningSelection;
  suggestedInputs: string[];
  isSending: boolean;
  handleSwipe: (target?: string) => Promise<void>;
  handleRegenerate: (nodeId: string) => Promise<void>;
  handleOpeningNavigate: (direction: OpeningDirection) => Promise<void>;
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
  sessionId: string;
  userInput: string;
  setUserInput: (value: string) => void;
  activeModes: Record<string, unknown>;
  setActiveModes: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  fontClass: string;
  serifFontClass: string;
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
}

function SessionDeferredState({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="session-card w-full max-w-md rounded-[1.25rem] border border-border/90 bg-card/95 p-6 text-center text-sm text-ink-soft">
        {label}
      </div>
    </div>
  );
}

function buildChatPanelProps(params: Omit<Props, "characterView" | "galleryState" | "setGalleryState" | "isLoginModalOpen" | "setIsLoginModalOpen" | "isBranchOpen" | "setIsBranchOpen" | "setCharacterView">): React.ComponentProps<typeof CharacterChatPanel> {
  const {
    currentCharacter,
    userInput,
    setUserInput,
    activeModes,
    setActiveModes,
    fontClass,
    serifFontClass,
    t,
    dialogue,
    actions,
    hostDebug,
  } = params;

  return {
    character: currentCharacter,
    messages: dialogue.messages,
    openingSelection: dialogue.openingSelection,
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
    onSwipe: dialogue.handleSwipe,
    hostDebug,
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
    setCharacterView,
  } = props;
  const chatPanelProps = buildChatPanelProps(props);

  return (
    <SessionContentView
      characterView={characterView}
      chatView={(
        <SessionChatView
          galleryState={galleryState}
          onCloseGallery={() => setGalleryState((current) => ({ ...current, open: false }))}
          chatPanelProps={chatPanelProps}
        />
      )}
      worldbookView={(
        <LazyWorldBookEditor
          onClose={() => setCharacterView("chat")}
          characterName={currentCharacterName}
          characterId={characterId}
        />
      )}
      presetView={(
        <LazyPresetEditor
          onClose={() => setCharacterView("chat")}
          characterName={currentCharacterName}
          characterId={characterId}
        />
      )}
      regexView={(
        <LazyRegexScriptEditor
          onClose={() => setCharacterView("chat")}
          characterName={currentCharacterName}
          characterId={characterId}
        />
      )}
      loginModal={(
        <LazyLoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
        />
      )}
      dialogueTreeModal={(
        <LazyDialogueTreeModal
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
