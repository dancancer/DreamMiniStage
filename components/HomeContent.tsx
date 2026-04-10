/**
 * @input  @/app, @/components, @/lib, @/types
 * @output HomeContent
 * @pos    首页主内容区
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
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
  const { t, fontClass, language } = useLanguage();
  const router = useRouter();

  // ========== 本地状态 ==========
  const [mounted, setMounted] = useState(false);

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

  const headerEyebrow = language === "zh" ? "Session Stage" : "Session Stage";
  const headerTitle = language === "zh" ? "会话舞台" : "Story Sessions";
  const headerDescription = language === "zh"
    ? "继续最近一段叙事，或从角色卡开启一幕新的对话。首页负责铺开线索，不抢走故事本身。"
    : "Resume the latest narrative thread, or open a new scene from a character card. Home sets the stage without stealing the spotlight.";

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* ========== 装饰元素 ========== */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute left-10 top-10 h-px w-28 bg-gradient-to-r from-primary/60 to-transparent" />
        <div className="absolute left-10 top-14 opacity-10">
          <Star size={18} fill="var(--color-primary-bright)" color="var(--color-primary-bright)" />
        </div>
        <div className="absolute right-14 top-22 opacity-10">
          <Star size={16} fill="var(--color-primary-bright)" color="var(--color-primary-bright)" />
        </div>
        <div className="absolute bottom-16 left-[26%] opacity-10">
          <Circle size={14} color="var(--color-sky)" />
        </div>
        <div className="absolute bottom-8 right-[18%] opacity-10">
          <Circle size={22} color="var(--color-ink-soft)" />
        </div>
      </div>

      {/* ========== 主内容区 ========== */}
      <main
        className="relative z-20 flex-1 overflow-y-auto"
        aria-labelledby="home-heading"
      >
        <div className="mx-auto flex max-w-[80rem] flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
          <div className="grid gap-8 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] xl:items-start xl:gap-10">
            {/* ========== 序章区域 ========== */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="max-w-xl xl:sticky xl:top-8">
                <div className="flex items-center gap-3">
                  <span className="h-px w-12 bg-gradient-to-r from-primary/65 to-transparent" />
                  <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-primary/75">
                    {headerEyebrow}
                  </p>
                </div>

                <h1 id="home-heading" className="mt-4 text-3xl font-semibold tracking-[0.02em] text-foreground sm:text-4xl lg:text-[2.75rem]">
                  {headerTitle}
                </h1>

                <p className={`mt-4 max-w-lg text-sm leading-7 text-ink sm:text-base ${fontClass}`}>
                  {headerDescription}
                </p>

                <p className={`mt-5 max-w-md text-xs leading-6 text-ink-soft sm:text-sm ${fontClass}`}>
                  {language === "zh"
                    ? "舞台应该先承接叙事，再承接管理动作。新建入口保留在视线尽头，而不是压在标题上。"
                    : "The stage should carry the story first and the management controls second. Keep the creation entry nearby, but not louder than the scene itself."}
                </p>
              </div>
            </div>

            {/* ========== 舞台区域 ========== */}
            <div className="min-w-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex justify-start xl:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewSession}
                  className={`${fontClass} h-11 gap-2 rounded-full border-border/70 bg-background/60 px-5 text-foreground hover:border-primary/20 hover:bg-primary/10 sm:h-10`}
                >
                  <Plus className="h-4 w-4" />
                  {t("homePage.newSession")}
                </Button>
              </div>

              {/* ========== 会话列表 ========== */}
              {isLoading ? (
                <div className="flex h-64 items-center justify-center animate-in fade-in duration-300">
                  <div className="relative h-16 w-16">
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
        </div>
      </main>

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
