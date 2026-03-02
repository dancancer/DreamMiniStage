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
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 ${fontClass}`}>
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* ──────────────────────────────────────────────────────────────── */}
        {/* 标题栏 */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              全局世界书管理
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              管理在所有会话中生效的世界书
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl"
            >
              ×
            </button>
          )}
        </div>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* 操作按钮 */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            + 新建全局世界书
          </button>
        </div>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* 世界书列表 */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              加载中...
            </div>
          ) : books.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              暂无全局世界书，点击上方按钮创建
            </div>
          ) : (
            <div className="space-y-4">
              {books.map((book) => (
                <div
                  key={book.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {book.name}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            book.enabled
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {book.enabled ? "已启用" : "已禁用"}
                        </span>
                      </div>
                      {book.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {book.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{book.entryCount} 个条目</span>
                        <span>创建于 {new Date(book.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(book.id, book.enabled)}
                        className={`px-3 py-1.5 text-sm rounded transition-colors ${
                          book.enabled
                            ? "bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                            : "bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800"
                        }`}
                      >
                        {book.enabled ? "禁用" : "启用"}
                      </button>
                      {onEditWorldBook && (
                        <button
                          onClick={() => onEditWorldBook(book.id, book.name)}
                          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        >
                          编辑条目
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(book.id, book.name)}
                        className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              创建全局世界书
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  名称 *
                </label>
                <input
                  type="text"
                  value={newBookName}
                  onChange={(e) => setNewBookName(e.target.value)}
                  placeholder="例如：奇幻世界观"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  描述（可选）
                </label>
                <textarea
                  value={newBookDescription}
                  onChange={(e) => setNewBookDescription(e.target.value)}
                  placeholder="简短描述这个世界书的内容"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
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
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
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
