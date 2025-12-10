/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                            MainShell 布局容器                       ║
 * ║  三栏骨架：左侧导航 / 中部工作区 / 右侧抽屉                         ║
 * ║  移动端优先：同一套组件，CSS 断点折叠与覆盖。                       ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useEffect, useState } from "react";
import { PluginRegistry } from "@/lib/plugins/plugin-registry";
import { PluginDiscovery } from "@/lib/plugins/plugin-discovery";
import { ToolRegistry } from "@/lib/tools/tool-registry";
import { UiLayoutProvider } from "@/contexts/ui-layout";
import { HeaderContentProvider } from "@/contexts/header-content";
import LeftNav from "./LeftNav";
import TopBar from "./TopBar";
import RightPanel from "./RightPanel";

interface MainShellProps {
  children: React.ReactNode;
}

export default function MainShell({ children }: MainShellProps) {
  const [navOpen, setNavOpen] = useState(false);

  const toggleNav = () => setNavOpen((open) => !open);
  const closeNav = () => setNavOpen(false);

  // 初始化插件系统（与旧 MainLayout 保持一致）
  useEffect(() => {
    const initializePlugins = async () => {
      try {
        const pluginRegistry = PluginRegistry.getInstance();
        const pluginDiscovery = PluginDiscovery.getInstance();

        await pluginRegistry.initialize();
        await pluginDiscovery.discoverPlugins();

        (window as any).pluginRegistry = pluginRegistry;
        (window as any).pluginDiscovery = pluginDiscovery;
        (window as any).toolRegistry = ToolRegistry;
      } catch (error) {
        console.error("Failed to initialize plugin system:", error);
      }
    };

    initializePlugins();
  }, []);

  return (
    <UiLayoutProvider>
      <HeaderContentProvider>
        <div className="flex h-full bg-background text-foreground">
          <LeftNav isOpen={navOpen} onClose={closeNav} />

          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar onToggleNav={toggleNav} />
            <div className="flex-1 overflow-auto bg-background">
              {children}
            </div>
          </div>

          <RightPanel />
        </div>
      </HeaderContentProvider>
    </UiLayoutProvider>
  );
}
