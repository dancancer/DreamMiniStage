/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       DialogueNodeComponent                                ║
 * ║                                                                            ║
 * ║  对话树单节点渲染组件：展开/跳转/编辑/当前路径高亮                            ║
 * ║  从 DialogueTreeModal.tsx 提取的独立组件                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { CornerDownRight, ChevronDown, ChevronRight } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { trackButtonClick } from "@/utils/google-analytics";
import { Button } from "@/components/ui/button";

// ============================================================================
//                              类型定义
// ============================================================================

export interface DialogueNodeData {
  label: string;
  fullContent: string;
  userInput: string;
  assistantResponse: string;
  parsedContent: any;
  onEditClick: (id: string) => void;
  onJumpClick: (id: string) => void;
  isCurrentPath: boolean;
  characterId: string;
}

// ============================================================================
//                              样式工具
// ============================================================================

function getNodeColors(id: string, isCurrentPath: boolean) {
  if (id === "root") {
    return {
      border: "border-purple-700",
      hoverBorder: "hover:border-purple-500",
      text: "text-purple-200",
      expandIcon: "text-purple-400",
      jumpButton: "text-purple-400 hover:text-purple-300",
      handle: "!bg-purple-500 !border-purple-700",
      hoverText: "hover:text-purple-300",
    };
  }
  if (isCurrentPath) {
    return {
      border: "border-red-800",
      hoverBorder: "hover:border-red-600",
      text: "text-red-200",
      expandIcon: "text-red-400",
      jumpButton: "text-red-400 hover:text-red-300",
      handle: "!bg-red-500 !border-red-700",
      hoverText: "hover:text-red-300",
    };
  }
  return {
    border: "border-border",
    hoverBorder: "hover:border-border",
    text: "text-text-muted",
    expandIcon: "text-primary-700",
    jumpButton: "text-primary-700 hover:text-primary-600",
    handle: "!bg-primary-700 !border-primary-900",
    hoverText: "hover:text-primary-700",
  };
}

// ============================================================================
//                              主组件
// ============================================================================

export function DialogueNodeComponent({ id, data }: NodeProps<DialogueNodeData>) {
  const { t, fontClass, serifFontClass } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [showRootTooltip, setShowRootTooltip] = useState(false);

  const colors = getNodeColors(id, data.isCurrentPath);

  const steps = data.label
    .split(/——>|-->|->|→/)
    .map((step) => step.trim())
    .filter((step) => step.length > 0);

  const handleNodeClick = useCallback(() => {
    data.onEditClick(id);
  }, [data, id]);

  const handleToggleExpand = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleJumpClick = useCallback(
    async (event: React.MouseEvent) => {
      event.stopPropagation();

      if (id === "root") {
        setShowRootTooltip(true);
        setTimeout(() => setShowRootTooltip(false), 3000);
        return;
      }

      if (isJumping) return;

      try {
        setIsJumping(true);
        await data.onJumpClick(id);
      } finally {
        setIsJumping(false);
      }
    },
    [data, id, isJumping],
  );

  return (
    <div
      className={` border ${colors.border} rounded-md p-3  w-72 ${colors.hoverBorder} transition-all duration-300 relative cursor-pointer ${fontClass} ${data.isCurrentPath ? "bg-opacity-100" : "bg-opacity-70"}`}
      onClick={handleNodeClick}
    >
      {/* Root 节点提示 */}
      {showRootTooltip && (
        <div className="absolute -top-14 right-0 z-20 bg-surface border border-primary-700 rounded-md p-2  max-w-[200px] text-xs text-primary-400 animate-fade-in">
          <div className="relative">
            {t("dialogue.rootNodeCannotJump")}
            <div className="absolute -bottom-6 right-4 w-0 h-0 border-8 border-transparent border-t-primary-700"></div>
          </div>
        </div>
      )}

      {/* 跳转按钮 */}
      <div className="absolute top-2 right-2 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            trackButtonClick("DialogueTreeModal", "跳转到节点");
            handleJumpClick(e);
          }}
          className={`${colors.jumpButton} p-1 h-auto w-auto rounded-full hover:bg-muted-surface`}
          title={t("dialogue.jumpToNode")}
          disabled={isJumping}
        >
          {isJumping ? (
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-primary-400 animate-spin"></div>
          ) : (
            <CornerDownRight className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* 顶部连接点 */}
      <Handle type="target" position={Position.Top} id="a" className={`w-2 h-2 ${colors.handle}`} />

      {/* 节点内容 */}
      <div
        className={`${colors.text} text-sm  ${colors.hoverText} transition-colors duration-300 flex items-center`}
        onClick={handleToggleExpand}
      >
        <div className={`w-5 h-5 mr-2 flex-shrink-0 ${colors.expandIcon} bg-surface rounded-full border ${colors.border} flex items-center justify-center`}>
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </div>
        {steps.length > 0 ? (
          <ol className={"list-decimal list-inside ml-1  text-sm"}>
            {steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        ) : (
          <div className={" text-sm truncate max-w-[200px]"}>
            {data.label || t("dialogue.node")}
          </div>
        )}
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="mt-3 p-3 bg-surface rounded border border-stroke-strong max-h-60 overflow-y-auto fantasy-scrollbar">
          {data.assistantResponse && (
            <div>
              <div className={`text-ink-soft text-xs ${fontClass} mb-1`}>
                {t("dialogue.assistantResponse") || "助手回复"}:
              </div>
              <p className={`${data.isCurrentPath ? "text-primary" : "text-ink-soft"} text-xs ${fontClass} leading-relaxed`}>
                {data.assistantResponse}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 底部连接点 */}
      <Handle type="source" position={Position.Bottom} id="b" className={`w-2 h-2 ${colors.handle}`} />
    </div>
  );
}
