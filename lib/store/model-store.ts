/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                         Model Configuration Store                         ║
 * ║                                                                           ║
 * ║  模型配置的全局状态管理 - 使用 Zustand 替代 window 事件                       ║
 * ║  设计原则：单一数据源、类型安全、可预测的状态变更                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export type LLMType = "openai" | "ollama" | "gemini";

export interface APIConfig {
  id: string;
  name: string;
  type: LLMType;
  baseUrl: string;
  model: string;
  apiKey?: string;
  availableModels?: string[];
}

interface ModelState {
  // ========== 状态 ==========
  configs: APIConfig[];
  activeConfigId: string;
  
  // ========== 操作 ==========
  setConfigs: (configs: APIConfig[]) => void;
  addConfig: (config: APIConfig) => void;
  updateConfig: (id: string, updates: Partial<APIConfig>) => void;
  deleteConfig: (id: string) => void;
  setActiveConfig: (id: string) => void;
  
  // ========== 查询 ==========
  getActiveConfig: () => APIConfig | undefined;
  getConfigById: (id: string) => APIConfig | undefined;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Store 实现
   ═══════════════════════════════════════════════════════════════════════════ */

export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => ({
      // ========== 初始状态 ==========
      configs: [],
      activeConfigId: "",

      // ========== 操作 ==========
      setConfigs: (configs) => set({ configs }),

      addConfig: (config) =>
        set((state) => ({
          configs: [...state.configs, config],
        })),

      updateConfig: (id, updates) =>
        set((state) => ({
          configs: state.configs.map((c) =>
            c.id === id ? { ...c, ...updates } : c,
          ),
        })),

      deleteConfig: (id) =>
        set((state) => {
          const newConfigs = state.configs.filter((c) => c.id !== id);
          const newActiveId =
            state.activeConfigId === id
              ? newConfigs[0]?.id || ""
              : state.activeConfigId;
          return {
            configs: newConfigs,
            activeConfigId: newActiveId,
          };
        }),

      setActiveConfig: (id) => set({ activeConfigId: id }),

      // ========== 查询 ==========
      getActiveConfig: () => {
        const state = get();
        return state.configs.find((c) => c.id === state.activeConfigId);
      },

      getConfigById: (id) => {
        const state = get();
        return state.configs.find((c) => c.id === id);
      },
    }),
    {
      name: "model-config-storage",
      partialize: (state) => ({
        configs: state.configs,
        activeConfigId: state.activeConfigId,
      }),
    },
  ),
);
