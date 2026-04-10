/**
 * @input  @/lib, @/app, @/function
 * @output GlobalWorldBookPanel
 * @pos    全局世界书面板
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    GlobalWorldBookPanel                                    ║
 * ║  全局世界书管理：创建/编辑/删除/启用/禁用全局世界书                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/lib/store/toast-store";
import { useLanguage } from "@/app/i18n";
import {
  listGlobalWorldBooks,
  createGlobalWorldBook,
  deleteGlobalWorldBook,
  toggleGlobalWorldBook,
  copyCharacterToGlobal,
  updateGlobalWorldBookMetadata,
  type GlobalWorldBookMetadata,
} from "@/function/worldbook/global-management";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface GlobalWorldBookPanelProps {
  onClose?: () => void;
  onEditWorldBook?: (globalKey: string, name: string) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export default function GlobalWorldBookPanel({
  onClose,
  onEditWorldBook,
}: GlobalWorldBookPanelProps) {
  const { t, fontClass } = useLanguage();
  const [books, setBooks] = useState<GlobalWorldBookMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newBookName, setNewBookName] = useState("");
  const [newBookDescription, setNewBookDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // ════════════════════════════════════════════════════════════════════════
  // 加载全局世界书列表
  // ════════════════════════════════════════════════════════════════════════
  const loadBooks = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await listGlobalWorldBooks();
      setBooks(result);
    } catch (error) {
      console.error("[GlobalWB] Failed to load books:", error);
      toast.error("加载全局世界书失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // ════════════════════════════════════════════════════════════════════════
  // 创建新的全局世界书
  // ════════════════════════════════════════════════════════════════════════
  const handleCreate = async () => {
    if (!newBookName.trim()) {
      toast.error("请输入世界书名称");
      return;
    }

    setIsCreating(true);
    try {
      const result = await createGlobalWorldBook(
        newBookName.trim(),
        newBookDescription.trim() || undefined,
      );

      if (result.success) {
        toast.success("创建成功");
        setIsCreateModalOpen(false);
        setNewBookName("");
        setNewBookDescription("");
        await loadBooks();
      } else {
        toast.error(result.error || "创建失败");
      }
    } catch (error) {
      console.error("[GlobalWB] Create failed:", error);
      toast.error("创建失败");
    } finally {
      setIsCreating(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // 删除全局世界书
  // ════════════════════════════════════════════════════════════════════════
  const handleDelete = async (globalKey: string, name: string) => {
    if (!confirm(`确定要删除全局世界书"${name}"吗？此操作不可撤销。`)) {
      return;
    }

    try {
      const result = await deleteGlobalWorldBook(globalKey);

      if (result.success) {
        toast.success("删除成功");
        await loadBooks();
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      console.error("[GlobalWB] Delete failed:", error);
      toast.error("删除失败");
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // 切换启用/禁用
  // ════════════════════════════════════════════════════════════════════════
  const handleToggle = async (globalKey: string, currentEnabled: boolean) => {
    try {
      const result = await toggleGlobalWorldBook(globalKey, !currentEnabled);

      if (result.success) {
        toast.success(currentEnabled ? "已禁用" : "已启用");
        await loadBooks();
      } else {
        toast.error(result.error || "操作失败");
      }
    } catch (error) {
      console.error("[GlobalWB] Toggle failed:", error);
      toast.error("操作失败");
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // 渲染
  // ════════════════════════════════════════════════════════════════════════

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 ${fontClass}`}>
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
        {/* ──────────────────────────────────────────────────────────────── */}
        {/* 标题栏 */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-border bg-muted-surface/60 px-6 py-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              全局世界书管理
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              管理在所有会话中生效的世界书
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-2xl text-ink-soft transition-colors hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* 操作按钮 */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <div className="border-b border-border px-6 py-4">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
          >
            + 新建全局世界书
          </button>
        </div>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* 世界书列表 */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="py-12 text-center text-ink-soft">
              加载中...
            </div>
          ) : books.length === 0 ? (
            <div className="py-12 text-center text-ink-soft">
              暂无全局世界书，点击上方按钮创建
            </div>
          ) : (
            <div className="space-y-4">
              {books.map((book) => (
                <div
                  key={book.id}
                  className="rounded-lg border border-border bg-muted-surface/35 p-4 transition-colors hover:border-stroke-strong hover:bg-muted-surface/55"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-foreground">
                          {book.name}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            book.enabled
                              ? "border border-success/30 bg-success/10 text-success"
                              : "border border-border bg-overlay text-ink-soft"
                          }`}
                        >
                          {book.enabled ? "已启用" : "已禁用"}
                        </span>
                      </div>
                      {book.description && (
                        <p className="mt-1 text-sm text-ink-soft">
                          {book.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-xs text-ink-soft/80">
                        <span>{book.entryCount} 个条目</span>
                        <span>创建于 {new Date(book.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(book.id, book.enabled)}
                        className={`px-3 py-1.5 text-sm rounded transition-colors ${
                          book.enabled
                            ? "bg-overlay text-ink-soft hover:bg-muted-surface"
                            : "bg-accent/20 hover:bg-accent/30 text-accent-foreground"
                        }`}
                      >
                        {book.enabled ? "禁用" : "启用"}
                      </button>
                      {onEditWorldBook && (
                        <button
                          onClick={() => onEditWorldBook(book.id, book.name)}
                          className="px-3 py-1.5 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded transition-colors"
                        >
                          编辑条目
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(book.id, book.name)}
                        className="rounded bg-destructive px-3 py-1.5 text-sm text-destructive-foreground transition-colors hover:bg-destructive/90"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────── */}
      {/* 创建模态框 */}
      {/* ──────────────────────────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/20">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground">
            <h3 className="mb-4 text-xl font-bold text-foreground">
              创建全局世界书
            </h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  名称 *
                </label>
                <input
                  type="text"
                  value={newBookName}
                  onChange={(e) => setNewBookName(e.target.value)}
                  placeholder="例如：奇幻世界观"
                  className="w-full rounded-lg border border-border bg-muted-surface px-3 py-2 text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  描述（可选）
                </label>
                <textarea
                  value={newBookDescription}
                  onChange={(e) => setNewBookDescription(e.target.value)}
                  placeholder="简短描述这个世界书的内容"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-muted-surface px-3 py-2 text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors disabled:opacity-50"
              >
                {isCreating ? "创建中..." : "创建"}
              </button>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setNewBookName("");
                  setNewBookDescription("");
                }}
                disabled={isCreating}
                className="flex-1 rounded-lg bg-overlay px-4 py-2 text-ink-soft transition-colors hover:bg-muted-surface"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
