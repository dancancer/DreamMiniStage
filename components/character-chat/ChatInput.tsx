/**
 * @input  @/utils, @/components
 * @output ChatInput
 * @pos    角色对话交互组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Chat Input Component                               ║
 * ║                                                                            ║
 * ║  聊天输入区域：输入框、建议列表、发送按钮、受限高度的工具带                    ║
 * ║  职责单一：收口输入区交互，避免底部工具继续挤压消息滚动区                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useMemo,
  useState,
} from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { trackButtonClick, trackFormSubmit } from "@/utils/google-analytics";
import { Button } from "@/components/ui/button";

// ============================================================================
//                              类型定义
// ============================================================================

interface ChatInputProps {
  userInput: string;
  setUserInput: (val: string) => void;
  isSending: boolean;
  suggestedInputs: string[];
  onSubmit: (e: React.FormEvent) => void;
  onSuggestedInput: (input: string) => void;
  fontClass: string;
  t: (key: string) => string;
  children?: React.ReactNode; // 用于放置 ControlPanel
}

// ============================================================================
//                              主组件
// ============================================================================

export default function ChatInput({
  userInput,
  setUserInput,
  isSending,
  suggestedInputs,
  onSubmit,
  onSuggestedInput,
  fontClass,
  t,
  children,
}: ChatInputProps) {
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(false);
  const toolItems = useMemo(
    () => flattenToolItems(children),
    [children],
  );

  const handleSubmit = useCallback((event: React.FormEvent) => {
    trackFormSubmit("page", "提交表单");
    onSubmit(event);
  }, [onSubmit]);

  const handleSuggestionClick = useCallback((input: string) => {
    trackButtonClick("page", "建议输入");
    onSuggestedInput(input);
  }, [onSuggestedInput]);

  const toggleSuggestions = useCallback(() => {
    setSuggestionsCollapsed((prev) => !prev);
  }, []);

  const showSuggestions = suggestedInputs.length > 0 && !isSending;

  return (
    <div className="sticky bottom-0 z-10 mt-4 shrink-0 border-t border-border bg-background/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* 建议输入区域 */}
      {showSuggestions && (
        <SuggestionsArea
          suggestions={suggestedInputs}
          collapsed={suggestionsCollapsed}
          onToggle={toggleSuggestions}
          onSelect={handleSuggestionClick}
          isSending={isSending}
          fontClass={fontClass}
        />
      )}

      {/* 输入表单 */}
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="flex gap-2 sm:gap-3">
          <InputField
            value={userInput}
            onChange={setUserInput}
            disabled={isSending}
            placeholder={t("characterChat.typeMessage") || "Type a message..."}
          />
          <SubmitButton
            isSending={isSending}
            disabled={!userInput.trim()}
            label={t("characterChat.send") || "Send"}
          />
        </div>

      </form>

      <ToolRail items={toolItems} />
    </div>
  );
}

// ============================================================================
//                              子组件
// ============================================================================

interface SuggestionsAreaProps {
  suggestions: string[];
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (input: string) => void;
  isSending: boolean;
  fontClass: string;
}

function SuggestionsArea({ suggestions, collapsed, onToggle, onSelect, isSending, fontClass }: SuggestionsAreaProps) {
  return (
    <div className="relative max-w-4xl mx-auto">
      {/* 折叠按钮 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute -top-10 right-0 bg-overlay hover:bg-muted-surface text-primary-soft hover:text-cream p-1.5 h-auto w-auto border border-border hover:border-border hover:shadow z-10"
        aria-label={collapsed ? "展开建议" : "收起建议"}
      >
        <CollapseIcon collapsed={collapsed} />
      </Button>

      {/* 建议列表 */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${collapsed ? "max-h-0 opacity-0 mb-0" : "max-h-40 opacity-100 mb-6"}`}>
        <div className="flex flex-wrap gap-2.5">
          {suggestions.map((input, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => onSelect(input)}
              disabled={isSending}
              className={`bg-overlay hover:bg-muted-surface text-primary-soft hover:text-cream py-1.5 px-4 h-auto text-xs border border-border hover:border-border hover:shadow menu-item ${fontClass}`}
            >
              {input}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    <ChevronUp className="h-4 w-4" />
  ) : (
    <ChevronDown className="h-4 w-4" />
  );
}

interface InputFieldProps {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
  placeholder: string;
}

function InputField({ value, onChange, disabled, placeholder }: InputFieldProps) {
  return (
    <div className="flex-grow magical-input relative group">
      <div className="absolute -inset-0.5 bg-primary/10 rounded-md blur opacity-0 group-hover:opacity-100 transition duration-300" />
      <input
        type="text"
        value={value}
        id="send_textarea"
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-tour="chat-input"
        className="relative z-[1] w-full rounded-md border border-border bg-overlay px-3 py-2 text-cream text-sm leading-tight transition-all duration-300 focus:border-primary-soft focus:outline-none group-hover:border-border sm:px-4 sm:py-2.5"
        disabled={disabled}
      />
    </div>
  );
}

interface SubmitButtonProps {
  isSending: boolean;
  disabled: boolean;
  label: string;
}

function SubmitButton({ isSending, disabled, label }: SubmitButtonProps) {
  if (isSending) {
    return <LoadingSpinner />;
  }

  return (
    <Button
      type="submit"
      variant="outline"
      disabled={disabled}
      className="portal-button relative overflow-hidden bg-overlay hover:bg-muted-surface text-primary-soft hover:text-cream py-2 px-3 sm:px-4 h-auto text-sm border border-border hover:border-border"
    >
      {label}
    </Button>
  );
}

function LoadingSpinner() {
  return (
    <div className="relative w-8 h-8 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full border-2 border-t-primary-bright border-r-primary-soft border-b-ink-soft border-l-transparent animate-spin" />
      <div className="absolute inset-1 rounded-full border-2 border-t-ink-soft border-r-primary-bright border-b-primary-soft border-l-transparent animate-spin-slow" />
    </div>
  );
}

interface ToolRailProps {
  items: React.ReactNode[];
}

function ToolRail({ items }: ToolRailProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      data-chat-tool-rail="true"
      className="mt-3 overflow-x-auto pb-2 sm:mt-4"
    >
      <div className="mx-auto flex max-w-4xl items-start gap-3">
        {items.map((item, index) => (
          <div
            key={getToolRailItemKey(item, index)}
            data-chat-tool-slot="true"
            className="min-w-[18rem] shrink-0 self-stretch [&>*]:max-h-[18rem] [&>*]:w-[min(32rem,85vw)] [&>*]:min-w-[18rem] [&>*]:overflow-y-auto [&>*]:overscroll-contain"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function getToolRailItemKey(item: React.ReactNode, index: number): string {
  if (isValidElement(item) && item.key != null) {
    return `tool-${index}-${String(item.key)}`;
  }
  return `tool-${index}`;
}

function flattenToolItems(input: React.ReactNode): React.ReactNode[] {
  return Children.toArray(input).flatMap((child) => {
    if (!isValidElement(child)) {
      return [child];
    }
    if (child.type !== Fragment) {
      return [child];
    }
    const fragmentProps = child.props as { children?: React.ReactNode };
    return flattenToolItems(fragmentProps.children);
  });
}
