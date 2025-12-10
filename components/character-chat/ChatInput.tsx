/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Chat Input Component                               ║
 * ║                                                                            ║
 * ║  聊天输入区域：输入框、建议列表、发送按钮                                    ║
 * ║  职责单一：只处理用户输入相关的 UI 和交互                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useCallback } from "react";
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
    <div className="sticky bottom-0 border-t border-border py-6 px-5 z-5 mt-4 ">
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

        {/* 控制面板插槽 */}
        <div className="mt-3 sm:mt-5 flex justify-start gap-1.5 sm:gap-2 md:gap-3 max-w-4xl mx-auto relative">
          {children}
        </div>
      </form>
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
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-400/20 via-primary-500/5 to-primary-400/10 rounded-md blur opacity-0 group-hover:opacity-100 transition duration-300" />
      <input
        type="text"
        value={value}
        id="send_textarea"
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-tour="chat-input"
        className="w-full bg-overlay border border-border rounded-md py-2 sm:py-2.5 px-3 sm:px-4 text-cream text-sm leading-tight focus:outline-none focus:border-primary-soft  relative z-1 transition-all duration-300 group-hover:border-border"
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
