/**
 * @input  @/components
 * @output WorldbookPanel
 * @pos    功能面板组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                         WorldbookPanel 世界书面板                   ║
 * ║  提醒需结合具体会话使用，可直接跳转聊天视图。                         ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Globe, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/store/toast-store";
import WorldBookEditor from "@/components/WorldBookEditor";
import { useSessionStore } from "@/lib/store/session-store";
import {
  createClientGlobalWorldBook,
  deleteClientGlobalWorldBook,
  listClientGlobalWorldBooks,
  toggleClientGlobalWorldBook,
  type GlobalWorldBookMetadata,
} from "@/lib/worldbook/global-client";
import { PanelCard, PanelShell } from "@/components/panels/shared/PanelShell";

export function WorldbookPanel() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");
  const getSessionById = useSessionStore((state) => state.getSessionById);
  const session = sessionId ? getSessionById(sessionId) : undefined;
  const characterId = session?.characterId || "";
  const dialogueId = session?.id || undefined;
  const characterName = session?.characterName || "当前角色";
  const [view, setView] = useState<"context" | "global">(characterId ? "context" : "global");
  const [books, setBooks] = useState<GlobalWorldBookMetadata[]>([]);
  const [selectedGlobalKey, setSelectedGlobalKey] = useState<string | null>(null);

  const loadBooks = useCallback(async () => {
    try {
      const nextBooks = await listClientGlobalWorldBooks();
      setBooks(nextBooks);
      setSelectedGlobalKey((current) => current || nextBooks[0]?.id || null);
    } catch (error) {
      console.error("[WorldbookPanel] Failed to load global world books:", error);
      toast.error("加载全局世界书失败");
    }
  }, []);

  useEffect(() => {
    if (view !== "global") {
      return;
    }

    void loadBooks();
  }, [loadBooks, view]);

  useEffect(() => {
    if (!characterId && view === "context") {
      setView("global");
    }
  }, [characterId, view]);

  const selectedGlobalBook = useMemo(
    () => books.find((book) => book.id === selectedGlobalKey) || null,
    [books, selectedGlobalKey],
  );

  const handleCreateGlobal = useCallback(async () => {
    const created = await createClientGlobalWorldBook("新的全局世界书");
    if (!created.success) {
      toast.error(created.error || "创建全局世界书失败");
      return;
    }

    await loadBooks();
    setSelectedGlobalKey(created.globalKey);
  }, [loadBooks]);

  if (view === "global") {
    return (
      <PanelShell
        title="全局世界书库"
        description="在这里维护跨角色、跨会话共享的世界设定。"
        actions={characterId ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setView("context")}
          >
            返回当前会话上下文
          </Button>
        ) : null}
        bodyClassName="p-0"
        embeddedHeaderMode={characterId ? "actions-only" : "none"}
      >
        <div className="flex h-full overflow-hidden">
          <div className="flex w-72 shrink-0 flex-col border-r border-border">
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <Button type="button" onClick={handleCreateGlobal} className="w-full justify-center">
                <Plus className="mr-2 h-4 w-4" />
                新建全局世界书
              </Button>

              {books.map((book) => (
                <PanelCard
                  key={book.id}
                  className={selectedGlobalKey === book.id ? "border-primary/40 bg-primary/5" : undefined}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setSelectedGlobalKey(book.id)}
                  >
                    <div className="text-sm font-medium text-foreground">{book.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {book.entryCount} 个条目
                    </div>
                  </button>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const result = await toggleClientGlobalWorldBook(book.id, !book.enabled);
                        if (!result.success) {
                          toast.error(result.error || "切换失败");
                          return;
                        }
                        await loadBooks();
                      }}
                    >
                      {book.enabled ? "禁用" : "启用"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const result = await deleteClientGlobalWorldBook(book.id);
                        if (!result.success) {
                          toast.error(result.error || "删除失败");
                          return;
                        }
                        await loadBooks();
                      }}
                    >
                      删除
                    </Button>
                  </div>
                </PanelCard>
              ))}
            </div>
          </div>

          <div className="min-w-0 flex-1 overflow-auto">
            {selectedGlobalBook ? (
              <WorldBookEditor
                onClose={() => {}}
                characterName={selectedGlobalBook.name}
                characterId={selectedGlobalBook.id}
                globalKey={selectedGlobalBook.id}
                initialBookLevel="global"
                availableBookLevels={["global"]}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                选择一个全局世界书开始编辑。
              </div>
            )}
          </div>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell
      title="当前会话世界书"
      description="这里维护当前角色与当前会话的世界书；全局设定请切到右侧的全局世界书库。"
      actions={(
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setView("global")}
        >
          打开全局世界书库
        </Button>
      )}
      bodyClassName="p-0"
      embeddedHeaderMode="actions-only"
    >
      <WorldBookEditor
        onClose={() => {}}
        characterName={characterName}
        characterId={characterId}
        dialogueKey={dialogueId || undefined}
      />
    </PanelShell>
  );
}
