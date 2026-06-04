/**
 * @input  @/components, lucide-react
 * @output MessageHeader, normalizeRole, pickRoleTone, renderRoleLabel
 * @pos    单条消息的展示辅助模块
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    Message Item Presentation Helpers                     ║
 * ║                                                                           ║
 * ║  职责：收口头像、操作按钮与角色 tone 这些纯展示 Implementation 细节          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import type { ReactNode } from "react";
import { ArrowUp, RefreshCw, User } from "lucide-react";
import { CharacterAvatarBackground } from "@/components/CharacterAvatarBackground";
import { Button } from "@/components/ui/button";
import type { MessageCharacter, MessageRoleKind } from "./types";

interface MessageHeaderProps {
  character: MessageCharacter;
  showRegenerateButton: boolean;
  onTruncate: () => void;
  onRegenerate: () => void;
  t: (key: string) => string;
  headerSlot?: ReactNode;
}

export function MessageHeader({
  character,
  showRegenerateButton,
  onTruncate,
  onRegenerate,
  t,
  headerSlot,
}: MessageHeaderProps) {
  return (
    <div className="flex items-center mb-2">
      <div className="w-8 h-8 rounded-full overflow-hidden mr-2">
        {character.avatar_path ? (
          <CharacterAvatarBackground avatarPath={character.avatar_path} />
        ) : (
          <DefaultAvatar />
        )}
      </div>

      <div className="flex items-center">
        <span className={"text-sm font-medium text-cream "}>
          {character.name}
        </span>
        {showRegenerateButton && headerSlot}
      </div>

      <div className="flex items-center">
        <ActionButton
          onClick={onTruncate}
          tooltip={t("characterChat.jumpToMessage")}
          icon={<TruncateIcon />}
          hoverColor="success"
        />
        {showRegenerateButton && (
          <ActionButton
            onClick={onRegenerate}
            tooltip={t("characterChat.regenerateMessage")}
            icon={<RegenerateIcon />}
            hoverColor="primary"
          />
        )}
      </div>
    </div>
  );
}

export function normalizeRole(role: string): MessageRoleKind {
  const key = (role || "").toLowerCase();
  if (key === "user") return "assistant";
  if (key === "assistant" || key === "impersonate") return "assistant";
  if (key === "system" || key === "sys") return "system";
  if (key === "narrator" || key === "comment") return "narrator";
  return "custom";
}

export function pickRoleTone(role: Exclude<MessageRoleKind, "assistant">) {
  if (role === "system") {
    return {
      badgeBg: "bg-muted",
      badgeText: "text-muted-foreground",
      badgeBorder: "border-border",
      bodyBg: "bg-muted/60",
      bodyBorder: "border-border",
      caption: "SYSTEM MESSAGE",
    };
  }

  if (role === "narrator") {
    return {
      badgeBg: "bg-sidebar",
      badgeText: "text-foreground",
      badgeBorder: "border-border/60",
      bodyBg: "bg-sidebar",
      bodyBorder: "border-border/60",
      caption: "NARRATOR",
    };
  }

  return {
    badgeBg: "bg-card",
    badgeText: "text-foreground",
    badgeBorder: "border-border",
    bodyBg: "bg-card",
    bodyBorder: "border-border",
    caption: "CUSTOM ROLE",
  };
}

export function renderRoleLabel(role: string): string {
  if (!role) return "role";
  return role.length > 16 ? `${role.slice(0, 15)}...` : role;
}

function DefaultAvatar() {
  return (
    <div className="w-full h-full flex items-center justify-center ">
      <User className="h-4 w-4 text-ink" />
    </div>
  );
}

interface ActionButtonProps {
  onClick: () => void;
  tooltip: string;
  icon: ReactNode;
  hoverColor: "success" | "primary";
}

function ActionButton({ onClick, tooltip, icon, hoverColor }: ActionButtonProps) {
  const colorClass = hoverColor === "success"
    ? "hover:text-success"
    : "hover:text-primary-300";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      className={`ml-1 h-6 w-6 text-ink-soft bg-surface border-stroke hover:border-stroke-strong group relative ${colorClass}`}
      data-tooltip={tooltip}
    >
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-overlay text-cream text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap border border-border">
        {tooltip}
      </div>
      {icon}
    </Button>
  );
}

function TruncateIcon() {
  return <ArrowUp className="w-3 h-3" />;
}

function RegenerateIcon() {
  return <RefreshCw className="w-3 h-3" />;
}
