/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       DialoguePlaceholderCard                             ║
 * ║  对话树空态卡片：提示信息 + 可选按钮                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { Button } from "@/components/ui/button";

interface DialoguePlaceholderCardProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  fontClass: string;
  serifFontClass: string;
}

export function DialoguePlaceholderCard({
  title,
  description,
  actionText,
  onAction,
  fontClass,
  serifFontClass,
}: DialoguePlaceholderCardProps) {
  return (
    <div className="h-[calc(100%-6rem)] w-full flex flex-col items-center justify-center">
      <div className="text-center p-6 border border-border rounded-md bg-surface max-w-lg">
        <h4 className={"text-primary-400 mb-3 "}>{title}</h4>
        <p className={`text-cream mb-4 ${fontClass}`}>{description}</p>
        {actionText && onAction && (
          <Button
            variant="outline"
            onClick={onAction}
            className={`px-4 py-2 bg-muted-surface hover:bg-overlay text-primary-400 border border-primary-700 ${fontClass}`}
          >
            {actionText}
          </Button>
        )}
      </div>
    </div>
  );
}
