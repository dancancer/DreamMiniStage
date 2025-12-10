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
    <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-4 mb-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start space-x-3 mb-4">
        <div className="p-2 rounded-md bg-blue-500/20 text-blue-400">
          <ArrowRight className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h4 className="text-primary-soft font-medium text-sm mb-2">Agent is asking for input:</h4>
          <p className="text-primary-soft text-sm whitespace-pre-wrap">{question}</p>
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
                  : "bg-black/20 text-primary-soft/60 hover:text-primary-soft"
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
                  : "bg-black/20 text-primary-soft/60 hover:text-primary-soft"
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
                      ? "bg-primary-500/20 border-primary-500/40 text-primary-soft"
                      : "bg-black/20 border-primary-500/20 text-primary-soft/80 hover:bg-black/30 hover:border-primary-500/30"
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
              className="w-full bg-black/20 border border-primary-500/20 rounded-md p-3 text-primary-soft text-sm placeholder-primary-soft/40 resize-none min-h-[80px] max-h-[160px] focus:outline-none focus:border-primary-500/40"
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
          className="h-auto bg-gradient-to-r from-primary-500 to-orange-400 text-black py-2 px-4 font-medium text-sm hover:from-primary-400 hover:to-orange-300"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
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
