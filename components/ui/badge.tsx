/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                               Badge 组件                                   ║
 * ║  轻量标签：统一关键词/状态标识的颜色与尺寸                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "primary";
type BadgeSize = "xs" | "sm";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const variantMap: Record<BadgeVariant, string> = {
  neutral: "bg-coal text-primary-200 border-border",
  info: "bg-blue-900/40 text-blue-200 border border-blue-700/40",
  success: "bg-green-900/40 text-green-200 border border-green-700/40",
  warning: "bg-amber-900/30 text-amber-100 border border-amber-700/40",
  primary: "bg-primary/15 text-primary-200 border border-primary/30",
};

const sizeMap: Record<BadgeSize, string> = {
  xs: "px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-2xs",
  sm: "px-2.5 py-1 text-xs",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "neutral", size = "xs", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-md font-medium transition-colors",
          sizeMap[size],
          variantMap[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";
