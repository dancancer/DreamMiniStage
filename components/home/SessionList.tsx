/**
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
  const { t, fontClass } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-muted-surface flex items-center justify-center mb-4">
        <MessageSquarePlus className="w-8 h-8 text-ink-soft" />
      </div>
      <h3 className="text-lg text-cream-soft mb-2">
        {t("homePage.noSessions")}
      </h3>
      <p className={`text-sm text-ink-soft text-center ${fontClass}`}>
        {t("homePage.noSessionsHint")}
      </p>
    </div>
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
