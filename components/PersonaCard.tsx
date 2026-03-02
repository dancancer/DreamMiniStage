/**
 * @input  @/lib
 * @output PersonaCard, PersonaCard, PersonaCardCompact
 * @pos    人格卡片展示组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          Persona Card Component                           ║
 * ║                                                                            ║
 * ║  展示单个 Persona 的卡片组件                                                 ║
 * ║  支持选中、默认、锁定等状态显示                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React from "react";
import Image from "next/image";
import { Check, Star, Lock, MoreVertical } from "lucide-react";
import type { Persona, PersonaLockType } from "@/lib/models/persona-model";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface PersonaCardProps {
  /** Persona 数据 */
  persona: Persona;
  /** 是否被选中 */
  isSelected?: boolean;
  /** 是否是默认 Persona */
  isDefault?: boolean;
  /** 是否是当前激活的 Persona */
  isActive?: boolean;
  /** 锁定类型 */
  lockType?: PersonaLockType;
  /** 点击事件 */
  onClick?: () => void;
  /** 更多操作按钮点击 */
  onMoreClick?: (e: React.MouseEvent) => void;
  /** 卡片尺寸 */
  size?: "sm" | "md" | "lg";
  /** 是否显示描述 */
  showDescription?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   组件实现
   ═══════════════════════════════════════════════════════════════════════════ */

export const PersonaCard: React.FC<PersonaCardProps> = ({
  persona,
  isSelected = false,
  isDefault = false,
  isActive = false,
  lockType = "none",
  onClick,
  onMoreClick,
  size = "md",
  showDescription = true,
}) => {
  /* ─────────────────────────────────────────────────────────────────────────
     尺寸样式
     ───────────────────────────────────────────────────────────────────────── */
  const sizeStyles = {
    sm: {
      card: "p-2",
      avatar: "w-8 h-8",
      name: "text-xs",
      desc: "text-2xs",
    },
    md: {
      card: "p-3",
      avatar: "w-10 h-10",
      name: "text-sm",
      desc: "text-xs",
    },
    lg: {
      card: "p-4",
      avatar: "w-12 h-12",
      name: "text-base",
      desc: "text-sm",
    },
  };

  const styles = sizeStyles[size];

  /* ─────────────────────────────────────────────────────────────────────────
     渲染
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative flex items-start gap-3 rounded-lg border transition-all cursor-pointer",
        styles.card,
        isSelected
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/50 hover:bg-accent/50",
        isActive && "ring-2 ring-primary/30",
      )}
    >
      {/* ─── 头像 ─── */}
      <div className="relative flex-shrink-0">
        <div
          className={cn(
            "rounded-full overflow-hidden bg-muted",
            styles.avatar,
          )}
        >
          {persona.avatarPath ? (
            <Image
              src={persona.avatarPath}
              alt={persona.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 32px, 40px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              {persona.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* ─── 状态指示器 ─── */}
        {isDefault && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
            <Star className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>

      {/* ─── 内容 ─── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn("font-medium truncate", styles.name)}>
            {persona.name}
          </span>

          {/* ─── 锁定图标 ─── */}
          {lockType !== "none" && (
            <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          )}
        </div>

        {/* ─── 描述 ─── */}
        {showDescription && persona.description && (
          <p
            className={cn(
              "text-muted-foreground line-clamp-2 mt-0.5",
              styles.desc,
            )}
          >
            {persona.description}
          </p>
        )}
      </div>

      {/* ─── 选中标记 ─── */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <Check className="w-4 h-4 text-primary" />
        </div>
      )}

      {/* ─── 更多操作 ─── */}
      {onMoreClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoreClick(e);
          }}
          className="absolute top-2 right-2 p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   紧凑版卡片（用于下拉选择）
   ═══════════════════════════════════════════════════════════════════════════ */

interface PersonaCardCompactProps {
  persona: Persona;
  isSelected?: boolean;
  isDefault?: boolean;
  onClick?: () => void;
}

export const PersonaCardCompact: React.FC<PersonaCardCompactProps> = ({
  persona,
  isSelected = false,
  isDefault = false,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors",
        isSelected ? "bg-primary/10" : "hover:bg-accent",
      )}
    >
      {/* ─── 头像 ─── */}
      <div className="relative w-6 h-6 rounded-full overflow-hidden bg-muted flex-shrink-0">
        {persona.avatarPath ? (
          <Image
            src={persona.avatarPath}
            alt={persona.name}
            fill
            className="object-cover"
            sizes="24px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            {persona.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* ─── 名称 ─── */}
      <span className="flex-1 text-sm truncate">{persona.name}</span>

      {/* ─── 状态 ─── */}
      {isDefault && <Star className="w-3 h-3 text-yellow-500" />}
      {isSelected && <Check className="w-4 h-4 text-primary" />}
    </div>
  );
};

export default PersonaCard;
