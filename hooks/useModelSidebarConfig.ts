/**
 * @input  hooks/useModelSidebarConfig/helpers, hooks/useModelSidebarConfig/model-list, hooks/useModelSidebarConfig/test-model, lib/model-runtime, lib/store/model-store
 * @output useModelSidebarConfig, describeLlmType, getBaseUrlPlaceholder, getModelPlaceholder
 * @pos    模型侧边栏配置 Hook - ModelSidebar 配置管理核心逻辑
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                     useModelSidebarConfig Hook                           ║
 * ║                                                                          ║
 * ║  ModelSidebar 配置管理核心逻辑                                             ║
 * ║  收口基础配置与高级采样参数，统一写入 model-store 单一状态源                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback, useEffect, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { SidebarState, SidebarActions } from "@/components/model-sidebar/types";
import {
  syncModelConfigToStorage,
  type APIConfig,
  type BooleanModelSettingKey,
  type LLMType,
  type ModelAdvancedSettings,
  type NumericModelSettingKey,
} from "@/lib/model-runtime";
import { useModelStore } from "@/lib/store/model-store";
import {
  DEFAULT_FORM_ADVANCED_SETTINGS,
  buildConfigDraft,
  describeLlmType,
  generateConfigName as buildConfigName,
  getBaseUrlPlaceholder,
  getModelPlaceholder,
  toFormAdvancedSettings,
} from "@/hooks/useModelSidebarConfig/helpers";
import { fetchModelList } from "@/hooks/useModelSidebarConfig/model-list";
import { testModelConnection } from "@/hooks/useModelSidebarConfig/test-model";

export { describeLlmType, getBaseUrlPlaceholder, getModelPlaceholder } from "@/hooks/useModelSidebarConfig/helpers";

const DEFAULT_API_KEY = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_KEY || "" : "";
const DEFAULT_API_URL = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL || "" : "";

/* ═══════════════════════════════════════════════════════════════════════════
   主 Hook
   ═══════════════════════════════════════════════════════════════════════════ */

export function useModelSidebarConfig() {
  const [configs, setConfigs] = useState<APIConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState("");
  const [showNewConfigForm, setShowNewConfigForm] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [showEditHint] = useState(true);
  const [isConfigHovered, setIsConfigHovered] = useState(false);

  const [llmType, setLlmTypeState] = useState<LLMType>("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [newConfigName, setNewConfigName] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelListEmpty, setModelListEmpty] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<ModelAdvancedSettings>(DEFAULT_FORM_ADVANCED_SETTINGS);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [getModelListSuccess, setGetModelListSuccess] = useState(false);
  const [getModelListError, setGetModelListError] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testModelSuccess, setTestModelSuccess] = useState(false);
  const [testModelError, setTestModelError] = useState(false);

  const storeConfigs = useModelStore((state) => state.configs);
  const storeActiveConfigId = useModelStore((state) => state.activeConfigId);
  const setStoreConfigs = useModelStore((state) => state.setConfigs);
  const setStoreActiveConfig = useModelStore((state) => state.setActiveConfig);

  const persistConfigs = useCallback((next: APIConfig[]) => {
    const normalized = Array.isArray(next) ? next : [];
    setConfigs(normalized);
    setStoreConfigs(normalized);
    return normalized;
  }, [setStoreConfigs]);

  const handleGetModelList = useCallback(async (type: LLMType, targetUrl: string, targetKey: string) => {
    if (type === "ollama") return;

    setGetModelListError(false);
    setGetModelListSuccess(false);
    setModelListEmpty(false);
    try {
      const list = await fetchModelList(type, targetUrl, targetKey);
      setAvailableModels(list);
      setModelListEmpty(list.length === 0);
      setGetModelListSuccess(true);
      setTimeout(() => setGetModelListSuccess(false), 2000);
    } catch {
      setAvailableModels([]);
      setGetModelListError(true);
      setModelListEmpty(true);
      setTimeout(() => setGetModelListError(false), 2000);
    }
  }, []);

  const handleLlmTypeChange = useCallback((type: LLMType) => {
    setLlmTypeState(type);
    if (type === "gemini") {
      setBaseUrl("");
    }
    setAvailableModels([]);
    setModelListEmpty(false);
  }, []);

  const loadConfigToForm = useCallback((config: APIConfig, skipApiCall = false) => {
    handleLlmTypeChange(config.type);
    setBaseUrl(config.type === "gemini" ? "" : config.baseUrl);
    setModel(config.model);
    setApiKey(config.apiKey || "");
    setAvailableModels(config.availableModels || []);
    setModelListEmpty(false);
    setAdvancedSettings(toFormAdvancedSettings(config.advanced));

    if (!skipApiCall) {
      if (config.type === "openai" && config.baseUrl && config.apiKey) {
        void handleGetModelList("openai", config.baseUrl, config.apiKey);
      } else if (config.type === "gemini" && config.apiKey) {
        void handleGetModelList("gemini", "", config.apiKey);
      }
    }
  }, [handleGetModelList, handleLlmTypeChange]);

  const generateConfigName = useCallback((type: LLMType, modelName: string): string => {
    let name = modelName?.trim() || (type === "gemini" ? "Gemini" : type === "ollama" ? "Ollama" : "OpenAI");
    if (name.length > 15) name = name.substring(0, 15);
    const same = configs.filter((config) => config.model === modelName || new RegExp(`【\\d+】${name}`).test(config.name));
    if (same.length === 0) return "new model";
    const max = same.reduce((currentMax, config) => {
      const match = config.name.match(/【(\d+)】/);
      return match ? Math.max(currentMax, parseInt(match[1], 10)) : currentMax;
    }, 0);
    return `${name}(${max + 1})`;
  }, [configs]);

  const setAdvancedNumberSetting = useCallback((key: NumericModelSettingKey, value: string) => {
    setAdvancedSettings((current) => {
      const trimmed = value.trim();
      if (!trimmed) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        return current;
      }
      return {
        ...current,
        [key]: parsed,
      };
    });
  }, []);

  const setAdvancedBooleanSetting = useCallback((key: BooleanModelSettingKey, value: boolean) => {
    setAdvancedSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  const handleCreateConfig = useCallback(() => {
    handleLlmTypeChange("openai");
    setModel("");
    setApiKey("");
    setBaseUrl("");
    setAdvancedSettings(DEFAULT_FORM_ADVANCED_SETTINGS);
    setNewConfigName(generateConfigName("openai", ""));
    setShowNewConfigForm(true);
    setActiveConfigId("");
  }, [generateConfigName, handleLlmTypeChange]);

  const handleCancelCreate = useCallback(() => {
    setShowNewConfigForm(false);
    setNewConfigName("");
    if (configs.length > 0) {
      const config = configs.find((entry) => entry.id === activeConfigId) || configs[0];
      setActiveConfigId(config.id);
      loadConfigToForm(config);
    } else {
      setAdvancedSettings(DEFAULT_FORM_ADVANCED_SETTINGS);
    }
  }, [activeConfigId, configs, loadConfigToForm]);

  const handleSave = useCallback(() => {
    const currentConfig = configs.find((config) => config.id === activeConfigId);
    const draft = buildConfigDraft({
      id: showNewConfigForm ? undefined : activeConfigId,
      name: showNewConfigForm
        ? (newConfigName.trim() || generateConfigName(llmType, model))
        : (currentConfig?.name || generateConfigName(llmType, model)),
      type: llmType,
      baseUrl,
      model,
      apiKey,
      availableModels,
      advancedSettings,
    });

    let nextConfigs: APIConfig[];
    if (showNewConfigForm) {
      nextConfigs = persistConfigs([...configs, draft]);
      setStoreActiveConfig(draft.id);
      setActiveConfigId(draft.id);
      setShowNewConfigForm(false);
      setNewConfigName("");
    } else {
      nextConfigs = persistConfigs(configs.map((config) => config.id === activeConfigId ? draft : config));
    }

    const savedConfig = nextConfigs.find((config) => config.id === draft.id) || draft;
    syncModelConfigToStorage(savedConfig);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }, [
    activeConfigId,
    advancedSettings,
    apiKey,
    availableModels,
    baseUrl,
    configs,
    generateConfigName,
    llmType,
    model,
    newConfigName,
    persistConfigs,
    setStoreActiveConfig,
    showNewConfigForm,
  ]);

  const handleDeleteConfig = useCallback((id: string) => {
    const updated = configs.filter((config) => config.id !== id);
    persistConfigs(updated);

    if (id !== activeConfigId) {
      return;
    }

    if (updated.length > 0) {
      const next = updated[0];
      setActiveConfigId(next.id);
      setStoreActiveConfig(next.id);
      loadConfigToForm(next);
      syncModelConfigToStorage(next);
      return;
    }

    setActiveConfigId("");
    setStoreActiveConfig("");
    setLlmTypeState("openai");
    setBaseUrl("");
    setModel("");
    setApiKey("");
    setAvailableModels([]);
    setAdvancedSettings(DEFAULT_FORM_ADVANCED_SETTINGS);
  }, [activeConfigId, configs, loadConfigToForm, persistConfigs, setStoreActiveConfig]);

  const handleSwitchConfig = useCallback((id: string) => {
    if (id === activeConfigId) return;
    const config = configs.find((entry) => entry.id === id);
    if (!config) return;

    setActiveConfigId(id);
    setStoreActiveConfig(id);
    setShowNewConfigForm(false);
    loadConfigToForm(config);
    syncModelConfigToStorage(config);
  }, [activeConfigId, configs, loadConfigToForm, setStoreActiveConfig]);

  const handleStartEditName = useCallback((config: APIConfig, event: MouseEvent) => {
    event.stopPropagation();
    setEditingConfigId(config.id);
    setEditingName(config.name);
  }, []);

  const handleSaveName = useCallback(() => {
    if (!editingName.trim()) return;
    const updated = configs.map((config) => config.id === editingConfigId ? { ...config, name: editingName.trim() } : config);
    persistConfigs(updated);
    setEditingConfigId("");
  }, [configs, editingConfigId, editingName, persistConfigs]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Enter") handleSaveName();
    if (event.key === "Escape") setEditingConfigId("");
  }, [handleSaveName]);

  const handleInlineModelChange = useCallback((newModel: string) => {
    setModel(newModel);
    if (!activeConfigId) return;

    const updatedConfigs = configs.map((config) => config.id === activeConfigId ? { ...config, model: newModel } : config);
    persistConfigs(updatedConfigs);
    const activeConfig = updatedConfigs.find((config) => config.id === activeConfigId);
    if (activeConfig) {
      syncModelConfigToStorage(activeConfig);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }, [activeConfigId, configs, persistConfigs]);

  const handleTestModel = useCallback(async () => {
    if (!model) return;

    setIsTesting(true);
    setTestModelSuccess(false);
    setTestModelError(false);
    try {
      await testModelConnection({
        llmType,
        baseUrl,
        model,
        apiKey,
        advancedSettings,
      });
      setTestModelSuccess(true);
      setTimeout(() => setTestModelSuccess(false), 2000);
    } catch (error) {
      console.error("Model test failed:", error);
      setTestModelError(true);
      setTimeout(() => setTestModelError(false), 2000);
    } finally {
      setIsTesting(false);
    }
  }, [advancedSettings, apiKey, baseUrl, llmType, model]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let merged = storeConfigs;
    if (merged.length === 0 && (DEFAULT_API_URL || DEFAULT_API_KEY)) {
      const defaultConfig = buildConfigDraft({
        name: `【1】${DEFAULT_API_URL ? "API" : "OpenAI"}`,
        type: "openai",
        baseUrl: DEFAULT_API_URL,
        model: "",
        apiKey: DEFAULT_API_KEY,
        availableModels: [],
        advancedSettings: DEFAULT_FORM_ADVANCED_SETTINGS,
      });
      merged = [defaultConfig];
      persistConfigs(merged);
      setStoreActiveConfig(defaultConfig.id);
    }

    const activeId = storeActiveConfigId && merged.some((config) => config.id === storeActiveConfigId)
      ? storeActiveConfigId
      : (merged[0]?.id || "");

    setConfigs(merged);
    setActiveConfigId(activeId);

    if (merged.length > 0) {
      const config = merged.find((entry) => entry.id === activeId);
      if (config) {
        loadConfigToForm(config, true);
        syncModelConfigToStorage(config);
      }
    } else {
      setAdvancedSettings(DEFAULT_FORM_ADVANCED_SETTINGS);
    }
  }, [loadConfigToForm, persistConfigs, setStoreActiveConfig, storeActiveConfigId, storeConfigs]);

  const state: SidebarState = {
    configs, activeConfigId, showNewConfigForm, showEditHint, isConfigHovered, editingConfigId, editingName,
    newConfigName, llmType, baseUrl, model, apiKey, availableModels, modelListEmpty, advancedSettings,
    saveSuccess, getModelListSuccess, getModelListError, isTesting, testModelSuccess, testModelError,
  };

  const actions: Omit<SidebarActions, "toggleSidebar"> = {
    handleCreateConfig, handleSwitchConfig, handleStartEditName, setEditingName, handleSaveName,
    handleKeyDown, handleDeleteConfig, setIsConfigHovered, handleGetModelList, handleSave,
    handleCancelCreate, setLlmType: handleLlmTypeChange, setBaseUrl, setApiKey, setNewConfigName,
    setModel, handleInlineModelChange, handleTestModel, setAdvancedNumberSetting, setAdvancedBooleanSetting,
  };

  return { state, actions };
}
