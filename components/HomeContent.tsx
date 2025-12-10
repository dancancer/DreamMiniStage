/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                           HomeContent                                     ║
 * ║                                                                           ║
 * ║  首页内容组件 - 会话管理中心                                                 ║
 * ║  功能：展示会话列表、新建会话、编辑/删除会话                                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Star, Circle } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/store/session-store";
import { SessionWithCharacter } from "@/types/session";
import {
  SessionList,
  SessionEditModal,
  SessionDeleteModal,
} from "@/components/home";

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HomeContent() {
  const { t, fontClass } = useLanguage();
  const router = useRouter();

  // ========== 本地状态 ==========
  const [mounted, setMounted] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // ========== 弹窗状态 ==========
  const [editingSession, setEditingSession] = useState<SessionWithCharacter | null>(null);
  const [deletingSession, setDeletingSession] = useState<SessionWithCharacter | null>(null);

  // ========== Session Store ==========
  const {
    sessions,
    isLoading,
    fetchAllSessions,
    updateSessionName,
    deleteSession,
  } = useSessionStore();

  // ========== 初始化 ==========
  useEffect(() => {
    setMounted(true);

    const yellowImg = new Image();
    const redImg = new Image();
    yellowImg.src = "/background_yellow.png";
    redImg.src = "/background_red.png";

    Promise.all([
      new Promise((resolve) => (yellowImg.onload = resolve)),
      new Promise((resolve) => (redImg.onload = resolve)),
    ]).then(() => {
      setImagesLoaded(true);
    });
  }, []);

  // ========== 加载会话列表 ==========
  useEffect(() => {
    if (mounted) {
      fetchAllSessions();
    }
  }, [mounted, fetchAllSessions]);

  // ========== 事件处理 ==========

  /**
   * 点击会话卡片 - 跳转到聊天页面
   * Requirements: 3.1, 3.2
   */
  const handleSessionClick = useCallback(
    (sessionId: string) => {
      router.push(`/session?id=${sessionId}`);
    },
    [router],
  );

  /**
   * 点击编辑按钮 - 打开编辑弹窗
   */
  const handleSessionEdit = useCallback((session: SessionWithCharacter) => {
    setEditingSession(session);
  }, []);

  /**
   * 点击删除按钮 - 打开删除确认弹窗
   */
  const handleSessionDelete = useCallback((session: SessionWithCharacter) => {
    setDeletingSession(session);
  }, []);

  /**
   * 保存会话名称
   * Requirements: 4.3, 4.4
   */
  const handleSaveSessionName = useCallback(
    async (name: string) => {
      if (editingSession) {
        await updateSessionName(editingSession.id, name);
      }
    },
    [editingSession, updateSessionName],
  );

  /**
   * 确认删除会话
   * Requirements: 5.2, 5.3
   */
  const handleConfirmDelete = useCallback(async () => {
    if (deletingSession) {
      await deleteSession(deletingSession.id);
    }
  }, [deletingSession, deleteSession]);

  /**
   * 点击新建会话按钮 - 跳转到角色卡选择页面
   * Requirements: 2.1
   */
  const handleNewSession = useCallback(() => {
    router.push("/character-cards?mode=create-session");
  }, [router]);

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full relative">
      {/* ========== 背景层 ========== */}
      <div
        className={`absolute inset-0 z-0 opacity-35 transition-opacity duration-500 ${
          imagesLoaded ? "opacity-35" : "opacity-0"
        }`}
      />
      <div
        className={`absolute inset-0 z-1 opacity-45 transition-opacity duration-500 mix-blend-multiply ${
          imagesLoaded ? "opacity-45" : "opacity-0"
        }`}
      />

      {/* ========== 装饰元素 ========== */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute top-10 left-10 opacity-5">
          <Star size={24} fill="var(--color-primary-bright)" color="var(--color-primary-bright)" />
        </div>
        <div className="absolute top-20 right-20 opacity-5">
          <Star size={20} fill="var(--color-primary-bright)" color="var(--color-primary-bright)" />
        </div>
        <div className="absolute bottom-20 left-1/4 opacity-5">
          <Circle size={16} color="var(--color-sky)" />
        </div>
        <div className="absolute bottom-10 right-1/4 opacity-5">
          <Circle size={24} color="var(--color-ink-soft)" />
        </div>
      </div>

      {/* ========== 主内容区 ========== */}
      <div className="flex-1 overflow-y-auto relative z-20">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* ========== 头部区域 ========== */}
          <div className="flex items-center justify-between mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h1 className="text-2xl font-cinzel magical-text">DreamMiniStage</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewSession}
              className={`${fontClass} gap-2`}
            >
              <Plus className="h-4 w-4" />
              {t("homePage.newSession")}
            </Button>
          </div>

          {/* ========== 会话列表 ========== */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64 animate-in fade-in duration-300">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-t-primary-bright border-r-primary-soft border-b-ink-soft border-l-transparent animate-spin" />
                <div className="absolute inset-2 rounded-full border-2 border-t-ink-soft border-r-primary-bright border-b-primary-soft border-l-transparent animate-spin-slow" />
              </div>
            </div>
          ) : (
            <SessionList
              sessions={sessions}
              onSessionClick={handleSessionClick}
              onSessionEdit={handleSessionEdit}
              onSessionDelete={handleSessionDelete}
            />
          )}
        </div>
      </div>

      {/* ========== 弹窗 ========== */}
      <SessionEditModal
        session={editingSession}
        isOpen={!!editingSession}
        onClose={() => setEditingSession(null)}
        onSave={handleSaveSessionName}
      />

      <SessionDeleteModal
        session={deletingSession}
        isOpen={!!deletingSession}
        onClose={() => setDeletingSession(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
