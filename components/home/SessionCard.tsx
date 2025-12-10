/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                           SessionCard                                     ║
 * ║                                                                           ║
 * ║  会话卡片组件 - 展示单个会话的核心信息                                        ║
 * ║  包含：会话名称、角色名称、头像、最后活动时间                                   ║
 * ║  支持：点击、编辑、删除操作                                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import { PencilLine, Trash2, UserRound } from "lucide-react";
import { SessionWithCharacter } from "@/types/session";
import { CharacterAvatarBackground } from "@/components/CharacterAvatarBackground";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/app/i18n";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SessionCardProps {
  session: SessionWithCharacter;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   辅助函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 格式化时间戳为相对时间或日期
 */
export function formatLastActivity(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;

  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onClick,
  onEdit,
  onDelete,
}) => {
  const { t, fontClass } = useLanguage();

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      onClick={onClick}
      className="relative session-card cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      {/* ========== 操作按钮 ========== */}
      <div className="absolute top-2 right-2 flex space-x-1 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleEditClick}
          className="p-1.5 h-auto w-auto bg-muted-surface hover:bg-muted-surface rounded-full text-primary-soft hover:text-highlight"
          title={t("sessionCard.edit")}
          aria-label={t("sessionCard.edit")}
        >
          <PencilLine className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDeleteClick}
          className="p-1.5 h-auto w-auto bg-muted-surface hover:bg-muted-surface rounded-full text-primary-soft hover:text-danger"
          title={t("sessionCard.delete")}
          aria-label={t("sessionCard.delete")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ========== 头像区域 ========== */}
      <div className="relative w-full overflow-hidden rounded aspect-4/5">
        {session.characterAvatar ? (
          <CharacterAvatarBackground avatarPath={session.characterAvatar} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted-surface">
            <UserRound className="h-16 w-16 text-ink" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* ========== 信息区域 ========== */}
      <div className="p-3">
        <h3 className="text-sm text-cream-soft line-clamp-1 magical-text">
          {session.name}
        </h3>
        <div className={`text-xs text-ink-soft mt-1 ${fontClass}`}>
          <span className="line-clamp-1">{session.characterName}</span>
        </div>
        <div className={`text-2xs text-ink-soft/70 mt-1 ${fontClass}`}>
          {formatLastActivity(session.updatedAt)}
        </div>
      </div>
    </div>
  );
};

export default SessionCard;
