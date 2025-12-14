/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                         Main Layout Component                            ║
 * ║                                                                          ║
 * ║  应用主布局：侧边栏、模态框、响应式处理                                      ║
 * ║  【重构】使用 Zustand Store 管理全局 UI 状态                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ModelSidebar from "@/components/ModelSidebar";
import SettingsDropdown from "@/components/SettingsDropdown";
import LoginModal from "@/components/LoginModal";
import AccountModal from "@/components/AccountModal";
import DownloadModal from "@/components/DownloadModal";
import MobileBottomNav from "@/components/MobileBottomNav";
import { PluginRegistry } from "@/lib/plugins/plugin-registry";
import { PluginDiscovery } from "@/lib/plugins/plugin-discovery";
import { ToolRegistry } from "@/lib/tools/tool-registry";
import { useUIStore } from "@/lib/store/ui-store";

/**
 * Main layout wrapper component that manages the application's core structure
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to be rendered in the main content area
 * @returns {JSX.Element} The complete layout structure with sidebars and content area
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  // ========== Zustand Store ==========
  const modelSidebarOpen = useUIStore((state) => state.modelSidebarOpen);
  const setModelSidebarOpen = useUIStore((state) => state.setModelSidebarOpen);
  
  // ========== 本地状态 ==========
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    
    // Initialize enhanced plugin system
    const initializePlugins = async () => {
      try {
        const pluginRegistry = PluginRegistry.getInstance();
        const pluginDiscovery = PluginDiscovery.getInstance();

        await pluginRegistry.initialize();
        await pluginDiscovery.discoverPlugins();

        // ═══════════════════════════════════════════════════════════════════
        // 挂载到 window 对象用于调试
        // ═══════════════════════════════════════════════════════════════════
        window.pluginRegistry = pluginRegistry;
        window.pluginDiscovery = pluginDiscovery;

        console.log("🔌 Enhanced plugin system initialized and exposed to window object");
      } catch (error) {
        console.error("❌ Failed to initialize enhanced plugin system:", error);
      }
    };

    initializePlugins();
    
    return () => {
      window.removeEventListener("resize", checkIfMobile);
    };
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleModelSidebar = () => {
    setModelSidebarOpen(!modelSidebarOpen);
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex h-full overflow-hidden bg-background relative"> 
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />
      <AccountModal 
        isOpen={isAccountModalOpen} 
        onClose={() => setIsAccountModalOpen(false)} 
      />
      <DownloadModal 
        isOpen={isDownloadModalOpen} 
        onClose={() => setIsDownloadModalOpen(false)} 
      />
      {/* Sidebar - hidden on mobile, visible on desktop */}
      <div className="fixed left-0 top-0 h-full z-10 hidden md:block">
        <Sidebar 
          isOpen={sidebarOpen} 
          toggleSidebar={toggleSidebar} 
          openLoginModal={() => setIsLoginModalOpen(true)} 
          openAccountModal={() => setIsAccountModalOpen(true)}
          openDownloadModal={() => setIsDownloadModalOpen(true)}
        />
      </div>
      <main
        className={`flex-1 h-full overflow-auto transition-all duration-300
            ml-0 ${sidebarOpen ? "md:ml-72" : "md:ml-0"}
            ${modelSidebarOpen ? "mr-64" : "mr-0"}
            pb-20 md:pb-0
          `}
      >
        <div className="h-full relative">
          <div className={`absolute top-4 right-4 z-[999] ${isMobile && modelSidebarOpen ? "hidden" : ""}`}>
            <SettingsDropdown toggleModelSidebar={toggleModelSidebar} />
          </div>

          {children}
        </div>
      </main>

      <div className="fixed right-0 top-0 h-full z-40">
        <ModelSidebar isOpen={modelSidebarOpen} toggleSidebar={toggleModelSidebar} />
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav 
        openLoginModal={() => setIsLoginModalOpen(true)} 
        openAccountModal={() => setIsAccountModalOpen(true)}
      />
    </div>
  );
}
