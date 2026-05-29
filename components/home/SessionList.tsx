/**
 * @input  @/types, @/app
 * @output SessionList, SessionListProps
 * @pos    首页会话管理组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                           SessionList                                     ║
 * ║                                                                           ║
 * ║  会话列表组件 - 展示所有会话卡片                                             ║
 * ║  支持：空状态展示、响应式网格布局                                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import { MessageSquarePlus } from "lucide-react";
import { SessionWithCharacter } from "@/types/session";
import SessionCard from "./SessionCard";
import { useLanguage } from "@/app/i18n";
import { StageEmptyState } from "@/components/ui/stage-empty-state";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SessionListProps {
  sessions: SessionWithCharacter[];
  onSessionClick: (sessionId: string) => void;
  onSessionEdit: (session: SessionWithCharacter) => void;
  onSessionDelete: (session: SessionWithCharacter) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   空状态组件
   ═══════════════════════════════════════════════════════════════════════════ */

function EmptyState() {
  const { t, language } = useLanguage();

  return (
    <StageEmptyState
      icon={<MessageSquarePlus className="h-9 w-9" />}
      eyebrow={language === "zh" ? "会话舞台" : "Story Flow"}
      title={t("homePage.noSessions")}
      description={t("homePage.noSessionsHint")}
      note={language === "zh"
        ? "从角色开始一次新会话，会比直接堆积素材更容易进入叙事节奏。"
        : "Starting from a character keeps the narrative momentum clearer than piling up raw materials first."}
      primaryAction={{
        label: language === "zh" ? "导入 Agent" : "Import Agent",
        href: "/story-agent-import",
      }}
      className="mx-auto w-full max-w-3xl xl:mx-0"
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

const SessionList: React.FC<SessionListProps> = ({
  sessions,
  onSessionClick,
  onSessionEdit,
  onSessionDelete,
}) => {
  if (sessions.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 animate-in fade-in duration-500">
      {sessions.map((session, index) => (
        <div
          key={session.id}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <SessionCard
            session={session}
            onClick={() => onSessionClick(session.id)}
            onEdit={() => onSessionEdit(session)}
            onDelete={() => onSessionDelete(session)}
          />
        </div>
      ))}
    </div>
  );
};

export default SessionList;
