/**
 * @input  @/components
 * @output AgentUserInput
 * @pos    Agent 用户输入组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

"use client";

import { useState } from "react";
import { Send, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AgentUserInputProps {
  question: string;
  options?: string[];
  onResponse: (response: string) => void;
  isLoading?: boolean;
}

export default function AgentUserInput({ question, options, onResponse, isLoading }: AgentUserInputProps) {
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [customInput, setCustomInput] = useState<string>("");
  const [inputMode, setInputMode] = useState<"options" | "custom">(options && options.length > 0 ? "options" : "custom");

  const handleSubmit = () => {
    if (isLoading) return;
    
    const response = inputMode === "options" ? selectedOption : customInput;
    if (response.trim()) {
      onResponse(response.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="mb-4 rounded-md border border-accent/20 bg-accent/10 p-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start space-x-3 mb-4">
        <div className="p-2 rounded-md bg-accent/20 text-sky">
          <ArrowRight className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h4 className="mb-2 text-sm font-medium text-foreground">Agent is asking for input:</h4>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{question}</p>
        </div>
      </div>

      {/* Options Mode */}
      {options && options.length > 0 && (
        <div className="space-y-3">
          <div className="flex space-x-2 text-xs">
            <Button
              variant="ghost"
              onClick={() => setInputMode("options")}
              className={`h-auto px-3 py-1 rounded-full ${
                inputMode === "options"
                  ? "bg-primary-500/20 text-primary-400"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              Choose from options
            </Button>
            <Button
              variant="ghost"
              onClick={() => setInputMode("custom")}
              className={`h-auto px-3 py-1 rounded-full ${
                inputMode === "custom"
                  ? "bg-primary-500/20 text-primary-400"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              Custom input
            </Button>
          </div>

          {inputMode === "options" && (
            <div className="grid gap-2">
              {options.map((option, index) => (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => setSelectedOption(option)}
                  className={`h-auto justify-start text-left p-3 animate-in fade-in slide-in-from-left-5 ${
                    selectedOption === option
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border bg-background/80 text-muted-foreground hover:bg-muted/70 hover:border-primary/30 hover:text-foreground"
                  }`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm">{option}</span>
                    {selectedOption === option && (
                      <div className="w-2 h-2 bg-primary-400 rounded-full" />
                    )}
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom Input Mode */}
      {inputMode === "custom" && (
        <div className="space-y-3">
          <div className="relative">
            <textarea
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your response..."
              className="min-h-[80px] max-h-[160px] w-full resize-none rounded-md border border-border bg-background/80 p-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/40"
              disabled={isLoading}
            />
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end mt-4">
        <Button
          onClick={handleSubmit}
          disabled={
            isLoading || 
            (inputMode === "options" && !selectedOption) || 
            (inputMode === "custom" && !customInput.trim())
          }
          className="h-auto bg-primary text-primary-foreground py-2 px-4 font-medium text-sm hover:bg-primary/90"
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary-foreground/70" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Send Response</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
} 
