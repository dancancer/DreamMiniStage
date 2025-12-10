/**
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

  const title = useMemo(() => {
    // 会话页面（新路由 /session 或旧路由 /character）不显示标题
    if (pathname.startsWith("/session") || pathname === "/character") return "";
    if (pathname.startsWith("/character-cards")) return "角色卡";
    if (pathname === "/") return "首页";
    return "工作区";
  }, [pathname]);

  const toggleLanguage = () => {
    const next = language === "zh" ? "en" : "zh";
    setLanguage(next);
    document.documentElement.lang = next;
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleNav}
          className="md:hidden"
          aria-label="打开导航"
        >
          <Menu size={18} />
        </Button>
        {headerContent ? (
          <div className="flex items-center gap-3 min-w-0">{headerContent}</div>
        ) : (
          title ? <div className="text-sm font-semibold text-foreground">{title}</div> : null
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={toggleLanguage} aria-label="切换语言">
          <Languages size={16} />
          <span className="hidden sm:inline">{language === "zh" ? "中文" : "English"}</span>
        </Button>

        <Button variant="outline" size="sm" onClick={toggleTheme} aria-label="切换主题">
          {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
          <span className="hidden sm:inline">{theme === "dark" ? "暗色" : "浅色"}</span>
        </Button>
      </div>
    </header>
  );
}
