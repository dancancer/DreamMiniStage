/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Control Panel Component                            ║
 * ║                                                                            ║
 * ║  可展开的控制面板：剧情推进、视角设计、场景过渡、用户名设置                    ║
 * ║  设计原则：用配置数组驱动渲染，消除重复代码                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useCallback } from "react";
import { trackButtonClick } from "@/utils/google-analytics";
import { ArrowRight, Globe, Grid, User, ChevronUp, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================================================
//                              类型定义
// ============================================================================

interface PerspectiveMode {
  active: boolean;
  mode: "novel" | "protagonist";
}

interface ActiveModes {
  "story-progress": boolean;
  perspective: PerspectiveMode;
  "scene-setting": boolean;
  [key: string]: boolean | PerspectiveMode;
}

interface ControlPanelProps {
  activeModes: ActiveModes;
  setActiveModes: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  onOpenUserNameModal: () => void;
  onOpenScriptDebug: () => void;
  t: (key: string) => string;
}

// ============================================================================
//                              主组件
// ============================================================================

export default function ControlPanel({
  activeModes,
  setActiveModes,
  onOpenUserNameModal,
  onOpenScriptDebug,
  t,
}: ControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleStoryProgress = useCallback(() => {
    trackButtonClick("page", "切换故事进度");
    setActiveModes((prev) => ({ ...prev, "story-progress": !prev["story-progress"] }));
  }, [setActiveModes]);

  const togglePerspective = useCallback(() => {
    trackButtonClick("page", "切换视角");
    setActiveModes((prev) => {
      const perspective = prev["perspective"] as PerspectiveMode;
      if (!perspective.active) {
        return { ...prev, perspective: { active: true, mode: "novel" } };
      }
      if (perspective.mode === "novel") {
        return { ...prev, perspective: { active: true, mode: "protagonist" } };
      }
      return { ...prev, perspective: { active: false, mode: "novel" } };
    });
  }, [setActiveModes]);

  const toggleSceneSetting = useCallback(() => {
    trackButtonClick("page", "切换场景设置");
    setActiveModes((prev) => ({ ...prev, "scene-setting": !prev["scene-setting"] }));
  }, [setActiveModes]);

  const handleUserNameClick = useCallback(() => {
    trackButtonClick("page", "设置用户名称");
    onOpenUserNameModal();
  }, [onOpenUserNameModal]);

  const togglePanel = useCallback(() => {
    setIsExpanded((prev) => !prev);
    trackButtonClick("page", "切换控制面板");
  }, []);

  const perspective = activeModes["perspective"] as PerspectiveMode;

  return (
    <div className="relative">
      {/* 展开的控制按钮 */}
      <div className={`absolute bottom-full left-0 mb-2 z-50 transition-all duration-300 ease-in-out ${isExpanded ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"}`}>
        <div className="flex flex-col gap-2 bg-canvas/95 backdrop-blur-sm rounded-md p-2 border border-border/50 ">
          {/* 剧情推进 */}
          <ControlButton
            active={activeModes["story-progress"]}
            onClick={toggleStoryProgress}
            activeColor="primary"
            icon={<ArrowRight size={12} className="mr-1" />}
            label={t("characterChat.storyProgress") || "剧情推进"}
          />

          {/* 视角设计 */}
          <ControlButton
            active={perspective.active}
            onClick={togglePerspective}
            activeColor={perspective.mode === "novel" ? "success" : "info"}
            inactiveColor="success"
            icon={<Globe size={12} className="mr-1" />}
            label={getPerspectiveLabel(perspective, t)}
          />

          {/* 场景过渡 */}
          <ControlButton
            active={activeModes["scene-setting"]}
            onClick={toggleSceneSetting}
            activeColor="info"
            icon={<Grid size={12} className="mr-1" />}
            label={t("characterChat.sceneTransition")}
          />

          {/* 用户名称 */}
          <ControlButton
            active={false}
            onClick={handleUserNameClick}
            activeColor="primary"
            inactiveColor="primary-bright"
            icon={<User size={12} className="mr-1" />}
            label={t("characterChat.userNameSetting")}
          />
        </div>
      </div>

      {/* 主控制按钮 */}
      <Button
        variant="outline"
        onClick={togglePanel}
        className={`h-auto px-1.5 sm:px-2 md:px-4 py-1.5 text-xs ${isExpanded ? "bg-primary text-overlay border-primary shadow-[0_0_8px_rgba(209,163,92,0.5)]" : "bg-overlay text-primary border-border hover:border-primary"}`}
      >
        <span className="flex items-center">
          <ChevronUp size={12} className={`mr-1 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
          <span className="text-2xs sm:text-xs">{isExpanded ? "收起控制" : "展开控制"}</span>
        </span>
      </Button>

      {/* 调试按钮 */}
      <Button
        variant="outline"
        size="icon"
        onClick={onOpenScriptDebug}
        className="ml-2 h-auto px-2 py-1.5 border-border bg-overlay text-ink-soft hover:text-primary hover:border-primary"
        title="Script Debugger"
      >
        <Link2 size={12} />
      </Button>
    </div>
  );
}

// ============================================================================
//                              辅助组件
// ============================================================================

interface ControlButtonProps {
  active: boolean;
  onClick: () => void;
  activeColor: "primary" | "success" | "info";
  inactiveColor?: string;
  icon: React.ReactNode;
  label: string;
}

function ControlButton({ active, onClick, activeColor, inactiveColor, icon, label }: ControlButtonProps) {
  const colorMap = {
    primary: {
      active: "bg-primary text-overlay border-primary",
      inactive: `bg-overlay text-${inactiveColor || "primary"} border-border hover:border-primary`,
    },
    success: {
      active: "bg-success text-overlay border-success",
      inactive: `bg-overlay text-${inactiveColor || "success"} border-border hover:border-success`,
    },
    info: {
      active: "bg-info text-overlay border-info",
      inactive: `bg-overlay text-${inactiveColor || "info"} border-border hover:border-info`,
    },
  };

  const className = active ? colorMap[activeColor].active : colorMap[activeColor].inactive;

  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={`h-auto px-1.5 sm:px-2 md:px-4 py-1.5 text-xs whitespace-nowrap min-w-fit ${className}`}
    >
      <span className="flex items-center">
        {icon}
        <span className="text-2xs sm:text-xs">{label}</span>
      </span>
    </Button>
  );
}

function getPerspectiveLabel(perspective: PerspectiveMode, t: (key: string) => string): string {
  if (!perspective.active) {
    return t("characterChat.perspective") || "视角设计";
  }
  if (perspective.mode === "novel") {
    return t("characterChat.novelPerspective") || "小说视角";
  }
  return t("characterChat.protagonistPerspective") || "主角视角";
}
