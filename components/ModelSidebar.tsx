/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                         ModelSidebar Component                           ║
 * ║                                                                          ║
 * ║  模型配置侧边栏 - API 配置管理界面                                          ║
 * ║                                                                          ║
 * ║  重构后的简洁版本：                                                        ║
 * ║  - 核心逻辑提取到 useModelSidebarConfig hook                              ║
 * ║  - 视图组件拆分到 model-sidebar/ 目录                                     ║
 * ║  - 主文件只负责布局编排和移动端检测                                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/app/i18n";
import { trackButtonClick } from "@/utils/google-analytics";
import { DesktopSidebarView } from "./model-sidebar/DesktopSidebarView";
import { MobileSidebarView } from "./model-sidebar/MobileSidebarView";
import type { SidebarHelpers } from "./model-sidebar/types";
import {
  useModelSidebarConfig,
  describeLlmType,
  getBaseUrlPlaceholder,
  getModelPlaceholder,
} from "@/hooks/useModelSidebarConfig";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface ModelSidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ModelSidebar({ isOpen, toggleSidebar }: ModelSidebarProps) {
  const { t, fontClass, serifFontClass } = useLanguage();
  const [isMobile, setIsMobile] = useState(false);

  // 从 hook 获取所有状态和操作
  const { state, actions } = useModelSidebarConfig();

  // 移动端检测
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 组合 actions（添加 toggleSidebar）
  const sidebarActions = { ...actions, toggleSidebar };

  // 辅助函数
  const sidebarHelpers: SidebarHelpers = {
    describeLlmType,
    getBaseUrlPlaceholder,
    getModelPlaceholder,
  };

  // 视图 props
  const viewProps = {
    isOpen,
    fontClass,
    serifFontClass,
    t,
    trackButtonClick,
    state,
    actions: sidebarActions,
    helpers: sidebarHelpers,
  };

  // 根据设备类型渲染视图
  if (isMobile && isOpen) {
    return <MobileSidebarView {...viewProps} />;
  }

  return <DesktopSidebarView {...viewProps} />;
}
