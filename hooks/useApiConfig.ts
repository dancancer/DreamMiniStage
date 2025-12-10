/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         useApiConfig Hook                                  ║
 * ║                                                                            ║
 * ║  管理 API 配置状态：加载、切换、模型获取                                    ║
 * ║  【重构】使用 Zustand Store 替代 localStorage + window 事件                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { trackButtonClick } from "@/utils/google-analytics";
import { setString } from "@/lib/storage/client-storage";
import { useModelStore, type APIConfig } from "@/lib/store/model-store";

// ============================================================================
//                              类型定义
// ============================================================================

export type { APIConfig } from "@/lib/store/model-store";
export type { LLMType } from "@/lib/store/model-store";

interface UseApiConfigReturn {
  configs: APIConfig[];
  activeConfigId: string;
  currentModel: string;
  getCurrentConfig: () => APIConfig | undefined;
  handleConfigSelect: (configId: string) => Promise<void>;
  handleModelSwitch: (configId: string, modelName?: string) => void;
  showApiDropdown: boolean;
  setShowApiDropdown: (show: boolean) => void;
  showModelDropdown: boolean;
  setShowModelDropdown: (show: boolean) => void;
  selectedConfigId: string;
  setSelectedConfigId: (id: string) => void;
}

// ============================================================================
//                              工具函数
// ============================================================================

async function fetchAvailableModels(config: APIConfig): Promise<string[]> {
  // Ollama 直接返回配置的模型
  if (config.type === "ollama") {
    return [config.model || "default"];
  }

  if (!config.baseUrl || !config.apiKey) {
    return ["default"];
  }

  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    const data = await response.json();
    const modelList = data.data?.map((item: { id: string }) => item.id) || [];
    return modelList.length > 0 ? modelList : ["default"];
  } catch {
    return ["default"];
  }
}

// ============================================================================
//                              主 Hook
// ============================================================================

export function useApiConfig(): UseApiConfigReturn {
  // ========== Zustand Store ==========
  const configs = useModelStore((state) => state.configs);
  const activeConfigId = useModelStore((state) => state.activeConfigId);
  const updateConfig = useModelStore((state) => state.updateConfig);
  const setActiveConfig = useModelStore((state) => state.setActiveConfig);
  
  // ========== 本地 UI 状态 ==========
  const [currentModel, setCurrentModel] = useState("");
  const [showApiDropdown, setShowApiDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState("");

  const getCurrentConfig = useCallback(
    () => configs.find((c) => c.id === activeConfigId),
    [configs, activeConfigId]
  );

  // 选择配置（第一层下拉）
  const handleConfigSelect = useCallback(async (configId: string) => {
    const selectedConfig = configs.find((c) => c.id === configId);
    if (!selectedConfig) return;

    // 懒加载可用模型
    if (!selectedConfig.availableModels) {
      const models = await fetchAvailableModels(selectedConfig);
      updateConfig(configId, { availableModels: models });
    }

    const configForUse = configs.find((c) => c.id === configId) || selectedConfig;

    // 单模型直接切换，多模型显示第二层下拉
    if (configForUse.availableModels?.length === 1) {
      handleModelSwitch(configId, configForUse.availableModels[0]);
      setShowApiDropdown(false);
      setShowModelDropdown(false);
    } else {
      setSelectedConfigId(configId);
      setShowModelDropdown(true);
      setShowApiDropdown(false);
    }
  }, [configs, updateConfig]);

  // 切换模型
  const handleModelSwitch = useCallback((configId: string, modelName?: string) => {
    const selectedConfig = configs.find((c) => c.id === configId);
    if (!selectedConfig) return;

    // 更新模型配置
    if (modelName && modelName !== selectedConfig.model) {
      const actualModelName = modelName === "default" ? (selectedConfig.model || "default") : modelName;
      updateConfig(configId, { model: actualModelName });
    }

    setActiveConfig(configId);
    const configAfterUpdate = configs.find((c) => c.id === configId) || selectedConfig;
    setCurrentModel(configAfterUpdate.model);

    // 同步到各存储键
    syncConfigToStorage(configAfterUpdate);

    setShowApiDropdown(false);
    setShowModelDropdown(false);
    trackButtonClick("CharacterChat", "切换模型");
  }, [configs, updateConfig, setActiveConfig]);

  // ═══════════════════════════════════════════════════════════════
  // 初始化：从 Store 同步当前模型
  // 
  // 【优化】只依赖 activeConfigId，避免 configs 数组变化时不必要的触发
  // - 使用 getCurrentConfig() 获取最新配置，而不是依赖 configs
  // - 只在 activeConfigId 变化时同步模型
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const activeConfig = getCurrentConfig();
    if (activeConfig) {
      setCurrentModel(activeConfig.model);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConfigId]);

  // 点击外部关闭下拉
  useEffect(() => {
    if (!showApiDropdown && !showModelDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".api-dropdown-container")) {
        setShowApiDropdown(false);
        setShowModelDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showApiDropdown, showModelDropdown]);

  return {
    configs,
    activeConfigId,
    currentModel,
    getCurrentConfig,
    handleConfigSelect,
    handleModelSwitch,
    showApiDropdown,
    setShowApiDropdown,
    showModelDropdown,
    setShowModelDropdown,
    selectedConfigId,
    setSelectedConfigId,
  };
}

// ============================================================================
//                              辅助函数
// ============================================================================

function syncConfigToStorage(config: APIConfig): void {
  setString("llmType", config.type);
  setString(config.type === "openai" ? "openaiBaseUrl" : "ollamaBaseUrl", config.baseUrl);
  setString(config.type === "openai" ? "openaiModel" : "ollamaModel", config.model);
  setString("modelName", config.model);
  setString("modelBaseUrl", config.baseUrl);

  if (config.type === "openai" && config.apiKey) {
    setString("openaiApiKey", config.apiKey);
    setString("apiKey", config.apiKey);
  }
}
