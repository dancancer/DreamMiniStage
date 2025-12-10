/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                      AdvancedSettingsPanel 高级设置面板             ║
 * ║  汇总高级入口，含标签颜色编辑指引及聊天视图跳转。                     ║
 * ║  Requirements: 3.3                                                  ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Settings2, MessageSquare } from "lucide-react";

export function AdvancedSettingsPanel() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");

  if (!sessionId) {
    return (
      <div className="h-full overflow-auto p-4 space-y-3">
        <div>
          <div className="text-base font-semibold text-foreground">高级设置</div>
          <div className="text-sm text-muted-foreground">
            请先在聊天视图选择角色后再打开高级设置。
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <Settings2 size={16} />
            需要会话上下文才能编辑。
          </div>
          <Link
            href="/"
            className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <span className="flex items-center gap-2">
              <MessageSquare size={16} />
              前往首页
            </span>
            <span className="text-xs text-muted-foreground">选择会话</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-3">
      <div>
        <div className="text-base font-semibold text-foreground">高级设置</div>
        <div className="text-sm text-muted-foreground">
          高级偏好将在聊天上下文中生效；标签颜色已在专用面板提供。
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <Settings2 size={16} />
          在聊天视图中按需开启高级选项。
        </div>
        <Link
          href={`/session?id=${sessionId}`}
          className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-2">
            <MessageSquare size={16} />
            返回聊天
          </span>
          <span className="text-xs text-muted-foreground">应用设置</span>
        </Link>
      </div>
    </div>
  );
}
