/**
 * @input  react, components/CharacterChatPanel, components/session-gallery/SessionGalleryDialog, components/quick-reply/QuickReplyPanel, components/group-chat/GroupMemberPanel, components/checkpoint/CheckpointPanel
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
import dynamic from "next/dynamic";
import CharacterChatPanel from "@/components/CharacterChatPanel";
import type { SessionGalleryItem } from "@/app/session/session-gallery";

const LazySessionGalleryDialog = dynamic(
  () => import("@/components/session-gallery/SessionGalleryDialog"),
  {
    ssr: false,
    loading: () => null,
  },
);

interface Props {
  galleryState: {
    open: boolean;
    items: SessionGalleryItem[];
    target?: { character?: string; group?: string };
  };
  onCloseGallery: () => void;
  chatPanelProps: React.ComponentProps<typeof CharacterChatPanel>;
}

export default function SessionChatView({
  galleryState,
  onCloseGallery,
  chatPanelProps,
}: Props) {
  return (
    <>
      <CharacterChatPanel {...chatPanelProps} />
      <LazySessionGalleryDialog
        open={galleryState.open}
        items={galleryState.items}
        target={galleryState.target}
        onClose={onCloseGallery}
      />
    </>
  );
}
