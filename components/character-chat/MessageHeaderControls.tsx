/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    Message Header Controls Component                       ║
 * ║                                                                            ║
 * ║  消息头部控制按钮：流式输出、快速模型切换                                    ║
 * ║  职责单一：只处理消息头部的控制按钮渲染和交互                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback } from "react";
import { Zap, Waves } from "lucide-react";
import { trackButtonClick } from "@/utils/google-analytics";
import { Button } from "@/components/ui/button";

// ============================================================================
//                              类型定义
// ============================================================================

interface MessageHeaderControlsProps {
  streaming: boolean;
  fastModel: boolean;
  onToggleStreaming: () => void;
  onToggleFastModel: () => void;
  t: (key: string) => string;
}

// ============================================================================
//                              主组件
// ============================================================================

export default function MessageHeaderControls({
  streaming,
  fastModel,
  onToggleStreaming,
  onToggleFastModel,
  t,
}: MessageHeaderControlsProps) {
  const handleStreamingClick = useCallback(() => {
    onToggleStreaming();
    trackButtonClick("toggle_streaming", "流式输出切换");
  }, [onToggleStreaming]);

  const handleFastModelClick = useCallback(() => {
    onToggleFastModel();
    trackButtonClick("toggle_fastmodel", "快速模式切换");
  }, [onToggleFastModel]);

  return (
    <>
      {/* 流式输出切换 */}
      <ToggleButton
        active={streaming}
        onClick={handleStreamingClick}
        tooltip={streaming ? t("characterChat.disableStreaming") : t("characterChat.enableStreaming")}
        activeColor="primary"
        icon={<StreamIcon active={streaming} />}
      />

      {/* 快速模型切换 */}
      <ToggleButton
        active={fastModel}
        onClick={handleFastModelClick}
        tooltip={fastModel ? t("characterChat.disableFastModel") : t("characterChat.enableFastModel")}
        activeColor="blue"
        icon={<LightningIcon active={fastModel} />}
      />
    </>
  );
}

// ============================================================================
//                              子组件
// ============================================================================

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  tooltip: string;
  activeColor: "primary" | "blue";
  icon: React.ReactNode;
}

function ToggleButton({ active, onClick, tooltip, activeColor, icon }: ToggleButtonProps) {
  const colorStyles = {
    primary: {
      active: "text-primary-400 hover:text-primary-300 border-primary-400/60 hover:border-primary-300/70 hover:shadow-[0_0_8px_rgba(252,211,77,0.4)]",
      inactive: "text-ink-soft hover:text-primary-soft border-stroke hover:border-stroke-strong",
    },
    blue: {
      active: "text-blue-500 hover:text-blue-400 border-blue-500/60 hover:border-blue-400/70 hover:shadow-[0_0_8px_rgba(59,130,246,0.4)]",
      inactive: "text-ink-soft hover:text-primary-soft border-stroke hover:border-stroke-strong",
    },
  };

  const style = active ? colorStyles[activeColor].active : colorStyles[activeColor].inactive;

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      className={`mx-1 h-6 w-6 bg-surface group relative ${style}`}
      data-tooltip={tooltip}
    >
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-overlay text-cream text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap border border-border">
        {tooltip}
      </div>
      {icon}
    </Button>
  );
}

function StreamIcon({ active }: { active: boolean }) {
  return <Waves className={`w-3 h-3 ${active ? "text-primary-400" : ""}`} />;
}

function LightningIcon({ active }: { active: boolean }) {
  return <Zap className={`w-3 h-3 ${active ? "text-blue-500" : ""}`} />;
}
