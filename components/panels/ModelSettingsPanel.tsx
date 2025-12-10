/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                       ModelSettingsPanel 模型设置面板               ║
 * ║  复用桌面端模型侧边栏视图，默认展开，关闭即收起右侧抽屉。               ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useLanguage } from "@/app/i18n";
import { useUiLayout } from "@/contexts/ui-layout";
import { trackButtonClick } from "@/utils/google-analytics";
import { DesktopSidebarView } from "@/components/model-sidebar/DesktopSidebarView";
import {
  useModelSidebarConfig,
  describeLlmType,
  getBaseUrlPlaceholder,
  getModelPlaceholder,
} from "@/hooks/useModelSidebarConfig";

export function ModelSettingsPanel() {
  const { t, fontClass, serifFontClass } = useLanguage();
  const { closePanel } = useUiLayout();
  const { state, actions } = useModelSidebarConfig();

  const sidebarActions = {
    ...actions,
    toggleSidebar: closePanel,
  };

  const helpers = {
    describeLlmType,
    getBaseUrlPlaceholder,
    getModelPlaceholder,
  };

  return (
    <div className="h-full overflow-auto bg-background">
      <DesktopSidebarView
        isOpen
        variant="panel"
        fontClass={fontClass}
        serifFontClass={serifFontClass}
        t={t}
        trackButtonClick={trackButtonClick}
        state={state}
        actions={sidebarActions}
        helpers={helpers}
      />
    </div>
  );
}
