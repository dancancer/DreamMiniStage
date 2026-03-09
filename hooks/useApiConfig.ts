/**
 * @input  lib/store/model-store, utils/google-analytics, lib/storage/client-storage
 * @output useApiConfig, APIConfig, LLMType
 * @pos    API 配置管理 - 模型配置加载、切换与同步
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
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
import { syncModelConfigToStorage } from "@/lib/model-runtime";
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
  setActiveConfigStreaming: (streaming: boolean) => void;
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

  // 切换模型
  const handleModelSwitch = useCallback((configId: string, modelName?: string) => {
    const selectedConfig = configs.find((c) => c.id === configId);
    if (!selectedConfig) return;

    const actualModelName = modelName === "default" ? (selectedConfig.model || "default") : modelName;
    const nextConfig = actualModelName && actualModelName !== selectedConfig.model
      ? { ...selectedConfig, model: actualModelName }
      : selectedConfig;

    if (nextConfig.model !== selectedConfig.model) {
      updateConfig(configId, { model: nextConfig.model });
    }

    setActiveConfig(configId);
    const configAfterUpdate = useModelStore.getState().getConfigById(configId) || nextConfig;
    setCurrentModel(configAfterUpdate.model);
    syncModelConfigToStorage(configAfterUpdate);

    setShowApiDropdown(false);
    setShowModelDropdown(false);
    trackButtonClick("CharacterChat", "切换模型");
  }, [configs, updateConfig, setActiveConfig]);

  // 选择配置（第一层下拉）
  const handleConfigSelect = useCallback(async (configId: string) => {
    const selectedConfig = configs.find((c) => c.id === configId);
    if (!selectedConfig) return;

    if (!selectedConfig.availableModels) {
      const models = await fetchAvailableModels(selectedConfig);
      updateConfig(configId, { availableModels: models });
    }

    const freshConfigs = useModelStore.getState().configs;
    const configForUse = freshConfigs.find((c) => c.id === configId) || selectedConfig;

    if (configForUse.availableModels?.length === 1) {
      handleModelSwitch(configId, configForUse.availableModels[0]);
      setShowApiDropdown(false);
      setShowModelDropdown(false);
      return;
    }

    setSelectedConfigId(configId);
    setShowModelDropdown(true);
    setShowApiDropdown(false);
  }, [configs, handleModelSwitch, updateConfig]);

  const setActiveConfigStreaming = useCallback((streaming: boolean) => {
    const activeConfig = configs.find((c) => c.id === activeConfigId);
    if (!activeConfig) return;
    if (activeConfig.advanced?.streaming === streaming) return;

    const nextAdvanced = {
      ...activeConfig.advanced,
      streaming,
    };
    const nextConfig = {
      ...activeConfig,
      advanced: nextAdvanced,
    };

    updateConfig(activeConfigId, { advanced: nextAdvanced });
    syncModelConfigToStorage(nextConfig);
  }, [activeConfigId, configs, updateConfig]);

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
    setActiveConfigStreaming,
    showApiDropdown,
    setShowApiDropdown,
    showModelDropdown,
    setShowModelDropdown,
    selectedConfigId,
    setSelectedConfigId,
  };
}

