/**
 * ╔════════════════════════════════════════╗
 * ║ 桌面端侧边栏子区块组件                    ║
 * ║                                          ║
 * ║ 从 DesktopSidebarView.tsx 拆分而来       ║
 * ║ 包含：新建配置表单、活跃配置高级设置面板  ║
 * ╚════════════════════════════════════════╝
 */

import React from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { LLMType, SidebarViewProps } from "./types";
import type { NumericModelSettingKey, BooleanModelSettingKey } from "@/lib/model-runtime";

/* ═══════════════════════════════════════════════════════════════════════════
   共享类型
   ═══════════════════════════════════════════════════════════════════════════ */

export interface AdvancedNumberField {
  readonly key: NumericModelSettingKey;
  readonly label: string;
  readonly description: string;
  readonly step: string;
  readonly inputMode: "numeric" | "decimal";
}

export interface AdvancedToggleField {
  readonly key: BooleanModelSettingKey;
  readonly label: string;
  readonly description: string;
}

interface SectionCommonProps {
  fontClass: string;
  t: SidebarViewProps["t"];
  trackButtonClick: SidebarViewProps["trackButtonClick"];
  state: SidebarViewProps["state"];
  actions: SidebarViewProps["actions"];
  helpers: SidebarViewProps["helpers"];
  visibleAdvancedNumberFields: readonly AdvancedNumberField[];
  visibleAdvancedToggleFields: readonly AdvancedToggleField[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   新建配置表单
   ═══════════════════════════════════════════════════════════════════════════ */

export function NewConfigFormSection({
  fontClass, t, trackButtonClick, state, actions, helpers,
  visibleAdvancedNumberFields, visibleAdvancedToggleFields,
}: SectionCommonProps) {
  const {
    llmType, baseUrl, apiKey, model, availableModels,
    newConfigName, advancedSettings,
    getModelListSuccess, getModelListError,
  } = state;
  const {
    setLlmType, setBaseUrl, setApiKey, setNewConfigName, setModel,
    handleGetModelList, handleSave, handleCancelCreate,
    setAdvancedNumberSetting, setAdvancedBooleanSetting,
  } = actions;
  const { getBaseUrlPlaceholder, getModelPlaceholder } = helpers;

  return (
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
          onChange={(e) => { setLlmType(e.target.value as LLMType); }}
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
                <option key={option} value={option} className="bg-card text-text">
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <AdvancedParamsPanel
        fontClass={fontClass}
        t={t}
        advancedSettings={advancedSettings}
        visibleAdvancedNumberFields={visibleAdvancedNumberFields}
        visibleAdvancedToggleFields={visibleAdvancedToggleFields}
        setAdvancedNumberSetting={setAdvancedNumberSetting}
        setAdvancedBooleanSetting={setAdvancedBooleanSetting}
        showDescriptions
      />

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
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   活跃配置高级设置面板
   ═══════════════════════════════════════════════════════════════════════════ */

export function ActiveConfigSection({
  fontClass, t, trackButtonClick, state, actions,
  visibleAdvancedNumberFields, visibleAdvancedToggleFields,
}: Omit<SectionCommonProps, "helpers">) {
  const {
    baseUrl, model, llmType, advancedSettings,
    saveSuccess, isTesting, testModelSuccess, testModelError,
  } = state;
  const { handleSave, handleTestModel, setAdvancedNumberSetting, setAdvancedBooleanSetting } = actions;

  return (
    <div className="space-y-3 sm:space-y-3 space-y-2">
      <AdvancedParamsPanel
        fontClass={fontClass}
        t={t}
        advancedSettings={advancedSettings}
        visibleAdvancedNumberFields={visibleAdvancedNumberFields}
        visibleAdvancedToggleFields={visibleAdvancedToggleFields}
        setAdvancedNumberSetting={setAdvancedNumberSetting}
        setAdvancedBooleanSetting={setAdvancedBooleanSetting}
        showDescriptions={false}
      />

      {/* 保存按钮 */}
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

      {/* 测试按钮 */}
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
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   高级参数面板（内部共享组件）
   ═══════════════════════════════════════════════════════════════════════════ */

function AdvancedParamsPanel({
  fontClass, t, advancedSettings,
  visibleAdvancedNumberFields, visibleAdvancedToggleFields,
  setAdvancedNumberSetting, setAdvancedBooleanSetting,
  showDescriptions,
}: {
  fontClass: string;
  t: SidebarViewProps["t"];
  advancedSettings: SidebarViewProps["state"]["advancedSettings"];
  visibleAdvancedNumberFields: readonly AdvancedNumberField[];
  visibleAdvancedToggleFields: readonly AdvancedToggleField[];
  setAdvancedNumberSetting: SidebarViewProps["actions"]["setAdvancedNumberSetting"];
  setAdvancedBooleanSetting: SidebarViewProps["actions"]["setAdvancedBooleanSetting"];
  showDescriptions: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-2.5 sm:p-2.5 p-2">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className={`text-cream text-xs sm:text-xs text-2xs font-medium ${fontClass}`}>
            {t("llmSettings.advancedParams") || "Advanced Parameters"}
          </div>
          <p className={`mt-0.5 text-[10px] sm:text-[10px] text-[9px] text-text-muted ${fontClass}`}>
            {t("llmSettings.optional") || "Optional; leave empty to use defaults"}
          </p>
        </div>
      </div>
      <div className={`grid grid-cols-1 ${showDescriptions ? "gap-2 sm:gap-2" : "mt-2 gap-2"}`}>
        {visibleAdvancedNumberFields.map((field) => (
          <label key={field.key} className="block rounded-md border border-border/60 bg-background/60 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs sm:text-xs text-2xs text-cream ${fontClass}`}>{field.label}</span>
              <input
                type="number"
                inputMode={field.inputMode}
                step={field.step}
                value={advancedSettings[field.key] ?? ""}
                onChange={(e) => setAdvancedNumberSetting(field.key, e.target.value)}
                className="w-28 rounded border border-border bg-card px-2 py-1 text-right text-xs sm:text-xs text-2xs text-text focus:border-primary focus:outline-none"
                placeholder={t("llmSettings.optional") || "Optional"}
              />
            </div>
            {showDescriptions && (
              <p className={`mt-1 text-[10px] sm:text-[10px] text-[9px] text-text-muted ${fontClass}`}>
                {field.description}
              </p>
            )}
          </label>
        ))}
      </div>
      <div className="mt-2 space-y-2">
        {visibleAdvancedToggleFields.map((field) => (
          <div key={field.key} className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/60 p-2">
            <div>
              <div className={`text-xs sm:text-xs text-2xs text-cream ${fontClass}`}>{field.label}</div>
              {showDescriptions && (
                <p className={`mt-1 text-[10px] sm:text-[10px] text-[9px] text-text-muted ${fontClass}`}>
                  {field.description}
                </p>
              )}
            </div>
            <Switch
              checked={advancedSettings[field.key] ?? true}
              onCheckedChange={(checked) => setAdvancedBooleanSetting(field.key, checked)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
