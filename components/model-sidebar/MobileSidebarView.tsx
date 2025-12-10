import React from "react";
import { X, Plus, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { LLMType, SidebarViewProps } from "./types";
import { Button } from "@/components/ui/button";

// ╔════════════════════════════════════════╗
// ║ 移动端模型侧边栏视图（纯展示层）        ║
// ╚════════════════════════════════════════╝

export function MobileSidebarView(props: SidebarViewProps) {
  const {
    isOpen,
    fontClass,
    serifFontClass,
    t,
    trackButtonClick,
    state,
    actions,
    helpers,
  } = props;

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm">
      <div className="relative w-full h-full   text-text flex flex-col">
        {/* ===== 头部 ===== */}
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border bg-gradient-to-r from-canvas to-input">
          <h1 className={"text-lg magical-text "}>{t("modelSettings.title")}</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {trackButtonClick("ModelSidebar", "关闭模型设置"); toggleSidebar();}}
            className="w-8 h-8 text-cream bg-surface rounded-full border border-stroke hover:bg-muted-surface hover:border-stroke-strong hover:text-primary-400 hover:shadow-[0_0_8px_rgba(251,146,60,0.4)]"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* ===== 主体滚动区 ===== */}
        <div className="flex-1 overflow-y-auto fantasy-scrollbar">
          <div className="p-4 pb-20">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-3">
                <label className={`text-cream text-sm font-medium ${fontClass}`}>
                  {t("modelSettings.configurations") || "API Configurations"}
                </label>
                <Button 
                  variant="outline"
                  onClick={(e) => {trackButtonClick("ModelSidebar", "创建新配置"); handleCreateConfig();}}
                  className="text-sm text-primary hover:text-cream px-3 py-2 h-auto border border-border hover:border-primary hover:shadow-[0_0_6px_rgba(209,163,92,0.2)] flex items-center gap-2"
                >
                  <Plus className="w-3 h-3" />
                  {t("modelSettings.newConfig") || "New Config"}
                </Button>
              </div>
              
              {!showNewConfigForm && configs.length > 0 && (
                <div className="mb-2">
                  <p className={`text-sm italic transition-colors duration-200 ${isConfigHovered ? "text-primary" : "text-text-muted"}`}>
                    {t("modelSettings.doubleClickToEditName") || "Double-click configuration name to edit"}
                  </p>
                </div>
              )}
              
              {configs.length > 0 && (
                <div className="mb-4 space-y-2 max-h-48 overflow-y-auto fantasy-scrollbar">
                  {configs.map((config, idx) => (
                    <div 
                      key={config.id} 
                      className={`flex items-center justify-between p-3 rounded-md cursor-pointer text-sm transition-all duration-200 group ${
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
                            className="bg-surface border border-border rounded py-1 px-2 text-sm text-cream w-full focus:border-primary focus:outline-none"
                            onClick={e => e.stopPropagation()}
                            autoFocus
                          />
                        ) : (
                          <>
                            <span 
                              className="text-sm truncate cursor-text hover:text-cream transition-colors" 
                              onDoubleClick={(e) => handleStartEditName(config, e)}
                            >
                              {config.name}
                            </span>
                            {showEditHint && configs.length > 1 && (
                              <span
                                className={`absolute ${idx === 0 ? "top-full mt-1" : "-top-8"} left-0 z-[9999] bg-overlay text-primary text-xs px-2 py-1 rounded border border-primary whitespace-nowrap opacity-0 group-hover/name:opacity-100 transition-all duration-200 pointer-events-none shadow-[0_0_8px_color-mix(in srgb,var(--color-primary) 20%,transparent)]`}
                              >
                                {t("modelSettings.doubleClickToEditName")}
                              </span>
                            )}
                            <span className="ml-3 text-xs text-text-muted px-2 py-1 rounded bg-surface border border-stroke flex-shrink-0">{config.type}</span>
                          </>
                        )}
                      </div>
                      <Button 
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { trackButtonClick("ModelSidebar", "删除配置"); e.stopPropagation(); handleDeleteConfig(config.id); }}
                        className="text-red-400 hover:text-red-300 text-lg p-2 h-auto w-auto ml-2 flex-shrink-0"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!showNewConfigForm && activeConfigId && (
              <div className="border border-border rounded-md p-4 mb-4 bg-surface bg-opacity-50 backdrop-blur-sm">
                <div className="mb-3">
                  <span className="text-sm text-text-muted">{t("modelSettings.llmType") || "API Type"}:</span>
                  <span className="ml-2 text-sm text-cream">{describeLlmType(llmType)}</span>
                </div>
                {llmType !== "gemini" && (
                  <div className="mb-3">
                    <span className="text-sm text-text-muted">{t("modelSettings.baseUrl") || "Base URL"}:</span>
                    <span className="ml-2 text-sm text-cream break-all">
                      {baseUrl.trim() || getBaseUrlPlaceholder(llmType)}
                    </span>
                  </div>
                )}
                {llmType !== "ollama" && (
                  <div className="mb-3">
                    <span className="text-sm text-text-muted">{t("modelSettings.apiKey") || "API Key"}:</span>
                    <span className="ml-2 text-sm text-cream">{"•".repeat(Math.min(10, apiKey.length))}</span>
                  </div>
                )}
                <div className="mb-3">
                  <label className="text-sm text-text-muted mr-2">{t("modelSettings.model") || "Model"}:</label>
                  {llmType !== "ollama" && !modelListEmpty && availableModels.length > 0 ? (
                    <select
                      value={model}
                      onChange={(e) => handleInlineModelChange(e.target.value)}
                      className="bg-card border border-border rounded py-2 px-3 text-cream text-sm w-full truncate focus:border-primary focus:outline-none transition-colors"
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
                      className="bg-card border border-border rounded py-2 px-3 text-cream text-sm w-full focus:border-primary focus:outline-none transition-colors"
                      placeholder={getModelPlaceholder(llmType)}
                    />
                  )}
                </div>
              </div>
            )}

            {showNewConfigForm && (
              <div className="mb-6">
                <div className="mb-4">
                  <label className={`block text-cream text-sm font-medium mb-2 ${fontClass}`}>
                    {t("modelSettings.configName")}
                  </label>
                  <input
                    type="text"
                    className="bg-card border border-border rounded w-full py-3 px-3 text-sm text-text leading-tight focus:outline-none focus:border-primary transition-colors"
                    placeholder={t("modelSettings.configNamePlaceholder")}
                    value={newConfigName}
                    onChange={(e) => setNewConfigName(e.target.value)}
                  />
                </div>

                <div className="mb-4">
                  <label className={`block text-cream text-sm font-medium mb-2 ${fontClass}`}>
                    {t("modelSettings.llmType") || "API Type"}
                  </label>
                  <select
                    value={llmType}
                    onChange={(e) => {
                      setLlmType(e.target.value as LLMType);
                    }}
                    className="w-full bg-card border border-border rounded py-3 px-3 text-sm text-text leading-tight focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="openai">OpenAI API</option>
                    <option value="ollama">Ollama API</option>
                    <option value="gemini">Gemini API</option>
                  </select>
                </div>

                {llmType !== "gemini" && (
                  <div className="mb-4">
                    <label htmlFor="baseUrl" className={`block text-cream text-sm font-medium mb-2 ${fontClass}`}>
                      {t("modelSettings.baseUrl")}
                    </label>
                    <input
                      type="text"
                      id="baseUrl"
                      className="bg-card border border-border rounded w-full py-3 px-3 text-sm text-text leading-tight focus:outline-none focus:border-primary transition-colors"
                      placeholder={getBaseUrlPlaceholder(llmType)}
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                    />
                  </div>
                )}

                {llmType !== "ollama" && (
                  <div className="mb-4">
                    <label htmlFor="apiKey" className={`block text-cream text-sm font-medium mb-2 ${fontClass}`}>
                      {t("modelSettings.apiKey") || "API Key"}
                    </label>
                    <input
                      type="text"
                      id="apiKey"
                      className="bg-card border border-border rounded w-full py-3 px-3 text-sm text-text leading-tight focus:outline-none focus:border-primary transition-colors"
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                )}

                <div className="mb-4">
                  <div className="relative">
                    {llmType !== "ollama" && (
                      <Button 
                        className={`bg-muted-surface hover:bg-ink text-cream font-normal py-3 px-4 h-auto text-sm border border-primary w-full magical-text ${fontClass}`} 
                        onClick={() => handleGetModelList(llmType, baseUrl, apiKey)}
                      >{t("modelSettings.getModelList") || "Get Model List"}</Button>
                    )}
                    
                    {getModelListSuccess && (
                      <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-stroke bg-opacity-80 rounded transition-opacity">
                        <div className="flex items-center">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 animate-pulse" />
                          <span className={`text-white text-sm ${fontClass}`}>
                            {t("modelSettings.getModelListSuccess") || "Get Model List Success"}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {getModelListError && (
                      <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-stroke bg-opacity-80 rounded transition-opacity">
                        <div className="flex items-center">
                          <XCircle className="h-5 w-5 text-red-500 mr-2 animate-pulse" />
                          <span className={`text-white text-sm ${fontClass}`}>
                            {t("modelSettings.getModelListError") || "Get Model List Error"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="model" className={`block text-cream text-sm font-medium mb-2 ${fontClass}`}>
                    {t("modelSettings.model")}
                  </label>
                  <input
                    type="text"
                    id="model"
                    className="bg-card border border-border rounded w-full py-3 px-3 text-sm text-text leading-tight focus:outline-none focus:border-primary transition-colors"
                    placeholder={getModelPlaceholder(llmType)}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                  {llmType !== "ollama" && availableModels.length > 0 && (
                    <div className="mt-3 text-sm text-text-muted">
                      <p className={`mb-2 ${fontClass}`}>{t("modelSettings.modelList") || "Model List"}</p>
                      <select
                        value={model}
                        onChange={(e) => {
                          trackButtonClick("ModelSidebar", t("modelSettings.selectModel") || "Select a model...");
                          setModel(e.target.value);
                        }}
                        className="w-full bg-card border border-border rounded py-3 px-3 text-text text-sm leading-tight focus:outline-none focus:border-primary transition-colors"
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

                <div className="flex gap-3">
                  <Button
                    onClick={(e) => {trackButtonClick("ModelSidebar", "创建配置"); e.stopPropagation(); handleSave();}}
                    className={`flex-1 bg-muted-surface hover:bg-ink text-cream font-medium py-3 px-4 h-auto text-sm border border-primary magical-text ${fontClass}`}
                  >
                    {t("modelSettings.createConfig") || "Create Configuration"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {trackButtonClick("cancel_create_config_btn", "取消创建配置"); handleCancelCreate();}}
                    className={`px-4 py-3 h-auto bg-card text-sm text-text border border-border hover:bg-stroke ${fontClass}`}
                  >
                    {t("common.cancel") || "Cancel"}
                  </Button>
                </div>
              </div>
            )}

            {!showNewConfigForm && activeConfigId && (
              <div className="space-y-4">
                <div className="relative">
                  <Button
                    onClick={(e) => {trackButtonClick("ModelSidebar", "保存配置"); e.stopPropagation(); handleSave();}}
                    className={`bg-muted-surface hover:bg-ink text-cream font-normal py-3 px-4 h-auto text-sm border border-primary w-full hover:shadow-[0_0_8px_rgba(209,163,92,0.2)] ${fontClass}`}
                  >
                    {t("modelSettings.saveSettings") || "Save Settings"}
                  </Button>

                  {saveSuccess && (
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-stroke bg-opacity-80 rounded transition-opacity backdrop-blur-sm">
                      <div className="flex items-center">
                        <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                        <span className={`text-white text-sm ${fontClass}`}>
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
                    className={`bg-muted-surface hover:bg-ink text-cream font-normal py-3 px-4 h-auto text-sm border border-primary w-full hover:shadow-[0_0_8px_rgba(209,163,92,0.2)] ${fontClass}`}
                  >
                    {isTesting ? (
                      <span className="flex items-center justify-center">
                        <Loader2 className="animate-spin -ml-1 mr-3 h-4 w-4 text-cream" />
                        {t("modelSettings.testing") || "Testing..."}
                      </span>
                    ) : (
                      t("modelSettings.testModel") || "Test Model"
                    )}
                  </Button>

                  {testModelSuccess && (
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-stroke bg-opacity-80 rounded transition-opacity backdrop-blur-sm">
                      <div className="flex items-center">
                        <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                        <span className={`text-white text-sm ${fontClass}`}>
                          {t("modelSettings.testSuccess") || "Model test successful"}
                        </span>
                      </div>
                    </div>
                  )}

                  {testModelError && (
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-stroke bg-opacity-80 rounded transition-opacity backdrop-blur-sm">
                      <div className="flex items-center">
                        <XCircle className="h-5 w-5 text-red-500 mr-2" />
                        <span className={`text-white text-sm ${fontClass}`}>
                          {t("modelSettings.testError") || "Model test failed"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {configs.length === 0 && !showNewConfigForm && (
              <div className="flex flex-col items-center justify-center py-8">
                <p className="text-sm text-text-muted mb-4 text-center">
                  {t("modelSettings.noConfigs")}
                </p>
                <Button
                  onClick={(e) => { trackButtonClick("ModelSidebar", "创建第一个配置"); e.stopPropagation(); handleCreateConfig(); }}
                  className={`bg-muted-surface hover:bg-ink text-cream font-normal py-3 px-4 h-auto text-sm border border-primary hover:shadow-[0_0_8px_rgba(209,163,92,0.2)] ${fontClass} flex items-center justify-center gap-2`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("modelSettings.createFirstConfig") || "Create Your First Configuration"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
