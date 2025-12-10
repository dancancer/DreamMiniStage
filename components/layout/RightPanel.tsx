/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                             RightPanel 抽屉                         ║
 * ║  通过 panelId 映射渲染内容，所有入口集中于左侧导航。                   ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { X } from "lucide-react";
import { useUiLayout, type PanelId } from "@/contexts/ui-layout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TagColorsPanel } from "@/components/panels/TagColorsPanel";
import { DataPanel } from "@/components/panels/DataPanel";
import { ModelSettingsPanel } from "@/components/panels/ModelSettingsPanel";
import { PluginsPanel } from "@/components/panels/PluginsPanel";
import { CharactersPanel } from "@/components/panels/CharactersPanel";
import { WorldbookPanel } from "@/components/panels/WorldbookPanel";
import { RegexPanel } from "@/components/panels/RegexPanel";
import { PresetsPanel } from "@/components/panels/PresetsPanel";
import { AdvancedSettingsPanel } from "@/components/panels/AdvancedSettingsPanel";

const PANEL_META: Record<PanelId, { title: string; description: string }> = {
  characters: { title: "角色卡", description: "管理与编辑角色卡信息。" },
  worldbook: { title: "世界书", description: "维护世界设定与条目。" },
  regex: { title: "正则脚本", description: "管理脚本与规则。" },
  presets: { title: "预设", description: "配置预设与回复长度。" },
  modelSettings: { title: "模型设置", description: "管理模型参数与选择。" },
  plugins: { title: "插件管理", description: "安装与配置插件。" },
  tagColors: { title: "标签颜色", description: "调整标签颜色方案。" },
  advancedSettings: { title: "高级设置", description: "高级选项与偏好。" },
  data: { title: "数据管理", description: "导入/导出与云端同步。" },
};

function PanelPlaceholder({ panelId }: { panelId: PanelId }) {
  const meta = PANEL_META[panelId];
  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <div>
        <div className="text-base font-semibold text-foreground">{meta.title}</div>
        <div className="text-sm text-muted-foreground">{meta.description}</div>
      </div>
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        即将接入现有模块内容（占位）。
      </div>
    </div>
  );
}

const PANEL_COMPONENTS: Record<PanelId, () => React.ReactNode> = {
  characters: CharactersPanel,
  worldbook: WorldbookPanel,
  regex: RegexPanel,
  presets: PresetsPanel,
  modelSettings: ModelSettingsPanel,
  plugins: PluginsPanel,
  tagColors: TagColorsPanel,
  advancedSettings: AdvancedSettingsPanel,
  data: DataPanel,
};

export default function RightPanel() {
  const { activePanel, isPanelOpen, closePanel } = useUiLayout();
  const CurrentPanel = activePanel ? PANEL_COMPONENTS[activePanel] : null;
  const meta = activePanel ? PANEL_META[activePanel] : null;

  if (!isPanelOpen || !activePanel || !CurrentPanel) {
    return null;
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && closePanel()} modal={false}>
      <DialogPrimitive.Portal forceMount>
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 left-auto top-0 z-40 h-full w-full max-w-2xl bg-background",
            "md:w-[480px]",
            "border-l border-border p-0 shadow-xl",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
          )}
        >
          {/* ═══════════════════ 无障碍标题（屏幕阅读器可见） ═══════════════════ */}
          <VisuallyHidden.Root asChild>
            <DialogPrimitive.Title>{meta?.title}</DialogPrimitive.Title>
          </VisuallyHidden.Root>

          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-foreground">{meta?.title}</div>
              {meta?.description && (
                <DialogPrimitive.Description className="text-sm text-muted-foreground">
                  {meta.description}
                </DialogPrimitive.Description>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={closePanel}
              className="h-9 w-9 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="关闭侧栏"
            >
              <X size={16} />
            </Button>
          </div>

          <div className="h-[calc(100%-56px)]">
            {CurrentPanel ? <CurrentPanel /> : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
