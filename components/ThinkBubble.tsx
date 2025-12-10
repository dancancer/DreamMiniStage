/**
 * ThinkBubble Component
 * 
 * A collapsible component to display character thinking content.
 * Shows the internal thought process of AI characters with expand/collapse functionality.
 */

"use client";

import { useState } from "react";
import { ChevronRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  thinkingContent: string;
  characterName: string;
  fontClass: string;
  serifFontClass: string;
  t: (key: string) => string;
}

export default function ThinkBubble({
  thinkingContent,
  characterName,
  fontClass,
  serifFontClass,
  t,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render if no thinking content
  if (!thinkingContent || thinkingContent.trim() === "") {
    return null;
  }

  return (
    <div className="mb-3">
      <Button
        variant="outline"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-2"
      >
        <ChevronRight className={`h-4 w-4 ${isExpanded ? "rotate-90" : ""}`} />
        <Lightbulb className="h-4 w-4" strokeWidth={1.5} />
        <span className={`text-sm ${fontClass}`}>
          {characterName} {t("characterChat.thinking") || "的思考"}
          {!isExpanded && (
            <span className="text-xs ml-1">
              ({thinkingContent.length} {t("characterChat.characters") || "字符"})
            </span>
          )}
        </span>
      </Button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-96 opacity-100 mt-2" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-ember/80 border border-border/40 rounded-md p-4 backdrop-blur-sm">
          <div className={"text-sm text-primary-soft leading-relaxed whitespace-pre-wrap "}>
            {thinkingContent}
          </div>
        </div>
      </div>
    </div>
  );
} 
