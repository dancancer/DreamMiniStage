/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                         CharactersPanel 角色卡面板                  ║
 * ║  提供统一入口跳转至角色卡列表/聊天视图，避免散落按钮。                 ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import Link from "next/link";
import { Users, MessageCircle } from "lucide-react";

export function CharactersPanel() {
  return (
    <div className="h-full overflow-auto p-4 space-y-3">
      <div>
        <div className="text-base font-semibold text-foreground">角色卡</div>
        <div className="text-sm text-muted-foreground">
          统一入口：查看/管理角色卡，或直接进入聊天。
        </div>
      </div>

      <div className="space-y-2">
        <Link
          href="/character-cards"
          className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-2">
            <Users size={16} />
            角色卡列表
          </span>
          <span className="text-xs text-muted-foreground">管理/编辑</span>
        </Link>

        <Link
          href="/"
          className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-2">
            <MessageCircle size={16} />
            选择会话
          </span>
          <span className="text-xs text-muted-foreground">开始对话</span>
        </Link>
      </div>
    </div>
  );
}
