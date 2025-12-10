import React from "react";
import { ChevronRight, Plus, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LLMType, SidebarViewProps } from "./types";
import { Button } from "@/components/ui/button";

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
    newConfigName,
    llmType,
    baseUrl,
    model,
    apiKey,
    availableModels,
    modelListEmpty,
    saveSuccess,
    getModelListSuccess,
    getModelListError,
    isTesting,
    testModelSuccess,
    testModelError,
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
    handleGetModelList,
    handleSave,
    handleCancelCreate,
    setLlmType,
    setBaseUrl,
    setApiKey,
    setNewConfigName,
    setModel,
    handleInlineModelChange,
    handleTestModel,
  } = actions;

  const { describeLlmType, getBaseUrlPlaceholder, getModelPlaceholder } = helpers;
  const isPanel = variant === "panel";
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

  return (
    <div className={containerClassName}>
      <div className={scrollAreaClassName}>
        {!isPanel && (
          <div className="flex justify-between items-center p-3 border-b border-border bg-gradient-to-r from-canvas to-input">
            <h1 className={"text-base magical-text "}>{t("modelSettings.title")}</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {trackButtonClick("ModelSidebar", "关闭模型设置"); toggleSidebar();}}
              className="w-6 h-6 text-cream bg-surface border border-stroke hover:bg-muted-surface hover:border-stroke-strong hover:text-primary-400 hover:shadow-[0_0_8px_rgba(251,146,60,0.4)]"
            >
              <ChevronRight className="w-3.5 h-3.5 transition-transform duration-300" />
            </Button>
          </div>
        )}
        <div className="p-3 sm:p-3 p-2">
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

          {showNewConfigForm && (
            <div className="mb-4 sm:mb-4 mb-3">
              <div className="mb-4 sm:mb-4 mb-3">
                <label className={`block text-cream text-xs sm:text-xs text-2xs font-medium mb-2 sm:mb-2 mb-1 ${fontClass}`}>
                  {t("modelSettings.configName")}
                </label>
                <input
                  type="text"
                  className="bg-card border border-border rounded w-full py-1.5 px-2 sm:py-1.5 sm:px-2 py-1 px-1.5 text-xs sm:text-xs text-2xs text-text leading-tight focus:outline-none focus:border-primary transition-colors"
                  placeholder={t("modelSettings.configNamePlaceholder")}
                  value={newConfigName}
                  onChange={(e) => setNewConfigName(e.target.value)}
                />
              </div>

              <div className="mb-4 sm:mb-4 mb-3">
                <label className={`block text-cream text-xs sm:text-xs text-2xs font-medium mb-2 sm:mb-2 mb-1 ${fontClass}`}>
                  {t("modelSettings.llmType") || "API Type"}
                </label>
                <select
                  value={llmType}
                  onChange={(e) => {
                    setLlmType(e.target.value as LLMType);
                  }}
                  className="w-full bg-card border border-border rounded py-1.5 px-2 sm:py-1.5 sm:px-2 py-1 px-1.5 text-xs sm:text-xs text-2xs text-text leading-tight focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="openai">OpenAI API</option>
                  <option value="ollama">Ollama API</option>
                  <option value="gemini">Gemini API</option>
                </select>
              </div>

              {llmType !== "gemini" && (
                <div className="mb-4 sm:mb-4 mb-3">
                  <label htmlFor="baseUrl" className={`block text-cream text-xs sm:text-xs text-2xs font-medium mb-2 sm:mb-2 mb-1 ${fontClass}`}>
                    {t("modelSettings.baseUrl")}
                  </label>
                  <input
                    type="text"
                    id="baseUrl"
                    className="bg-card border border-border rounded w-full py-1.5 px-2 sm:py-1.5 sm:px-2 py-1 px-1.5 text-xs sm:text-xs text-2xs text-text leading-tight focus:outline-none focus:border-primary transition-colors"
                    placeholder={getBaseUrlPlaceholder(llmType)}
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>
              )}

              {llmType !== "ollama" && (
                <div className="mb-4 sm:mb-4 mb-3">
                  <label htmlFor="apiKey" className={`block text-cream text-xs sm:text-xs text-2xs font-medium mb-2 sm:mb-2 mb-1 ${fontClass}`}>
                    {t("modelSettings.apiKey") || "API Key"}
                  </label>
                  <input
                    type="text"
                    id="apiKey"
                    className="bg-card border border-border rounded w-full py-1.5 px-2 sm:py-1.5 sm:px-2 py-1 px-1.5 text-xs sm:text-xs text-2xs text-text leading-tight focus:outline-none focus:border-primary transition-colors"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              )}

              <div className="mb-4 sm:mb-4 mb-3">
                <div className="relative">
                  {llmType !== "ollama" && (
                    <Button 
                      className={`bg-muted-surface hover:bg-ink text-cream font-normal py-1.5 px-2 sm:py-1.5 sm:px-2 py-1 px-1.5 h-auto text-xs sm:text-xs text-2xs border border-primary w-full magical-text ${fontClass}`} 
                      onClick={() => handleGetModelList(llmType, baseUrl, apiKey)}
                    >{t("modelSettings.getModelList") || "Get Model List"}</Button>
                  )}
                  
                  {getModelListSuccess && (
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-stroke bg-opacity-80 rounded transition-opacity">
                      <div className="flex items-center">
                        <CheckCircle2 className="h-4 w-4 sm:h-4 sm:w-4 h-3 w-3 text-green-500 mr-2 sm:mr-2 mr-1 animate-pulse" />
                        <span className={`text-white text-xs sm:text-xs text-2xs ${fontClass}`}>
                          {t("modelSettings.getModelListSuccess") || "Get Model List Success"}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {getModelListError && (
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-stroke bg-opacity-80 rounded transition-opacity">
                      <div className="flex items-center">
                        <XCircle className="h-4 w-4 sm:h-4 sm:w-4 h-3 w-3 text-red-500 mr-2 sm:mr-2 mr-1 animate-pulse" />
                        <span className={`text-white text-xs sm:text-xs text-2xs ${fontClass}`}>
                          {t("modelSettings.getModelListError") || "Get Model List Error"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4 sm:mb-4 mb-3">
                <label htmlFor="model" className={`block text-cream text-xs sm:text-xs text-2xs font-medium mb-2 sm:mb-2 mb-1 ${fontClass}`}>
                  {t("modelSettings.model")}
                </label>
                <input
                  type="text"
                  id="model"
                  className="bg-card border border-border rounded w-full py-1.5 px-2 sm:py-1.5 sm:px-2 py-1 px-1.5 text-xs sm:text-xs text-2xs text-text leading-tight focus:outline-none focus:border-primary transition-colors"
                  placeholder={getModelPlaceholder(llmType)}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
                {llmType !== "ollama" && availableModels.length > 0 && (
                  <div className="mt-2 text-xs sm:text-xs text-2xs text-text-muted">
                    <p className={`mb-1 sm:mb-1 mb-0.5 ${fontClass}`}>{t("modelSettings.modelList") || "Model List"}</p>
                    <select
                      value={model}
                      onChange={(e) => {
                        trackButtonClick("ModelSidebar", t("modelSettings.selectModel") || "Select a model...");
                        setModel(e.target.value);
                      }}
                      className="w-full bg-card border border-border rounded py-2 px-3 sm:py-2 sm:px-3 py-1.5 px-2 text-text text-sm sm:text-sm text-xs leading-tight focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="" disabled className="text-text-muted">
                        {t("modelSettings.selectModel") || "Select a model..."}
                      </option>
                      {availableModels.map((option) => (
                        <option
                          key={option}
                          value={option}
                          className="bg-card text-text"
                        >
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-2 sm:gap-2 gap-1">
                <Button
                  onClick={(e) => {trackButtonClick("ModelSidebar", "创建配置"); e.stopPropagation(); handleSave();}}
                  className={`flex-1 bg-muted-surface hover:bg-ink text-cream font-medium py-1.5 px-2 sm:py-1.5 sm:px-2 py-1 px-1.5 h-auto text-xs sm:text-xs text-2xs border border-primary magical-text ${fontClass}`}
                >
                  <span className="sm:block hidden">{t("modelSettings.createConfig") || "Create Configuration"}</span>
                  <span className="sm:hidden block">Create</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {trackButtonClick("cancel_create_config_btn", "取消创建配置"); handleCancelCreate();}}
                  className={`px-2 py-1.5 sm:px-2 sm:py-1.5 px-1.5 py-1 h-auto bg-card text-xs sm:text-xs text-2xs text-text border border-border hover:bg-stroke ${fontClass}`}
                >
                  {t("common.cancel") || "Cancel"}
                </Button>
              </div>
            </div>
          )}

          {!showNewConfigForm && activeConfigId && (
            <div className="space-y-3 sm:space-y-3 space-y-2">
              <div className="relative">
                <Button
                  onClick={(e) => {trackButtonClick("ModelSidebar", "保存配置"); e.stopPropagation(); handleSave();}}
                  className={`bg-muted-surface hover:bg-ink text-cream font-normal py-1.5 px-2 sm:py-1.5 sm:px-2 py-1 px-1.5 h-auto text-xs sm:text-xs text-2xs border border-primary w-full hover:shadow-[0_0_8px_rgba(209,163,92,0.2)] ${fontClass}`}
                >
                  {t("modelSettings.saveSettings") || "Save Settings"}
                </Button>

                {saveSuccess && (
                  <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-stroke bg-opacity-80 rounded transition-opacity backdrop-blur-sm">
                    <div className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 sm:h-4 sm:w-4 h-3 w-3 text-green-500 mr-1.5 sm:mr-1.5 mr-1" />
                      <span className={`text-white text-xs sm:text-xs text-2xs ${fontClass}`}>
                        {t("modelSettings.settingsSaved") || "Settings Saved"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <Button
                  onClick={(e) => {trackButtonClick("ModelSidebar", "测试模型"); e.stopPropagation(); handleTestModel();}}
                  disabled={isTesting || (!baseUrl && llmType !== "gemini") || !model}
                  className={`bg-muted-surface hover:bg-ink text-cream font-normal py-1.5 px-2 sm:py-1.5 sm:px-2 py-1 px-1.5 h-auto text-xs sm:text-xs text-2xs border border-primary w-full hover:shadow-[0_0_8px_rgba(209,163,92,0.2)] ${fontClass}`}
                >
                  {isTesting ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="animate-spin -ml-1 mr-2 h-3 w-3 sm:h-3 sm:w-3 h-2.5 w-2.5 text-cream" />
                      <span className="sm:block hidden">{t("modelSettings.testing") || "Testing..."}</span>
                      <span className="sm:hidden block">Test...</span>
                    </span>
                  ) : (
                    <><span className="sm:block hidden">{t("modelSettings.testModel") || "Test Model"}</span><span className="sm:hidden block">Test</span></>
                  )}
                </Button>

                {testModelSuccess && (
                  <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-stroke bg-opacity-80 rounded transition-opacity backdrop-blur-sm">
                    <div className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 sm:h-4 sm:w-4 h-3 w-3 text-green-500 mr-1.5 sm:mr-1.5 mr-1" />
                      <span className={`text-white text-xs sm:text-xs text-2xs ${fontClass}`}>
                        {t("modelSettings.testSuccess") || "Model test successful"}
                      </span>
                    </div>
                  </div>
                )}

                {testModelError && (
                  <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-stroke bg-opacity-80 rounded transition-opacity backdrop-blur-sm">
                    <div className="flex items-center">
                      <XCircle className="h-4 w-4 sm:h-4 sm:w-4 h-3 w-3 text-red-500 mr-1.5 sm:mr-1.5 mr-1" />
                      <span className={`text-white text-xs sm:text-xs text-2xs ${fontClass}`}>
                        {t("modelSettings.testError") || "Model test failed"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
