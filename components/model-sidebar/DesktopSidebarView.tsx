/**
 * @input  @/lib, @/components
 * @output DesktopSidebarView
 * @pos    模型配置侧边栏组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

import React from "react";
import { ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { supportsModelAdvancedBooleanSetting, supportsModelAdvancedNumberSetting } from "@/lib/model-runtime-support";
import type { LLMType, SidebarViewProps } from "./types";
import { Button } from "@/components/ui/button";
import {
  NewConfigFormSection,
  ActiveConfigSection,
} from "./DesktopSidebarSections";

// ╔════════════════════════════════════════╗
// ║ 桌面端模型侧边栏视图（纯展示层）            ║
// ╚════════════════════════════════════════╝

export function DesktopSidebarView(props: SidebarViewProps) {
  const {
    isOpen,
    fontClass,
    serifFontClass,
    t,
    trackButtonClick,
    state,
    actions,
    helpers,
    variant = "sidebar",
  } = props;

  const {
    configs,
    activeConfigId,
    showNewConfigForm,
    showEditHint,
    isConfigHovered,
    editingConfigId,
    editingName,
    llmType,
    baseUrl,
    model,
    apiKey,
    availableModels,
    modelListEmpty,
  } = state;

  const {
    toggleSidebar,
    handleCreateConfig,
    handleSwitchConfig,
    handleStartEditName,
    setEditingName,
    handleSaveName,
    handleKeyDown,
    handleDeleteConfig,
    setIsConfigHovered,
    handleInlineModelChange,
  } = actions;

  const { describeLlmType, getBaseUrlPlaceholder, getModelPlaceholder } = helpers;
  const isPanel = variant === "panel";

  /* ─────────────────────────────────────────────────────────────────────
     高级参数字段定义
     ───────────────────────────────────────────────────────────────────── */

  const advancedNumberFields = [
    { key: "contextWindow", label: t("llmSettings.contextWindow") || "Context Window", description: t("llmSettings.contextWindowDescription") || "Upper bound for prompt context tokens.", step: "1", inputMode: "numeric" as const },
    { key: "maxTokens", label: t("llmSettings.maxTokens") || "Max Tokens", description: t("llmSettings.maxTokensDescription") || "Maximum number of tokens to generate.", step: "1", inputMode: "numeric" as const },
    { key: "temperature", label: t("llmSettings.temperature") || "Temperature", description: t("llmSettings.temperatureDescription") || "Controls randomness.", step: "0.1", inputMode: "decimal" as const },
    { key: "topP", label: t("llmSettings.topP") || "Top P", description: t("llmSettings.topPDescription") || "Controls nucleus sampling diversity.", step: "0.01", inputMode: "decimal" as const },
    { key: "topK", label: t("llmSettings.topK") || "Top K", description: t("llmSettings.topKDescription") || "Limits candidate tokens.", step: "1", inputMode: "numeric" as const },
    { key: "frequencyPenalty", label: t("llmSettings.frequencyPenalty") || "Frequency Penalty", description: t("llmSettings.frequencyPenaltyDescription") || "Penalizes repeated frequency.", step: "0.1", inputMode: "decimal" as const },
    { key: "presencePenalty", label: t("llmSettings.presencePenalty") || "Presence Penalty", description: t("llmSettings.presencePenaltyDescription") || "Encourages new topics.", step: "0.1", inputMode: "decimal" as const },
    { key: "repeatPenalty", label: t("llmSettings.repeatPenalty") || "Repeat Penalty", description: t("llmSettings.repeatPenaltyDescription") || "Reduces repetition.", step: "0.1", inputMode: "decimal" as const },
    { key: "timeout", label: t("llmSettings.timeout") || "Timeout", description: t("llmSettings.timeoutDescription") || "Request timeout in milliseconds.", step: "1000", inputMode: "numeric" as const },
    { key: "maxRetries", label: t("llmSettings.maxRetries") || "Max Retries", description: t("llmSettings.maxRetriesDescription") || "Retry count when requests fail.", step: "1", inputMode: "numeric" as const },
  ] as const;

  const advancedToggleFields = [
    { key: "streaming", label: t("llmSettings.streaming") || "Streaming", description: t("llmSettings.streamingDescription") || "Stream model output into the chat UI." },
    { key: "streamUsage", label: t("llmSettings.streamUsage") || "Stream Usage", description: t("llmSettings.streamUsageDescription") || "Capture token usage during streaming responses." },
  ] as const;

  const visibleAdvancedNumberFields = advancedNumberFields.filter((field) =>
    supportsModelAdvancedNumberSetting(llmType, field.key),
  );
  const visibleAdvancedToggleFields = advancedToggleFields.filter((field) =>
    supportsModelAdvancedBooleanSetting(llmType, field.key),
  );

  /* ─────────────────────────────────────────────────────────────────────
     布局样式
     ───────────────────────────────────────────────────────────────────── */

  const containerClassName = cn(
    "h-full text-text transition-all duration-300 overflow-hidden",
    isPanel ? "w-full bg-background" : "magic-border border-l border-border ",
    !isPanel && (isOpen ? "w-64" : "w-0"),
  );
  const scrollAreaClassName = cn(
    "h-full transition-opacity duration-300 overflow-y-auto fantasy-scrollbar",
    isPanel ? "w-full bg-background" : "w-64",
    isOpen ? "opacity-100" : "opacity-0",
  );

  /* ─────────────────────────────────────────────────────────────────────
     渲染
     ───────────────────────────────────────────────────────────────────── */

  return (
    <div className={containerClassName}>
      <div className={scrollAreaClassName}>
        {/* 标题栏（仅侧边栏模式） */}
        {!isPanel && (
          <div className="flex justify-between items-center p-3 border-b border-border bg-input">
            <h1 className={"text-base magical-text "}>{t("modelSettings.title")}</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {trackButtonClick("ModelSidebar", "关闭模型设置"); toggleSidebar();}}
              className="w-6 h-6 text-cream bg-surface border border-stroke hover:bg-muted-surface hover:border-stroke-strong hover:text-primary-400 hover:shadow-[0_0_8px_rgba(251,146,60,0.4)]"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        <div className="p-3 sm:p-3 p-2">
          {/* 配置列表头部 */}
          <div className="mb-3 sm:mb-3 mb-2">
            <div className="flex justify-between items-center mb-2 sm:mb-2 mb-1">
              <label className={`text-cream text-xs sm:text-xs text-2xs font-medium ${fontClass}`}>
                {t("modelSettings.configurations") || "API Configurations"}
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {trackButtonClick("ModelSidebar", "创建新配置"); handleCreateConfig();}}
                className="text-xs sm:text-xs text-2xs text-primary hover:text-cream px-2 py-1 sm:px-2 sm:py-1 px-1.5 py-0.5 h-auto border border-border hover:border-primary hover:shadow-[0_0_6px_rgba(209,163,92,0.2)] flex items-center gap-1"
              >
                <Plus className="sm:w-2.5 sm:h-2.5 w-2 h-2" />
                <span className="sm:block hidden">{t("modelSettings.newConfig") || "New Config"}</span>
                <span className="sm:hidden block">+</span>
              </Button>
            </div>

            {!showNewConfigForm && configs.length > 0 && (
              <div className="mb-1.5 sm:mb-1.5 mb-1">
                <p className={`text-xs sm:text-xs text-2xs italic transition-colors duration-200 ${isConfigHovered ? "text-primary" : "text-text-muted"}`}>
                  {t("modelSettings.doubleClickToEditName") || "Double-click configuration name to edit"}
                </p>
              </div>
            )}

            {/* 配置项列表 */}
            {configs.length > 0 && (
              <div className="mb-3 sm:mb-3 mb-2 flex flex-col gap-1.5 sm:gap-1.5 gap-1 max-h-50 overflow-y-auto fantasy-scrollbar pr-1">
                {configs.map((config, idx) => (
                  <div
                    key={config.id}
                    className={`flex items-center justify-between p-1.5 sm:p-1.5 p-1 rounded-md cursor-pointer text-sm sm:text-sm text-xs transition-all duration-200 group ${
                      activeConfigId === config.id
                        ? "bg-muted-surface border border-primary shadow-[0_0_8px_rgba(209,163,92,0.2)]"
                        : "bg-card hover:bg-stroke border border-transparent hover:border-border"
                    }`}
                    onClick={() => handleSwitchConfig(config.id)}
                    onMouseEnter={() => setIsConfigHovered(true)}
                    onMouseLeave={() => setIsConfigHovered(false)}
                  >
                    <div className="relative flex items-center flex-1 min-w-0 group/name">
                      {editingConfigId === config.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={handleSaveName}
                          onKeyDown={handleKeyDown}
                          className="bg-surface border border-border rounded py-0.5 px-1 sm:py-0.5 sm:px-1 py-0 px-0.5 text-xs sm:text-xs text-2xs text-cream w-full focus:border-primary focus:outline-none"
                          onClick={e => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <>
                          <span
                            className="text-xs sm:text-xs text-2xs truncate cursor-text hover:text-cream transition-colors"
                            onDoubleClick={(e) => handleStartEditName(config, e)}
                          >
                            {config.name}
                          </span>
                          {showEditHint && configs.length > 1 && (
                            <span
                              className={`absolute ${idx === 0 ? "top-full mt-1" : "-top-6"} left-0 z-[9999] bg-overlay text-primary text-2xs sm:text-2xs text-3xs px-2 py-1 sm:px-2 sm:py-1 px-1 py-0.5 rounded border border-primary whitespace-nowrap opacity-0 group-hover/name:opacity-100 transition-all duration-200 pointer-events-none shadow-[0_0_8px_color-mix(in srgb,var(--color-primary) 20%,transparent)]`}
                            >
                              {t("modelSettings.doubleClickToEditName")}
                            </span>
                          )}
                          <span className="ml-2 text-xs sm:text-xs text-3xs text-text-muted px-1.5 py-0.5 sm:px-1.5 sm:py-0.5 px-1 py-0 rounded bg-surface border border-stroke flex-shrink-0">{config.type}</span>
                        </>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { trackButtonClick("ModelSidebar", "删除配置"); e.stopPropagation(); handleDeleteConfig(config.id); }}
                      className="text-red-400 hover:text-red-300 text-xs sm:text-xs text-2xs p-1 sm:p-1 p-0.5 h-auto w-auto ml-1 flex-shrink-0"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 活跃配置概览 */}
          {!showNewConfigForm && activeConfigId && (
            <div className="border border-border rounded-md p-2.5 sm:p-2.5 p-2 mb-3 sm:mb-3 mb-2 bg-surface bg-opacity-50 backdrop-blur-sm">
              <div className="mb-1.5 sm:mb-1.5 mb-1">
                <span className="text-xs sm:text-xs text-2xs text-text-muted">{t("modelSettings.llmType") || "API Type"}:</span>
                <span className="ml-2 text-xs sm:text-xs text-2xs text-cream">{describeLlmType(llmType)}</span>
              </div>
              {llmType !== "gemini" && (
                <div className="mb-1.5 sm:mb-1.5 mb-1">
                  <span className="text-xs sm:text-xs text-2xs text-text-muted">{t("modelSettings.baseUrl") || "Base URL"}:</span>
                  <span className="ml-2 text-xs sm:text-xs text-2xs text-cream break-all">
                    {baseUrl.trim() || getBaseUrlPlaceholder(llmType)}
                  </span>
                </div>
              )}
              {llmType !== "ollama" && (
                <div className="mb-1.5 sm:mb-1.5 mb-1">
                  <span className="text-xs sm:text-xs text-2xs text-text-muted">{t("modelSettings.apiKey") || "API Key"}:</span>
                  <span className="ml-2 text-xs sm:text-xs text-2xs text-cream">{"•".repeat(Math.min(10, apiKey.length))}</span>
                </div>
              )}
              <div className="mb-1.5 sm:mb-1.5 mb-1">
                <label className="text-xs sm:text-xs text-2xs text-text-muted mr-2">{t("modelSettings.model") || "Model"}:</label>
                {llmType !== "ollama" && !modelListEmpty && availableModels.length > 0 ? (
                  <select
                    value={model}
                    onChange={(e) => handleInlineModelChange(e.target.value)}
                    className="bg-card border border-border rounded py-0.5 px-1.5 sm:py-0.5 sm:px-1.5 py-0 px-1 text-cream text-xs sm:text-xs text-2xs max-w-[200px] sm:max-w-[200px] max-w-[150px] truncate focus:border-primary focus:outline-none transition-colors"
                  >
                    <option value="" disabled className="truncate">{t("modelSettings.selectModel") || "Select a model..."}</option>
                    {availableModels.map((option) => (
                      <option key={option} value={option} className="truncate">{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => handleInlineModelChange(e.target.value)}
                    className="bg-card border border-border rounded py-0.5 px-1.5 sm:py-0.5 sm:px-1.5 py-0 px-1 text-cream text-xs sm:text-xs text-2xs max-w-[200px] sm:max-w-[200px] max-w-[150px] focus:border-primary focus:outline-none transition-colors"
                    placeholder={getModelPlaceholder(llmType)}
                  />
                )}
              </div>
            </div>
          )}

          {/* 新建配置表单 */}
          {showNewConfigForm && (
            <NewConfigFormSection
              fontClass={fontClass}
              t={t}
              trackButtonClick={trackButtonClick}
              state={state}
              actions={actions}
              helpers={helpers}
              visibleAdvancedNumberFields={visibleAdvancedNumberFields}
              visibleAdvancedToggleFields={visibleAdvancedToggleFields}
            />
          )}

          {/* 活跃配置高级设置 */}
          {!showNewConfigForm && activeConfigId && (
            <ActiveConfigSection
              fontClass={fontClass}
              t={t}
              trackButtonClick={trackButtonClick}
              state={state}
              actions={actions}
              visibleAdvancedNumberFields={visibleAdvancedNumberFields}
              visibleAdvancedToggleFields={visibleAdvancedToggleFields}
            />
          )}

          {/* 空配置提示 */}
          {configs.length === 0 && !showNewConfigForm && (
            <div className="flex flex-col items-center justify-center py-3 sm:py-3 py-2">
              <p className="text-xs sm:text-xs text-2xs text-text-muted mb-2 sm:mb-2 mb-1">
                {t("modelSettings.noConfigs")}
              </p>
              <Button
                onClick={(e) => { trackButtonClick("ModelSidebar", "创建第一个配置"); e.stopPropagation(); handleCreateConfig(); }}
                className={`bg-muted-surface hover:bg-ink text-cream font-normal py-1.5 px-2 sm:py-1.5 sm:px-2 py-1 px-1.5 h-auto text-xs sm:text-xs text-2xs border border-primary hover:shadow-[0_0_8px_rgba(209,163,92,0.2)] ${fontClass} flex items-center justify-center gap-1 w-full max-w-[200px] sm:max-w-[200px] max-w-[150px]`}
              >
                <Plus className="sm:w-2.5 sm:h-2.5 w-2 h-2" />
                <span className="sm:block hidden">{t("modelSettings.createFirstConfig") || "Create Your First Configuration"}</span>
                <span className="sm:hidden block">Create Config</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
