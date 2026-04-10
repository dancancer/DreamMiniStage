/**
 * @input  @/contexts, @/lib, @/components
 * @output RightPanel
 * @pos    应用布局组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                             RightPanel 抽屉                         ║
 * ║  通过 panelId 映射渲染内容，所有入口集中于左侧导航。                   ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useUiLayout, type PanelId } from "@/contexts/ui-layout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PanelShellEmbeddedProvider } from "@/components/panels/shared/PanelShell";
import { TagColorsPanel } from "@/components/panels/TagColorsPanel";
import { DataPanel } from "@/components/panels/DataPanel";
import { ModelSettingsPanel } from "@/components/panels/ModelSettingsPanel";
import { PluginsPanel } from "@/components/panels/PluginsPanel";
import { CharactersPanel } from "@/components/panels/CharactersPanel";
import { WorldbookPanel } from "@/components/panels/WorldbookPanel";
import { RegexPanel } from "@/components/panels/RegexPanel";
import { PresetsPanel } from "@/components/panels/PresetsPanel";
import { AdvancedSettingsPanel } from "@/components/panels/AdvancedSettingsPanel";
import { SettingsHubPanel } from "@/components/panels/SettingsHubPanel";
import { SessionToolsPanel } from "@/components/panels/SessionToolsPanel";

const PANEL_META: Record<PanelId, { title: string; description: string }> = {
  characters: { title: "角色卡", description: "管理与编辑角色卡信息。" },
  worldbook: { title: "世界书", description: "维护世界设定与条目。" },
  regex: { title: "正则脚本", description: "全局维护规则脚本，必要时再绑定到具体角色。" },
  presets: { title: "预设", description: "全局维护预设与回复长度，不把它们绑死在某个会话里。" },
  sessionTools: { title: "会话工具", description: "收纳 Quick Reply、群聊成员与分支工具。" },
  modelSettings: { title: "模型设置", description: "管理模型参数与选择。" },
  plugins: { title: "插件管理", description: "安装与配置插件。" },
  tagColors: { title: "标签颜色", description: "调整标签颜色方案。" },
  advancedSettings: { title: "高级设置", description: "高级选项与偏好。" },
  data: { title: "数据管理", description: "导入/导出与云端同步。" },
  settingsHub: { title: "设置菜单", description: "集中管理模型、插件、标签、数据与向量检索。" },
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
  sessionTools: SessionToolsPanel,
  modelSettings: ModelSettingsPanel,
  plugins: PluginsPanel,
  tagColors: TagColorsPanel,
  advancedSettings: AdvancedSettingsPanel,
  data: DataPanel,
  settingsHub: SettingsHubPanel,
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
            "stage-panel-surface fixed inset-y-0 right-0 left-auto top-0 z-40 flex h-dvh w-full max-w-2xl flex-col overflow-hidden rounded-none",
            "md:w-[480px]",
            "border-l border-border/75 p-0",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
          )}
        >
          {/* ═══════════════════ 无障碍标题（屏幕阅读器可见） ═══════════════════ */}
          <DialogPrimitive.Title className="sr-only">{meta?.title}</DialogPrimitive.Title>

          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-[10px] uppercase tracking-[0.26em] text-primary-soft/70">
                Side Panel
              </div>
              <div className="mt-1 truncate text-base font-semibold text-foreground">{meta?.title}</div>
              {meta?.description && (
                <DialogPrimitive.Description className="mt-1 text-sm text-ink-soft">
                  {meta.description}
                </DialogPrimitive.Description>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={closePanel}
              className="h-11 w-11 rounded-full border border-border/70 bg-background/55 text-muted-foreground hover:border-primary/20 hover:bg-primary/10 hover:text-foreground sm:h-10 sm:w-10"
              aria-label="关闭侧栏"
            >
              <X size={16} />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {CurrentPanel ? (
              <PanelShellEmbeddedProvider>
                <CurrentPanel />
              </PanelShellEmbeddedProvider>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
