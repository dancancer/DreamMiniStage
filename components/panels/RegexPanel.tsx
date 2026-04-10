/**
 * @input  @/components
 * @output RegexPanel
 * @pos    功能面板组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                           RegexPanel 正则面板                       ║
 * ║  提醒正则脚本需在聊天上下文内编辑，提供快捷跳转。                     ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useSearchParams } from "next/navigation";
import { Regex, MessageSquare } from "lucide-react";
import RegexScriptEditor from "@/components/RegexScriptEditor";
import { useSessionStore } from "@/lib/store/session-store";

export function RegexPanel() {
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
          <Regex size={16} />
          全局规则工作区
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          正则脚本默认按全局规则维护；如果你是从会话里进入，这里也不会强制绑死在当前角色。
        </div>
        {characterId ? (
          <div className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare size={14} />
            当前会话角色：{characterName}
          </div>
        ) : null}
      </div>
      <RegexScriptEditor
        onClose={() => {}}
        characterName={characterId ? characterName : "全局规则"}
        characterId={characterId || "__global_regex_workspace__"}
        initialSourceTab="global"
        allowScopedTab={Boolean(characterId)}
        defaultGlobalOwnerId="__global_regex_workspace__"
        globalLabel="全局规则"
      />
    </div>
  );
}
