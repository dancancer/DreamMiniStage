/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        Sidebar Menu Item Component                        ║
 * ║                                                                           ║
 * ║  通用侧边栏菜单项 - 提供一致的交互和视觉反馈                                   ║
 * ║  支持: 图标 | 文字 | hover 动效 | collapsed 状态                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────────
 * 类型定义
 * ───────────────────────────────────────────────────────────────────────────── */

type AccentColor = "primary" | "purple" | "blue";

interface SidebarMenuItemProps {
  /** 图标元素 */
  icon: ReactNode;
  /** 显示文字 */
  label: string;
  /** 字体类名 */
  fontClass?: string;
  /** 点击回调 */
  onClick?: () => void;
  /** 链接地址 (与 onClick 互斥) */
  href?: string;
  /** 是否折叠状态 */
  isCollapsed?: boolean;
  /** 是否移动端 */
  isMobile?: boolean;
  /** 强调色 - 决定 hover 时的颜色主题 */
  accentColor?: AccentColor;
  /** 是否激活 */
  isActive?: boolean;
  /** 子元素 (如展开箭头) */
  suffix?: ReactNode;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 颜色映射 - 简洁的数据驱动而非条件分支
 * ───────────────────────────────────────────────────────────────────────────── */

const colorMap: Record<AccentColor, { gradient: string; line: string }> = {
  primary: {
    gradient: "from-primary-500/10",
    line: "via-primary-400",
  },
  purple: {
    gradient: "from-purple-500/10",
    line: "via-purple-400",
  },
  blue: {
    gradient: "from-blue-500/10",
    line: "via-blue-400",
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
 * 组件实现
 * ───────────────────────────────────────────────────────────────────────────── */

const SidebarMenuItem: React.FC<SidebarMenuItemProps> = ({
  icon,
  label,
  fontClass = "",
  onClick,
  href,
  isCollapsed = false,
  isMobile = false,
  accentColor = "primary",
  isActive = false,
  suffix,
}) => {
  const colors = colorMap[accentColor];
  const iconSize = isMobile ? "w-6 h-6" : "w-8 h-8";
  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const interactiveState = isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground";

  /* ─── 折叠态：仅显示图标 ─── */
  if (isCollapsed) {
    const Wrapper = href ? "a" : "button";
    const wrapperProps = href ? { href } : { onClick };

    return (
      <Wrapper
        {...wrapperProps}
        className={cn(
          "menu-item flex justify-center p-2 rounded-md cursor-pointer transition-all duration-300",
          interactiveState,
          focusRing,
        )}
      >
        <div
          className={cn(
            iconSize,
            "flex items-center justify-center text-cream bg-surface rounded-md border border-stroke  transition-all duration-300",
            isActive
              ? "border-accent text-accent-foreground shadow-[0_0_10px_rgba(0,0,0,0.35)]"
              : "hover:text-accent-foreground hover:border-accent ",
          )}
        >
          {icon}
        </div>
      </Wrapper>
    );
  }

  /* ─── 展开态：图标 + 文字 + 动效 ─── */
  const content = (
    <>
      {/* 背景渐变层 */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br via-transparent to-transparent rounded-md transition-opacity duration-300 z-0",
          colors.gradient,
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      />
      {/* 背景色层 */}
      <div
        className={cn(
          "absolute inset-0 w-full h-full bg-stroke transition-opacity duration-300 z-0",
          isActive ? "opacity-10" : "opacity-0 group-hover:opacity-10",
        )}
      />
      {/* 底部渐变线 */}
      <div
        className={cn(
          "absolute bottom-0 left-0 h-[1px] bg-gradient-to-r from-transparent to-transparent transition-all duration-500 z-5",
          colors.line,
          isActive ? "w-full opacity-100" : "w-0 group-hover:w-full",
        )}
      />
      {/* 内容区 */}
      <div className="relative z-5 flex items-center justify-between w-full">
        <div className="flex items-center">
          <div
            className={cn(
              iconSize,
              "flex items-center justify-center flex-shrink-0 text-cream bg-surface rounded-md border border-stroke  transition-all duration-300",
              isActive
                ? "border-accent text-accent-foreground shadow-[0_0_10px_rgba(0,0,0,0.35)]"
                : "group-hover:border-accent group-hover:text-accent-foreground group-",
            )}
          >
            {icon}
          </div>
          <div className="ml-2 transition-all duration-300 ease-in-out overflow-hidden">
            <span
              className={cn(
                "magical-text whitespace-nowrap block text-xs md:text-sm transition-colors duration-300",
                fontClass,
                isActive ? "text-accent-foreground" : "group-hover:text-accent-foreground",
              )}
            >
              {label}
            </span>
          </div>
        </div>
        {suffix}
      </div>
    </>
  );

  const baseClassName = cn(
    "menu-item relative group flex items-center w-full p-2 rounded-md overflow-hidden transition-all duration-300 cursor-pointer",
    interactiveState,
    focusRing,
  );

  /* ─── 链接 or 按钮 ─── */
  if (href) {
    return (
      <a href={href} className={baseClassName}>
        {content}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={baseClassName}>
      {content}
    </button>
  );
};

export default SidebarMenuItem;
