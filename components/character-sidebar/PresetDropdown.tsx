/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Preset Dropdown                                   ║
 * ║                                                                           ║
 * ║  系统预设下拉选择器 - 显示可用预设列表 + 选中状态                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React from "react";
import { Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPresetDisplayName, getPresetDescription } from "@/function/preset/download";

/* ─────────────────────────────────────────────────────────────────────────────
 * 类型定义
 * ───────────────────────────────────────────────────────────────────────────── */

interface PresetItem {
  name: string;
  displayName: {
    zh: string;
    en: string;
  };
  description: {
    zh: string;
    en: string;
  };
  filename: string;
}

interface PresetDropdownProps {
  /** 预设列表 */
  presets: PresetItem[];
  /** 当前选中的预设 */
  selectedPreset: string;
  /** 语言 */
  language: "zh" | "en";
  /** 字体类名 */
  fontClass?: string;
  /** 选择预设回调 */
  onSelect: (presetName: string) => void;
  /** 查看预设信息回调 */
  onShowInfo: (presetName: string) => void;
  /** 无预设时的提示文字 */
  emptyText?: string;
  /** 是否作为浮层渲染（不使用自身 absolute 定位） */
  floating?: boolean;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 图标组件 - 选中 / 未选中
 * ───────────────────────────────────────────────────────────────────────────── */

const CheckIcon: React.FC = () => (
  <Check size={14} color="var(--color-info)" strokeWidth={2} />
);

const InfoIcon: React.FC = () => (
  <Info size={12} className="transition-transform duration-300 group-hover/info:scale-110" />
);

/* ─────────────────────────────────────────────────────────────────────────────
 * 组件实现
 * ───────────────────────────────────────────────────────────────────────────── */

const PresetDropdown: React.FC<PresetDropdownProps> = ({
  presets,
  selectedPreset,
  language,
  fontClass = "",
  onSelect,
  onShowInfo,
  emptyText = "没有可用的预设",
  floating = false,
}) => {
  const containerClass = floating
    ? "relative w-full bg-surface border border-stroke rounded-md overflow-hidden max-h-[320px] shadow-lg"
    : "absolute left-0 right-0 mt-1 mx-6 bg-surface border border-stroke rounded-md  z-10 overflow-hidden max-h-[240px]";
  const listClass = floating
    ? "overflow-y-auto max-h-[320px] scrollbar-thin scrollbar-track-input scrollbar-thumb-stroke hover:scrollbar-thumb-stroke-strong"
    : "overflow-y-auto max-h-[240px] scrollbar-thin scrollbar-track-input scrollbar-thumb-stroke hover:scrollbar-thumb-stroke-strong";

  /* ─── 空状态 ─── */
  if (presets.length === 0) {
    return (
      <div className={containerClass}>
        <div className="p-3 text-center text-ink-soft">
          <span className={`text-2xs md:text-xs ${fontClass}`}>{emptyText}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className={listClass}>
        {presets.map((preset, index) => {
          const isSelected = selectedPreset === preset.name;
          const isLast = index === presets.length - 1;

          return (
            <div
              key={preset.name}
              className={`p-3 hover:bg-muted-surface transition-colors duration-200 group ${
                isLast ? "" : "border-b border-stroke"
              }`}
            >
              <div className="flex items-center justify-between">
                {/* 预设信息区域 (点击选择) */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onSelect(preset.name)}
                >
                  <div className="flex items-center">
                    <span className={`text-xs md:text-sm text-cream ${fontClass} block truncate`}>
                      {getPresetDisplayName(preset.name, language)}
                    </span>
                    {/* 信息按钮 */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowInfo(preset.name);
                      }}
                      className="ml-2 h-4 w-4 text-ink-soft hover:text-primary-bright hover:bg-stroke/50 group/info"
                    >
                      <InfoIcon />
                    </Button>
                  </div>
                  <p className={`text-2xs md:text-xs text-ink-soft mt-1 ${fontClass} line-clamp-2`}>
                    {getPresetDescription(preset.name, language)}
                  </p>
                </div>

                {/* 选中状态指示 */}
                <div className="ml-2 flex-shrink-0">
                  {isSelected ? (
                    <div className="w-4 h-4 flex items-center justify-center">
                      <CheckIcon />
                    </div>
                  ) : (
                    <div className="w-4 h-4 border border-stroke rounded" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PresetDropdown;
