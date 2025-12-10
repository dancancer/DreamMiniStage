/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       usePresetManager Hook                               ║
 * ║                                                                           ║
 * ║  系统预设管理 - 加载、选择、持久化                                            ║
 * ║  职责单一：只管预设相关状态，不涉及 UI                                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { useState, useEffect, useCallback } from "react";
import {
  getAvailableGithubPresets,
  getPresetDisplayName,
} from "@/function/preset/download";
import { getString, setString } from "@/lib/storage/client-storage";

/* ─────────────────────────────────────────────────────────────────────────────
 * 类型定义 - 与 function/preset/download.ts 中 GithubPreset 结构一致
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

interface UsePresetManagerOptions {
  language: "zh" | "en";
}

interface UsePresetManagerReturn {
  /** 可用预设列表 */
  presets: PresetItem[];
  /** 当前选中的预设名称 */
  selectedPreset: string;
  /** 下拉菜单是否展开 */
  isDropdownOpen: boolean;
  /** 切换下拉菜单 */
  toggleDropdown: () => void;
  /** 关闭下拉菜单 */
  closeDropdown: () => void;
  /** 选择预设 */
  selectPreset: (presetName: string) => void;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 预设名称映射 - 消除 if/else 链
 * ───────────────────────────────────────────────────────────────────────────── */

const VALID_PRESETS = new Set([
  "novel_king",
  "professional_heart",
  "magician",
  "whisperer",
  "mirror_realm",
]);

const DEFAULT_PRESET = "mirror_realm";

/**
 * 从 localStorage 读取当前预设
 * 如果不在白名单内，返回默认值
 */
const getCurrentPresetFromStorage = (): string => {
  const storedType = getString("system_preset_type");
  return storedType && VALID_PRESETS.has(storedType) ? storedType : DEFAULT_PRESET;
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Hook 实现
 * ───────────────────────────────────────────────────────────────────────────── */

export const usePresetManager = ({
  language,
}: UsePresetManagerOptions): UsePresetManagerReturn => {
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>(DEFAULT_PRESET);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  /* ─── 初始化：加载预设列表 + 读取当前选择 ─── */
  useEffect(() => {
    const loadPresets = () => {
      const availablePresets = getAvailableGithubPresets();
      setPresets(availablePresets);
      setSelectedPreset(getCurrentPresetFromStorage());
    };

    loadPresets();
  }, [language]);

  /* ─── 选择预设 ─── */
  const selectPreset = useCallback(
    (presetName: string) => {
      if (!VALID_PRESETS.has(presetName)) return;

      setString("system_preset_type", presetName);
      setString("system_preset_name", getPresetDisplayName(presetName, language));

      setSelectedPreset(presetName);
    },
    [language]
  );

  /* ─── 下拉菜单控制 ─── */
  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  return {
    presets,
    selectedPreset,
    isDropdownOpen,
    toggleDropdown,
    closeDropdown,
    selectPreset,
  };
};

export default usePresetManager;
