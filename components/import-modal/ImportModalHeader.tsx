/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        Import Modal Header                                ║
 * ║                                                                          ║
 * ║  通用导入弹窗头部 + 标签切换                                                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import { FileText, Globe2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TabConfig {
  id: "file" | "global";
  label: string;
  icon: "file" | "global";
  activeColor: string;
}

interface ImportModalHeaderProps {
  title: string;
  activeTab: "file" | "global";
  tabs: [TabConfig, TabConfig];
  serifFontClass: string;
  onTabChange: (tab: "file" | "global") => void;
  onClose: () => void;
}

const ICON_MAP = { file: FileText, global: Globe2 };
const COLOR_MAP: Record<string, { active: string; glow: string }> = {
  primary: { active: "from-primary-600/90 to-primary-700/90", glow: "shadow-primary-500/20" },
  blue: { active: "from-blue-600/90 to-blue-700/90", glow: "shadow-blue-500/20" },
};

export function ImportModalHeader({ title, activeTab, tabs, serifFontClass, onTabChange, onClose }: ImportModalHeaderProps) {
  return (
    <div className="relative p-3 border-b border-border/40 bg-gradient-to-r from-muted-surface/80 via-deep/60 to-muted-surface/80 backdrop-blur-sm">
      <div className="flex justify-between items-center">
        <h2 className={"text-base font-semibold text-cream-soft  "}>
          {title}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="w-7 h-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex mt-2 space-x-0.5 backdrop-blur-sm rounded-md p-0.5 border border-border/30">
        {tabs.map((tab) => {
          const Icon = ICON_MAP[tab.icon];
          const isActive = activeTab === tab.id;

          return (
            <Button
              key={tab.id}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              onClick={() => onTabChange(tab.id)}
              className="flex-1"
            >
              <Icon className="mr-1 h-3 w-3" />
              {tab.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
