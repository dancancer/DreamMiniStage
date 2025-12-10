/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Character Sidebar Component                           ║
 * ║                                                                           ║
 * ║  角色侧边栏 - 导航、信息、预设、设置的统一入口                                   ║
 * ║  职责：组合子组件，不包含具体业务逻辑                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState } from "react";
import { useLanguage } from "@/app/i18n";
import { trackButtonClick } from "@/utils/google-analytics";
import { CharacterAvatarBackground } from "@/components/CharacterAvatarBackground";
import AdvancedSettingsEditor from "@/components/AdvancedSettingsEditor";
import PresetInfoModal from "@/components/PresetInfoModal";
import { useUIStore } from "@/lib/store/ui-store";
import { Loader2, ArrowLeft, Edit, Github, Settings, X, ChevronDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ─── 子组件 & Hooks ─── */
import {
  SidebarMenuItem,
  ResponseLengthSlider,
  PresetDropdown,
} from "@/components/character-sidebar";
import { usePresetManager } from "@/hooks/usePresetManager";
import { useResponseLength } from "@/hooks/useResponseLength";
import { useMobileDetection } from "@/hooks/useMobileDetection";

/* ─────────────────────────────────────────────────────────────────────────────
 * 类型定义
 * ───────────────────────────────────────────────────────────────────────────── */

interface CharacterSidebarProps {
  character: {
    id: string;
    name: string;
    personality?: string;
    avatar_path?: string;
    scenario?: string;
  };
  isCollapsed: boolean;
  toggleSidebar: () => void;
  onViewSwitch?: () => void;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Section Header 组件 - 区块标题
 * ───────────────────────────────────────────────────────────────────────────── */

const SectionHeader: React.FC<{ label: string; isCollapsed: boolean }> = ({ label, isCollapsed }) => (
  <div className={`px-2 py-1 flex justify-between items-center text-xs text-text-muted uppercase tracking-wider font-medium text-3xs md:text-2xs transition-all duration-300 ease-in-out overflow-hidden mx-4 ${isCollapsed ? "opacity-0" : "opacity-100"}`}>
    <span>{label}</span>
  </div>
);

const Divider: React.FC = () => <div className="mx-4 menu-divider my-2" />;

/* ─────────────────────────────────────────────────────────────────────────────
 * 主组件
 * ───────────────────────────────────────────────────────────────────────────── */

const CharacterSidebar: React.FC<CharacterSidebarProps> = ({
  character,
  isCollapsed,
  toggleSidebar,
  onViewSwitch,
}) => {
  const { t, fontClass, serifFontClass, language } = useLanguage();
  const { isMobile } = useMobileDetection();

  /* ─── 模态框状态 ─── */
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);
  const [showPresetInfoModal, setShowPresetInfoModal] = useState(false);
  const [selectedPresetForInfo, setSelectedPresetForInfo] = useState("");

  /* ─── 提取的 Hooks ─── */
  const presetManager = usePresetManager({ language: language as "zh" | "en" });
  const responseLength = useResponseLength();
  const switchToPresetView = useUIStore((state) => state.switchToPresetView);

  /* ─── 事件处理 ─── */
  const handleOpenPromptEditor = () => {
    trackButtonClick("CharacterSidebar", "切换到预设编辑器");
    switchToPresetView({ characterId: character.id });
  };

  const handleToggleSidebar = () => {
    trackButtonClick("CharacterSidebar", "切换角色侧边栏");
    toggleSidebar();
  };

  const handleShowPresetInfo = (presetName: string) => {
    setSelectedPresetForInfo(presetName);
    setShowPresetInfoModal(true);
  };

  /* ─── 截断文本的工具函数 ─── */
  const truncate = (text: string | undefined, limit: number) => {
    if (!text) return "";
    return text.length > limit ? `${text.substring(0, limit)}...` : text;
  };

  const nameLimit = isMobile ? 15 : 20;
  const personalityLimit = isMobile ? 20 : 25;

  /* ─────────────────────────────────────────────────────────────────────────────
   * 渲染
   * ───────────────────────────────────────────────────────────────────────────── */

  return (
    <>
      {/* 移动端遮罩 */}
      {isMobile && !isCollapsed && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
      )}

      <div
        className={`${
          isMobile
            ? `fixed inset-0 z-50 w-full text-xs leading-tight  ${isCollapsed ? "pointer-events-none opacity-0" : "opacity-100"}`
            : `w-[18rem] text-sm leading-normal  ${isCollapsed ? "pointer-events-none -translate-x-full opacity-0" : "translate-x-0 opacity-100"}`
        } relative overflow-hidden border-r border-border h-full flex flex-col magic-border transition-[transform,opacity] duration-300 ease-out`}
      >
        {/* 移动端关闭按钮 */}
        {isMobile && !isCollapsed && (
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="outline"
              size="icon"
              onClick={() => { trackButtonClick("CharacterSidebar", "移动端关闭侧边栏"); toggleSidebar(); }}
              className="h-8 w-8 rounded-full text-cream bg-surface border-stroke hover:bg-accent hover:text-accent-foreground hover:border-accent"
            >
              <X size={16} />
            </Button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
         * 导航区
         * ═══════════════════════════════════════════════════════════════════════ */}
        <SectionHeader label={t("characterChat.navigation")} isCollapsed={isCollapsed} />
        <div className="transition-all duration-300 ease-in-out px-6 max-h-[500px] opacity-100 mt-4">
          <div className="space-y-1 my-2">
            <SidebarMenuItem
              icon={<User size={16} />}
              label={t("characterChat.backToCharacters")}
              href="/character-cards"
              isCollapsed={isCollapsed}
              isMobile={isMobile}
              fontClass={fontClass}
            />
            <SidebarMenuItem
              icon={<ArrowLeft size={16} />}
              label={t("characterChat.collapseSidebar")}
              onClick={handleToggleSidebar}
              isCollapsed={isCollapsed}
              isMobile={isMobile}
              fontClass={fontClass}
            />
          </div>
        </div>

        <Divider />

        {/* ═══════════════════════════════════════════════════════════════════════
         * 角色信息区
         * ═══════════════════════════════════════════════════════════════════════ */}
        <SectionHeader label={t("characterChat.characterInfo")} isCollapsed={isCollapsed} />
        {!isCollapsed && (
          <div className="transition-all duration-300 ease-in-out px-6 max-h-[500px] opacity-100">
            <div className="space-y-1 my-2">
              <div className="menu-item flex p-2 rounded-md hover:bg-accent hover:text-accent-foreground overflow-hidden transition-all duration-300 group">
                <div className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0 mr-3 flex items-center justify-center text-cream bg-surface rounded-md border border-stroke  transition-all duration-300 group-hover:border-accent group-hover:text-accent-foreground group-">
                  {character.avatar_path ? (
                    <CharacterAvatarBackground avatarPath={character.avatar_path} />
                  ) : (
                    <User size={20} className="md:w-6 md:h-6" />
                  )}
                </div>
                <div className="flex flex-col justify-center">
                  <span className={"magical-text whitespace-nowrap overflow-hidden text-ellipsis block text-xs md:text-sm text-cream group-hover:text-accent-foreground transition-colors duration-300 "}>
                    {truncate(character.name, nameLimit)}
                  </span>
                  <p className={`text-ink-soft text-2xs md:text-xs ${fontClass} whitespace-nowrap overflow-hidden text-ellipsis mt-1`}>
                    {character.personality
                      ? truncate(character.personality, personalityLimit)
                      : t("characterChat.noPersonality")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
         * 预设区
         * ═══════════════════════════════════════════════════════════════════════ */}
        {!isCollapsed && (
          <>
            <SectionHeader label={t("characterChat.presets") || "预设"} isCollapsed={false} />
            <div className="space-y-1">
              <div className="mx-6">
                <SidebarMenuItem
                  icon={<Edit size={16} />}
                  label={t("characterChat.presetEditor")}
                  onClick={handleOpenPromptEditor}
                  isMobile={isMobile}
                  fontClass={fontClass}
                />
              </div>
              <div className="relative mx-6">
                <SidebarMenuItem
                  icon={<Github size={16} />}
                  label={t("characterChat.systemPresets")}
                  onClick={presetManager.toggleDropdown}
                  isMobile={isMobile}
                  fontClass={fontClass}
                  accentColor="purple"
                  isActive={presetManager.isDropdownOpen}
                  suffix={
                    <div className="flex items-center justify-center ml-2">
                      <div className={`transition-transform duration-300 ${presetManager.isDropdownOpen ? "rotate-180" : ""}`}>
                        <ChevronDown size={12} />
                      </div>
                    </div>
                  }
                />
                {presetManager.isDropdownOpen && (
                  <PresetDropdown
                    presets={presetManager.presets}
                    selectedPreset={presetManager.selectedPreset}
                    language={language as "zh" | "en"}
                    fontClass={fontClass}
                    onSelect={presetManager.selectPreset}
                    onShowInfo={handleShowPresetInfo}
                    emptyText={t("characterChat.noPresets") || "没有可用的预设"}
                  />
                )}
              </div>
            </div>
            <Divider />
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
         * 高级设置区
         * ═══════════════════════════════════════════════════════════════════════ */}
        <SectionHeader label={t("characterChat.advancedSettings")} isCollapsed={isCollapsed} />
        {!isCollapsed && (
          <div className="transition-all duration-300 ease-in-out px-6 max-h-[500px] opacity-100">
            <div className="space-y-1 my-2">
              <SidebarMenuItem
                icon={<Settings size={16} />}
                label={t("characterChat.advancedSettings")}
                onClick={() => { trackButtonClick("CharacterSidebar", "打开高级设置"); setIsAdvancedSettingsOpen(true); }}
                isMobile={isMobile}
                fontClass={fontClass}
                accentColor="blue"
              />
            </div>
          </div>
        )}

        <Divider />

        {/* ═══════════════════════════════════════════════════════════════════════
         * 响应长度区
         * ═══════════════════════════════════════════════════════════════════════ */}
        <SectionHeader label={t("characterChat.responseLength")} isCollapsed={isCollapsed} />
        {!isCollapsed && (
          <div className="transition-all duration-300 ease-in-out px-6 max-h-[500px] opacity-100">
            <ResponseLengthSlider
              value={responseLength.length}
              min={responseLength.min}
              max={responseLength.max}
              percentage={responseLength.percentage}
              onChange={responseLength.handleChange}
              fontClass={fontClass}
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
       * 模态框
       * ═══════════════════════════════════════════════════════════════════════ */}
      <AdvancedSettingsEditor
        isOpen={isAdvancedSettingsOpen}
        onClose={() => setIsAdvancedSettingsOpen(false)}
        onViewSwitch={onViewSwitch}
      />
      <PresetInfoModal
        isOpen={showPresetInfoModal}
        onClose={() => setShowPresetInfoModal(false)}
        presetName={selectedPresetForInfo}
      />
    </>
  );
};

export default CharacterSidebar;
