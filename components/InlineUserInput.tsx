/**
 * InlineUserInput Component
 * 
 * Provides an elegant inline user input interface inspired by cursor-style design.
 * Features:
 * - Cursor-style inline appearance
 * - Option buttons with hover effects
 * - Custom input with bottom border design
 * - Smooth animations and transitions
 * - Keyboard support (Enter to send)
 * - Loading states with spinner
 * - Dynamic width matching content length
 * - Auto line wrapping for long content
 * 
 * Dependencies:
 * - React hooks: For state management
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import { PenSquare, Send, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InlineUserInputProps {
  question: string;
  options?: string[];
  onResponse: (response: string) => void;
  isLoading?: boolean;
}

/**
 * InlineUserInput component for elegant user interaction
 * 
 * @param {InlineUserInputProps} props - Component props
 * @returns {JSX.Element} The inline user input component
 */
const InlineUserInput: React.FC<InlineUserInputProps> = ({ 
  question, 
  options, 
  onResponse, 
  isLoading, 
}) => {
  const [customInput, setCustomInput] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [customInput]);

  const handleCustomSubmit = () => {
    if (customInput.trim()) {
      onResponse(customInput.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCustomSubmit();
    }
  };

  return (
    <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Redesigned Question Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3 text-primary-400 font-medium text-sm">
          <PenSquare className="w-4 h-4" />
          <span>需要您的输入</span>
        </div>
        <div className="pl-6 text-sm leading-relaxed text-primary-soft/90">
          {question}
        </div>
      </div>

      {/* Elegant Reference Options */}
      {options && options.length > 0 && (
        <div className="pl-6 mb-4">
          <div className="bg-black/20 border border-primary-500/25 rounded-xl p-4 mb-3 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-gradient-to-b from-primary-400 to-primary-600 rounded-full"></div>
              <span className="text-xs text-primary-400/90 font-medium tracking-wide">参考选项</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {options.map((option, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="inline-flex items-center px-3 py-1.5 h-auto text-xs text-primary-soft/80 bg-black/30 border border-primary-500/20 rounded-full hover:bg-black/40 hover:border-primary-400/40 hover:text-cream animate-in fade-in zoom-in-95"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => {
                    setCustomInput(option);
                    if (inputRef.current) {
                      inputRef.current.focus();
                    }
                  }}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Elegant Compact Input */}
      <div className="pl-6 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="relative inline-flex items-center min-w-[280px] max-w-lg">
          <input
            ref={inputRef}
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入您的回复..."
            disabled={isLoading}
            className="w-full pl-4 pr-12 py-2.5 text-sm text-cream bg-black/30 border border-primary-500/30 rounded-full focus:outline-none focus:border-primary-400/60 focus:bg-black/40 placeholder-primary-soft/60 transition-all duration-300 hover:border-primary-500/40"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCustomSubmit}
            disabled={isLoading || !customInput.trim()}
            className="absolute right-1.5 p-1.5 h-auto w-auto text-primary-400 rounded-full hover:bg-primary-500/15"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-primary-soft/40 border-t-primary-400 rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InlineUserInput; 
