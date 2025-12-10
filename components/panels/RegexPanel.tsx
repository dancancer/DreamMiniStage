/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                           RegexPanel 正则面板                       ║
 * ║  提醒正则脚本需在聊天上下文内编辑，提供快捷跳转。                     ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Regex, MessageSquare } from "lucide-react";
import RegexScriptEditor from "@/components/RegexScriptEditor";

export function RegexPanel() {
  const searchParams = useSearchParams();
  const characterId = searchParams.get("id");
  const characterName = searchParams.get("name") || "当前角色";

  if (!characterId) {
    return (
      <div className="h-full overflow-auto p-4 space-y-3">
        <div>
          <div className="text-base font-semibold text-foreground">正则脚本</div>
          <div className="text-sm text-muted-foreground">
            请先在聊天视图选择角色后再编辑正则脚本。
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <Regex size={16} />
            需要会话上下文才能编辑。
          </div>
          <Link
            href="/"
            className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <span className="flex items-center gap-2">
              <MessageSquare size={16} />
              选择会话
            </span>
            <span className="text-xs text-muted-foreground">绑定会话</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <RegexScriptEditor
        onClose={() => {}}
        characterName={characterName}
        characterId={characterId}
      />
    </div>
  );
}
