/**
 * @input  @/app, @/contexts, @/lib, @/components
 * @output TopBar
 * @pos    应用布局组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                               TopBar 顶栏                           ║
 * ║  移动端导航开关 + 语言/主题切换常驻右上角。                          ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useMemo } from "react";
import { Menu, Languages, Sun, Moon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/app/i18n";
import { useTheme } from "@/contexts/ThemeContext";
import { useHeaderContent } from "@/contexts/header-content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TopBarProps {
  onToggleNav: () => void;
}

export default function TopBar({ onToggleNav }: TopBarProps) {
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { headerContent } = useHeaderContent();

  const routeMeta = useMemo(() => {
    if (pathname.startsWith("/session")) return { title: "会话", note: "继续当前叙事" };
    if (pathname.startsWith("/character-cards")) return { title: "角色卡", note: "安排登场角色" };
    if (pathname.startsWith("/personas")) return { title: "用户角色", note: "维持代入视角" };
    if (pathname === "/") return { title: "首页", note: "会话舞台总览" };
    return { title: "工作区", note: "保持叙事节奏" };
  }, [pathname]);

  const toggleLanguage = () => {
    const next = language === "zh" ? "en" : "zh";
    setLanguage(next);
    document.documentElement.lang = next;
  };

  const chromeButtonClass =
    "h-11 rounded-2xl border border-border/70 bg-background/55 px-3 text-ink hover:border-primary/20 hover:bg-primary/10 hover:text-foreground sm:h-10";

  return (
    <header className="stage-topbar-surface sticky top-0 z-20 flex h-[4.25rem] items-center justify-between border-b border-border/70 px-4 sm:px-5">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleNav}
          className="h-11 w-11 rounded-2xl border border-border/70 bg-background/55 text-ink-soft hover:border-primary/20 hover:bg-primary/10 hover:text-foreground md:hidden"
          aria-label="打开导航"
        >
          <Menu size={18} />
        </Button>
        {headerContent ? (
          <div className="min-w-0">{headerContent}</div>
        ) : (
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.28em] text-primary/75">
              {routeMeta.note}
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-foreground sm:text-base">
              {routeMeta.title}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLanguage}
          aria-label="切换语言"
          className={chromeButtonClass}
        >
          <Languages size={16} />
          <span className="hidden sm:inline">{language === "zh" ? "中文" : "English"}</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          aria-label="切换主题"
          className={cn(
            chromeButtonClass,
            theme === "dark" && "border-primary/20 bg-primary/12 text-primary",
          )}
        >
          {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
          <span className="hidden sm:inline">{theme === "dark" ? "暗色" : "浅色"}</span>
        </Button>
      </div>
    </header>
  );
}
