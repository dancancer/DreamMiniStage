/**
 * @input  @/components, @/lib
 * @output SearchToolbar, SearchToolbar
 * @pos    提示词查看器组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        搜索工具栏组件                                      ║
 * ║                                                                           ║
 * ║  提供搜索输入、匹配模式切换、刷新等控制功能                                 ║
 * ║  设计原则：简洁直观、无特殊情况、统一的交互模式                             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback } from "react";
import { Search, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { safeExecute } from "./PromptViewerErrorBoundary";
import type { SearchToolbarProps } from "@/types/prompt-viewer";

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export function SearchToolbar({
  searchInput,
  onSearchChange,
  matchedOnly,
  onMatchedOnlyChange,
  onRefresh,
  isLoading,
}: SearchToolbarProps) {
  // ========== 事件处理 ==========

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(event.target.value);
    },
    [onSearchChange],
  );

  const handleClearSearch = useCallback(() => {
    onSearchChange("");
  }, [onSearchChange]);

  const handleRefresh = useCallback(() => {
    if (!isLoading) {
      onRefresh();
    }
  }, [onRefresh, isLoading]);

  const handleMatchedOnlyChange = useCallback(
    (checked: boolean) => {
      onMatchedOnlyChange(checked);
    },
    [onMatchedOnlyChange],
  );

  // ========== 渲染 ==========

  return (
    <div className="flex items-center gap-3 p-4 border-b border-border bg-background/50">
      {/* 搜索输入区域 */}
      <div className="flex-1 relative">
        <SearchInput
          value={searchInput}
          onChange={handleInputChange}
          onClear={handleClearSearch}
          disabled={isLoading}
        />
      </div>

      {/* 控制按钮区域 */}
      <div className="flex items-center gap-3">
        {/* 仅显示匹配切换 */}
        <MatchedOnlyToggle
          checked={matchedOnly}
          onChange={handleMatchedOnlyChange}
          disabled={isLoading}
        />

        {/* 刷新按钮 */}
        <RefreshButton
          onClick={handleRefresh}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   子组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface SearchInputProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  disabled: boolean;
}

function SearchInput({ value, onChange, onClear, disabled }: SearchInputProps) {
  const hasValue = value.length > 0;

  return (
    <div className="relative group">
      {/* 魔法边框效果 */}
      <div className="absolute -inset-0.5 bg-primary/10 rounded-md blur opacity-0 group-hover:opacity-100 transition duration-300" />
      
      {/* 搜索图标 */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
        <Search className="h-4 w-4" />
      </div>

      {/* 输入框 */}
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder="搜索提示词内容..."
        disabled={disabled}
        className={cn(
          // 基础样式
          "w-full pl-10 pr-10 py-2 text-sm",
          "bg-overlay border border-border rounded-md",
          "text-cream placeholder:text-muted-foreground",
          "focus:outline-none focus:border-primary-soft",
          "transition-all duration-300 relative z-1",
          // 悬停效果
          "group-hover:border-border",
          // 禁用状态
          disabled && "opacity-50 cursor-not-allowed",
        )}
      />

      {/* 清除按钮 */}
      {hasValue && !disabled && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
          aria-label="清除搜索"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

interface MatchedOnlyToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
}

function MatchedOnlyToggle({ checked, onChange, disabled }: MatchedOnlyToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="matched-only"
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="data-[state=checked]:bg-primary-900/50 data-[state=checked]:border-primary-500"
      />
      <label
        htmlFor="matched-only"
        className={cn(
          "text-sm text-foreground cursor-pointer select-none",
          "transition-colors duration-200",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        仅显示匹配
      </label>
    </div>
  );
}

interface RefreshButtonProps {
  onClick: () => void;
  isLoading: boolean;
}

function RefreshButton({ onClick, isLoading }: RefreshButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        "bg-overlay hover:bg-muted-surface",
        "text-primary-soft hover:text-cream",
        "border-border hover:border-border",
        "transition-all duration-200",
      )}
      aria-label="刷新提示词"
    >
      <RefreshCw 
        className={cn(
          "h-4 w-4",
          isLoading && "animate-spin",
        )} 
      />
      <span className="ml-1.5">刷新</span>
    </Button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出
   ═══════════════════════════════════════════════════════════════════════════ */

export default SearchToolbar;
