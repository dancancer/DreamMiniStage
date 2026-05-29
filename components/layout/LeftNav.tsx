/**
 * @input  @/contexts, @/lib, @/components
 * @output LeftNav
 * @pos    应用布局组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                              LeftNav 导航栏                         ║
 * ║  数据驱动导航：路由项直接跳转，设置项触发右侧抽屉。                   ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  MessageCircle,
  Users,
  UserCircle,
  BookOpen,
  WandSparkles,
  Regex,
  SlidersHorizontal,
  Settings2,
} from "lucide-react";
import { useUiLayout, type PanelId } from "@/contexts/ui-layout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  id: string;
  label: string;
  href?: string;
  panel?: PanelId;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "基础",
    items: [
      { id: "home", label: "首页", href: "/", icon: <Home size={16} /> },
      { id: "chat", label: "会话", href: "/session", icon: <MessageCircle size={16} /> },
    ],
  },
  {
    label: "创作/世界",
    items: [
      { id: "characters", label: "角色卡", href: "/character-cards", icon: <Users size={16} /> },
      { id: "storyAgentImport", label: "Agent 导入", href: "/story-agent-import", icon: <WandSparkles size={16} /> },
      { id: "personas", label: "用户角色", href: "/personas", icon: <UserCircle size={16} /> },
      { id: "worldbook", label: "世界书", panel: "worldbook", icon: <BookOpen size={16} /> },
    ],
  },
  {
    label: "自动化/规则",
    items: [
      { id: "regex", label: "正则脚本", panel: "regex", icon: <Regex size={16} /> },
      { id: "presets", label: "预设", panel: "presets", icon: <SlidersHorizontal size={16} /> },
    ],
  },
  {
    label: "设置",
    items: [
      { id: "settingsHub", label: "设置菜单", panel: "settingsHub", icon: <Settings2 size={16} /> },
    ],
  },
];

interface LeftNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LeftNav({ isOpen, onClose }: LeftNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { activePanel, openPanel } = useUiLayout();

  const handleSelect = (item: NavItem) => {
    if (item.href) {
      router.push(item.href);
      onClose();
      return;
    }

    if (item.panel) {
      openPanel(item.panel);
      onClose();
    }
  };

  const renderItem = (item: NavItem) => {
    // 根路径精确匹配，其他路径前缀匹配
    const isActiveRoute = item.href
      ? item.href === "/"
        ? pathname === "/"
        : pathname.startsWith(item.href)
      : false;
    const isActivePanel = item.panel ? activePanel === item.panel : false;
    const isActive = isActiveRoute || isActivePanel;

    const content = (
      <div
        className={cn(
          "group flex min-h-11 items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm transition-[background-color,border-color,color,transform] duration-200",
          isActive
            ? "border-primary/35 bg-primary/12 text-primary"
            : "border-transparent text-ink hover:-translate-y-px hover:border-border/80 hover:bg-card/55 hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
            isActive
              ? "border-primary/25 bg-primary/12 text-primary"
              : "border-transparent bg-background/45 text-ink-soft group-hover:bg-background/70 group-hover:text-foreground",
          )}
        >
          {item.icon}
        </span>
        <span className="truncate font-medium">{item.label}</span>
      </div>
    );

    if (item.href) {
      return (
        <Link
          key={item.id}
          href={item.href}
          onClick={onClose}
          className="block"
          aria-current={isActiveRoute ? "page" : undefined}
        >
          {content}
        </Link>
      );
    }

    return (
      <Button
        key={item.id}
        variant="ghost"
        onClick={() => handleSelect(item)}
        className="block h-auto w-full justify-start p-0"
      >
        {content}
      </Button>
    );
  };

  const renderGroupLabel = (label: string) => (
    <div className="flex items-center gap-2.5 px-3">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.2em] text-primary/70">
        {label}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-border/70 to-transparent" />
    </div>
  );

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-foreground/45 backdrop-blur-sm transition-opacity md:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "stage-sidebar-surface fixed z-40 flex h-full w-[18rem] flex-col border-r border-border/75 transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:static md:translate-x-0",
        )}
      >
        <div className="flex h-[4.25rem] items-center justify-between border-b border-border/70 px-5">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold tracking-[0.02em] text-foreground">
              DreamMiniStage
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-[0.26em] text-primary/75">
              Immersive Story Stage
            </p>
          </div>
          <Button
            variant="ghost"
            className="h-11 rounded-full border border-border/70 px-3 text-sm text-muted-foreground hover:border-primary/20 hover:bg-primary/10 hover:text-foreground md:hidden"
            onClick={onClose}
            aria-label="关闭导航"
          >
            关闭
          </Button>
        </div>

        <nav aria-label="主导航" className="flex-1 space-y-4 overflow-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              {renderGroupLabel(group.label)}
              <div className="space-y-1">
                {group.items.map(renderItem)}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-border/70 px-5 pb-5 pt-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-primary/60">
            Stage Note
          </div>
          <p className="mt-2 text-xs leading-6 text-ink-soft">
            故事不该被工具打断。
          </p>
        </div>
      </aside>
    </>
  );
}
