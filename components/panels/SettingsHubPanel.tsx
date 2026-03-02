/**
 * @input  @/contexts, @/components, @/lib
 * @output SettingsHubPanel
 * @pos    功能面板组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                           设置菜单面板                              ║
 * ║  集中入口：模型设置、插件管理、标签颜色、数据管理、向量检索开关。       ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useEffect, useState } from "react";
import { Cpu, Puzzle, Palette, Database, ToggleLeft } from "lucide-react";
import { useUiLayout, type PanelId } from "@/contexts/ui-layout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { isVectorMemoryEnabled, setVectorMemoryEnabled } from "@/lib/vector-memory/manager";

interface SettingEntry {
  id: PanelId;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const SETTINGS: SettingEntry[] = [
  { id: "modelSettings", title: "模型设置", description: "配置模型参数与密钥。", icon: <Cpu size={16} /> },
  { id: "plugins", title: "插件管理", description: "安装、启用与调试插件。", icon: <Puzzle size={16} /> },
  { id: "tagColors", title: "标签颜色", description: "调整标签色彩方案。", icon: <Palette size={16} /> },
  { id: "data", title: "数据管理", description: "导入/导出与备份。", icon: <Database size={16} /> },
];

export function SettingsHubPanel() {
  const { openPanel } = useUiLayout();
  const [vectorEnabled, setVectorEnabledState] = useState(false);
  const [vectorReady, setVectorReady] = useState(false);

  useEffect(() => {
    setVectorEnabledState(isVectorMemoryEnabled());
    setVectorReady(true);
  }, []);

  const handleVectorToggle = (checked: boolean) => {
    setVectorEnabledState(checked);
    setVectorMemoryEnabled(checked);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <div className="space-y-1">
        <div className="text-base font-semibold text-foreground">设置菜单</div>
        <div className="text-sm text-muted-foreground">
          集中管理模型、插件、标签、数据与向量检索开关。
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-muted px-2 py-2 text-muted-foreground">
                <ToggleLeft size={16} />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">向量检索</div>
                <div className="text-xs text-muted-foreground">检索相似记忆并注入提示词。</div>
              </div>
            </div>
            <Switch
              checked={vectorEnabled}
              onCheckedChange={handleVectorToggle}
              disabled={!vectorReady}
              aria-label="切换向量检索"
            />
          </div>
        </div>

        {SETTINGS.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-border bg-muted/30 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-muted px-2 py-2 text-muted-foreground">
                {item.icon}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.description}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => openPanel(item.id)}>
                打开
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
