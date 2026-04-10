/**
 * @input  @/types, @/components, @/app
 * @output SessionCard, SessionCardProps, formatLastActivity
 * @pos    首页会话管理组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
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
  const openLabel = t("sessionCard.open") === "sessionCard.open"
    ? "打开会话"
    : t("sessionCard.open");

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <article className="relative session-card transition-all duration-300">
      {/* ========== 操作按钮 ========== */}
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleEditClick}
          className="h-11 w-11 shrink-0 rounded-full bg-muted-surface text-primary-soft hover:bg-muted-surface hover:text-highlight sm:h-10 sm:w-10"
          title={t("sessionCard.edit")}
          aria-label={t("sessionCard.edit")}
        >
          <PencilLine className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleDeleteClick}
          className="h-11 w-11 shrink-0 rounded-full bg-muted-surface text-primary-soft hover:bg-muted-surface hover:text-danger sm:h-10 sm:w-10"
          title={t("sessionCard.delete")}
          aria-label={t("sessionCard.delete")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <button
        type="button"
        onClick={onClick}
        data-session-open="true"
        aria-label={`${openLabel}: ${session.name}`}
        className="group flex w-full flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
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
      </button>
    </article>
  );
};

export default SessionCard;
