/**
 * @input  React, UI 基础组件
 * @output CharactersPanel
 * @pos    功能面板组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                         CharactersPanel 角色卡面板                  ║
 * ║  提供统一入口跳转至角色卡列表/聊天视图，避免散落按钮。                 ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import Link from "next/link";
import { Users, MessageCircle } from "lucide-react";
import { PanelLinkCard, PanelShell } from "@/components/panels/shared/PanelShell";

export function CharactersPanel() {
  return (
    <PanelShell
      title="角色卡"
      description="统一入口：查看、管理角色卡，或回到首页进入会话。"
      bodyClassName="space-y-3"
      embeddedHeaderMode="none"
    >
      <PanelLinkCard
        href="/character-cards"
        icon={<Users size={16} />}
        label="角色卡列表"
        meta="管理 / 编辑"
      />
      <PanelLinkCard
        href="/"
        icon={<MessageCircle size={16} />}
        label="选择会话"
        meta="开始对话"
      />
    </PanelShell>
  );
}
