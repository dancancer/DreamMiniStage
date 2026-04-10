/**
 * @input  @/components
 * @output PresetsPanel
 * @pos    功能面板组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                           PresetsPanel 预设面板                     ║
 * ║  预设（含回复长度）与会话角色关联，提供聊天跳转入口。                 ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useSearchParams } from "next/navigation";
import { SlidersHorizontal, MessageSquare } from "lucide-react";
import PresetEditor from "@/components/PresetEditor";
import { useSessionStore } from "@/lib/store/session-store";

export function PresetsPanel() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");
  const getSessionById = useSessionStore((state) => state.getSessionById);
  const session = sessionId ? getSessionById(sessionId) : undefined;
  const characterId = session?.characterId || "";
  const characterName = session?.characterName || "当前角色";

  return (
    <div className="h-full overflow-auto">
      <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <SlidersHorizontal size={16} />
          全局预设工作区
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          预设和回复长度默认作为全局能力维护，不必从某个会话里才能进入。
        </div>
        {characterId ? (
          <div className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare size={14} />
            当前会话角色：{characterName}
          </div>
        ) : null}
      </div>
      <PresetEditor
        onClose={() => {}}
        characterName={characterName}
      />
    </div>
  );
}
