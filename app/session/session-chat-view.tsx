/**
 * @input  react, components/CharacterChatPanel, components/session-gallery/SessionGalleryDialog, components/quick-reply/QuickReplyPanel, components/group-chat/GroupMemberPanel, components/checkpoint/CheckpointPanel, components/mvu/MvuDebuggerPanel
 * @output SessionChatView
 * @pos    /session chat 主视图
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        Session Chat View                                 ║
 * ║                                                                           ║
 * ║  收口 chat 视图的 CharacterChatPanel + footer tools + gallery dialog。    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import CharacterChatPanel from "@/components/CharacterChatPanel";
import QuickReplyPanel from "@/components/quick-reply/QuickReplyPanel";
import GroupMemberPanel from "@/components/group-chat/GroupMemberPanel";
import CheckpointPanel from "@/components/checkpoint/CheckpointPanel";
import MvuDebuggerPanel from "@/components/mvu/MvuDebuggerPanel";
import SessionGalleryDialog from "@/components/session-gallery/SessionGalleryDialog";
import type { DialogueMessage } from "@/types/character-dialogue";
import type { SessionGalleryItem } from "@/app/session/session-gallery";

interface Props {
  sessionId?: string;
  messages: DialogueMessage[];
  onExecuteQuickReply: (index: number) => Promise<void>;
  galleryState: {
    open: boolean;
    items: SessionGalleryItem[];
    target?: { character?: string; group?: string };
  };
  onCloseGallery: () => void;
  chatPanelProps: React.ComponentProps<typeof CharacterChatPanel>;
}

export default function SessionChatView({
  sessionId,
  messages,
  onExecuteQuickReply,
  galleryState,
  onCloseGallery,
  chatPanelProps,
}: Props) {
  return (
    <>
      <CharacterChatPanel
        {...chatPanelProps}
        footerSlot={(
          <>
            <QuickReplyPanel
              dialogueId={sessionId}
              onExecuteQuickReply={onExecuteQuickReply}
            />
            <GroupMemberPanel dialogueId={sessionId} />
            <CheckpointPanel
              dialogueId={sessionId}
              messages={messages}
            />
            <MvuDebuggerPanel
              dialogueId={sessionId}
              messages={messages}
            />
          </>
        )}
      />
      <SessionGalleryDialog
        open={galleryState.open}
        items={galleryState.items}
        target={galleryState.target}
        onClose={onCloseGallery}
      />
    </>
  );
}
