/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   Advanced Settings Editor Component                       ║
 * ║                                                                            ║
 * ║  高级设置编辑器 - 已迁移至 Radix UI Dialog                                    ║
 * ║  标签颜色编辑 + 选项卡导航                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState } from "react";
import { Layers, Palette, X } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { TagColorEditor } from "@/components/TagColorEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

// ============================================================================
//                              类型定义
// ============================================================================

interface AdvancedSettingsEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onViewSwitch?: () => void;
}

// ============================================================================
//                              主组件
// ============================================================================

const AdvancedSettingsEditor: React.FC<AdvancedSettingsEditorProps> = ({ isOpen, onClose, onViewSwitch }) => {
  const { t, fontClass, serifFontClass } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>("tagColors");

  // ========== 渲染 ==========

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden  border-border gap-0 h-[85vh] sm:h-[calc(100vh-4rem)] max-h-[500px] sm:max-h-[700px]">
        <DialogTitle className="sr-only">{t("characterChat.advancedSettings")}</DialogTitle>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-primary-500/10 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-primary-500/10 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-primary-500/5 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="flex items-center justify-between p-2 sm:p-5 border-b border-neutral-700/50 relative z-10">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-md bg-gradient-to-br from-primary-500/20 to-primary-600/30 flex items-center justify-center border border-primary-500/30  ">
              <Layers className="h-3 w-3 sm:h-4 sm:w-4 text-primary-400" />
            </div>
            <h2 className={"text-sm sm:text-xl font-semibold  "}>
              {t("characterChat.advancedSettings")}
            </h2>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden relative z-10">
          <div className="w-24 sm:w-56 border-r border-neutral-700/50 p-2 sm:p-5 bg-neutral-800/20 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-50"></div>
            <div className="relative z-10 space-y-1 sm:space-y-2">
              <Button
                variant="ghost"
                className={`h-auto w-full justify-start px-1.5 sm:px-3 py-1.5 sm:py-2.5 text-2xs sm:text-sm font-medium ${fontClass} ${
                  activeTab === "tagColors"
                    ? "bg-gradient-to-r from-slate-700/80 via-primary-800/60 to-slate-700/80 text-primary-200 border border-primary-600/30"
                    : "text-neutral-400 hover:bg-neutral-700/40 hover:text-neutral-200"
                }`}
                onClick={() => setActiveTab("tagColors")}
              >
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <Palette className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary-400" />
                  <span className="truncate">{t("characterChat.tagColorEditor")}</span>
                </div>
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 sm:p-6 bg-neutral-900/30 fantasy-scrollbar relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-30"></div>
            <div className="relative z-10">
              {activeTab === "tagColors" && (
                <TagColorEditor
                  onSave={(colors) => {
                  }}
                  onViewSwitch={onViewSwitch}
                />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedSettingsEditor;
