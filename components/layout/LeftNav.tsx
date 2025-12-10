/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                              LeftNav 导航栏                         ║
 * ║  数据驱动导航：路由项直接跳转，设置项触发右侧抽屉。                   ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  MessageCircle,
  Users,
  BookOpen,
  Regex,
  SlidersHorizontal,
  Cpu,
  Puzzle,
  Palette,
  Settings2,
  Database,
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
      { id: "worldbook", label: "世界书", panel: "worldbook", icon: <BookOpen size={16} /> },
    ],
  },
  {
    label: "自动化/规则",
    items: [
      { id: "regex", label: "正则脚本", panel: "regex", icon: <Regex size={16} /> },
      { id: "presets", label: "预设", panel: "presets", icon: <SlidersHorizontal size={16} /> },
      { id: "modelSettings", label: "模型设置", panel: "modelSettings", icon: <Cpu size={16} /> },
      { id: "plugins", label: "插件管理", panel: "plugins", icon: <Puzzle size={16} /> },
    ],
  },
  {
    label: "外观/高级",
    items: [
      { id: "tagColors", label: "标签颜色", panel: "tagColors", icon: <Palette size={16} /> },
    ],
  },
  {
    label: "数据",
    items: [
      { id: "data", label: "数据管理", panel: "data", icon: <Database size={16} /> },
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
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
          isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
        )}
      >
        <span className="text-muted-foreground">{item.icon}</span>
        <span className="truncate">{item.label}</span>
      </div>
    );

    if (item.href) {
      return (
        <Link
          key={item.id}
          href={item.href}
          onClick={onClose}
          className="block"
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

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 transition-opacity md:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed z-40 flex h-full w-72 flex-col border-r border-border bg-background transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:static md:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="text-base font-semibold text-foreground">DreamMiniStage</div>
          <Button
            variant="ghost"
            className="h-auto p-2 text-sm text-muted-foreground hover:text-foreground md:hidden"
            onClick={onClose}
          >
            关闭
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map(renderItem)}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
