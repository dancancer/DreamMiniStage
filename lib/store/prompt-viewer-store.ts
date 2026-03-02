/**
 * @input  zustand, types/prompt-viewer, lib/prompt-viewer/constants
 * @output usePromptViewerStore, usePromptData, useViewerUIState, useInterceptionState
 * @pos    提示词查看器状态管理,支持拦截、搜索、UI 控制等功能
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词查看器状态管理                                   ║
 * ║                                                                           ║
 * ║  使用 Zustand 管理提示词查看器的全局状态                                   ║
 * ║  设计原则：单一数据源、类型安全、可预测的状态变更                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type {
  PromptData,
  ViewerUIState,
  PromptViewerActions,
  PromptViewerState,
} from "@/types/prompt-viewer";
import {
  createDefaultUIState,
  DEFAULT_PROMPT_VIEWER_STATE,
} from "@/lib/prompt-viewer/constants";

/* ═══════════════════════════════════════════════════════════════════════════
   完整状态接口
   ═══════════════════════════════════════════════════════════════════════════ */

interface PromptViewerStoreState extends PromptViewerState, PromptViewerActions {}

/* ═══════════════════════════════════════════════════════════════════════════
   Store 实现
   ═══════════════════════════════════════════════════════════════════════════ */

export const usePromptViewerStore = create<PromptViewerStoreState>((set, get) => ({
  // ========== 初始状态 ==========
  ...DEFAULT_PROMPT_VIEWER_STATE,

  // ========== 弹窗控制 ==========

  openModal: (dialogueKey: string) => {
    if (!dialogueKey) return;

    set((state) => ({
      uiStates: {
        ...state.uiStates,
        [dialogueKey]: {
          ...(state.uiStates[dialogueKey] || createDefaultUIState()),
          isOpen: true,
          error: null,
        },
      },
    }));
  },

  closeModal: (dialogueKey: string) => {
    if (!dialogueKey) return;

    set((state) => ({
      uiStates: {
        ...state.uiStates,
        [dialogueKey]: {
          ...(state.uiStates[dialogueKey] || createDefaultUIState()),
          isOpen: false,
        },
      },
    }));
  },

  // ========== 提示词管理 ==========

  updatePrompt: (dialogueKey: string, prompt: PromptData) => {
    if (!dialogueKey || !prompt) return;

    set((state) => ({
      prompts: {
        ...state.prompts,
        [dialogueKey]: prompt,
      },
      uiStates: {
        ...state.uiStates,
        [dialogueKey]: {
          ...(state.uiStates[dialogueKey] || createDefaultUIState()),
          isLoading: false,
          error: null,
        },
      },
    }));
  },

  refreshPrompt: async (dialogueKey: string, characterId: string) => {
    if (!dialogueKey || !characterId) return;

    const { setLoading, setError, updatePrompt } = get();

    try {
      setLoading(dialogueKey, true);

      console.log(`[PromptViewerStore:refreshPrompt] 开始刷新: dialogueKey=${dialogueKey}, characterId=${characterId}`);
      
      // 动态导入拦截器，避免循环依赖
      const { promptInterceptor } = await import("@/lib/prompt-viewer/prompt-interceptor");
      
      // 使用拦截器获取提示词数据
      console.log("[PromptViewerStore:refreshPrompt] 调用 triggerInterception...");
      const promptData = await promptInterceptor.triggerInterception(dialogueKey, characterId);
      
      console.log("[PromptViewerStore:refreshPrompt] 获取到提示词数据:", {
        id: promptData.id,
        systemMessageLength: promptData.systemMessage.length,
        userMessageLength: promptData.userMessage.length,
        fullPromptLength: promptData.fullPrompt.length,
      });
      
      // 更新状态
      updatePrompt(dialogueKey, promptData);
      
      console.log(`[PromptViewerStore:refreshPrompt] 提示词刷新成功: ${promptData.id}`);
    } catch (error) {
      console.error("[PromptViewerStore:refreshPrompt] 刷新提示词失败:", error);
      setError(dialogueKey, error instanceof Error ? error.message : "刷新失败");
    } finally {
      setLoading(dialogueKey, false);
    }
  },

  // ========== 搜索控制 ==========

  setSearchInput: (dialogueKey: string, input: string) => {
    if (!dialogueKey) return;

    set((state) => ({
      uiStates: {
        ...state.uiStates,
        [dialogueKey]: {
          ...(state.uiStates[dialogueKey] || createDefaultUIState()),
          searchInput: input,
        },
      },
    }));
  },

  toggleMatchedOnly: (dialogueKey: string) => {
    if (!dialogueKey) return;

    set((state) => {
      const currentState = state.uiStates[dialogueKey] || createDefaultUIState();
      return {
        uiStates: {
          ...state.uiStates,
          [dialogueKey]: {
            ...currentState,
            matchedOnly: !currentState.matchedOnly,
          },
        },
      };
    });
  },

  // ========== UI 状态控制 ==========

  toggleRegionExpansion: (dialogueKey: string, regionId: string) => {
    if (!dialogueKey || !regionId) return;

    set((state) => {
      const currentState = state.uiStates[dialogueKey] || createDefaultUIState();
      const expandedRegions = new Set(currentState.expandedRegions);

      if (expandedRegions.has(regionId)) {
        expandedRegions.delete(regionId);
      } else {
        expandedRegions.add(regionId);
      }

      return {
        uiStates: {
          ...state.uiStates,
          [dialogueKey]: {
            ...currentState,
            expandedRegions,
          },
        },
      };
    });
  },

  toggleImageGallery: (dialogueKey: string) => {
    if (!dialogueKey) return;

    set((state) => {
      const currentState = state.uiStates[dialogueKey] || createDefaultUIState();
      return {
        uiStates: {
          ...state.uiStates,
          [dialogueKey]: {
            ...currentState,
            imageGalleryExpanded: !currentState.imageGalleryExpanded,
          },
        },
      };
    });
  },

  setLoading: (dialogueKey: string, loading: boolean) => {
    if (!dialogueKey) return;

    set((state) => ({
      uiStates: {
        ...state.uiStates,
        [dialogueKey]: {
          ...(state.uiStates[dialogueKey] || createDefaultUIState()),
          isLoading: loading,
        },
      },
    }));
  },

  setError: (dialogueKey: string, error: string | null) => {
    if (!dialogueKey) return;

    set((state) => ({
      uiStates: {
        ...state.uiStates,
        [dialogueKey]: {
          ...(state.uiStates[dialogueKey] || createDefaultUIState()),
          error,
          isLoading: false,
        },
      },
    }));
  },

  // ========== 拦截控制 ==========

  startInterception: async (dialogueKey: string) => {
    if (!dialogueKey) return;

    try {
      // 动态导入拦截器，避免循环依赖
      const { promptInterceptor } = await import("@/lib/prompt-viewer/prompt-interceptor");
      
      // 启动拦截器
      promptInterceptor.startInterception(dialogueKey);

      // 注册回调：当捕获到提示词时自动更新 store
      const { updatePrompt } = get();
      promptInterceptor.addInterceptionCallback(dialogueKey, (promptData) => {
        updatePrompt(dialogueKey, promptData);
      });

      set((state) => ({
        intercepting: {
          ...state.intercepting,
          [dialogueKey]: true,
        },
      }));

      console.log(`[PromptViewer] 开始拦截: ${dialogueKey}`);
    } catch (error) {
      console.error("[PromptViewer] 启动拦截失败:", error);
    }
  },

  stopInterception: async (dialogueKey: string) => {
    if (!dialogueKey) return;

    try {
      // 动态导入拦截器，避免循环依赖
      const { promptInterceptor } = await import("@/lib/prompt-viewer/prompt-interceptor");
      
      // 停止拦截器
      promptInterceptor.stopInterception(dialogueKey);

      set((state) => ({
        intercepting: {
          ...state.intercepting,
          [dialogueKey]: false,
        },
      }));

      console.log(`[PromptViewer] 停止拦截: ${dialogueKey}`);
    } catch (error) {
      console.error("[PromptViewer] 停止拦截失败:", error);
    }
  },

  // ========== 查询方法 ==========

  getPrompt: (dialogueKey: string): PromptData | null => {
    if (!dialogueKey) return null;
    return get().prompts[dialogueKey] || null;
  },

  getUIState: (dialogueKey: string): ViewerUIState => {
    if (!dialogueKey) return createDefaultUIState();
    return get().uiStates[dialogueKey] || createDefaultUIState();
  },

  isIntercepting: (dialogueKey: string): boolean => {
    if (!dialogueKey) return false;
    return get().intercepting[dialogueKey] || false;
  },

  // ========== 资源清理 ==========

  cleanup: (dialogueKey?: string) => {
    if (dialogueKey) {
      // 清理指定对话的资源
      set((state) => {
        const newPrompts = { ...state.prompts };
        const newUIStates = { ...state.uiStates };
        const newIntercepting = { ...state.intercepting };

        delete newPrompts[dialogueKey];
        delete newUIStates[dialogueKey];
        delete newIntercepting[dialogueKey];

        return {
          prompts: newPrompts,
          uiStates: newUIStates,
          intercepting: newIntercepting,
        };
      });

      console.log(`[PromptViewerStore] 清理对话资源: ${dialogueKey}`);
    } else {
      // 清理所有资源
      set(() => ({
        ...DEFAULT_PROMPT_VIEWER_STATE,
      }));

      console.log("[PromptViewerStore] 清理所有资源");
    }
  },

  cleanupExpired: () => {
    const now = Date.now();
    const EXPIRY_TIME = 30 * 60 * 1000; // 30分钟
    const state = get();
    
    const expiredKeys: string[] = [];
    
    // 查找过期的提示词数据
    for (const [dialogueKey, prompt] of Object.entries(state.prompts)) {
      if (prompt && now - prompt.timestamp > EXPIRY_TIME) {
        expiredKeys.push(dialogueKey);
      }
    }

    // 清理过期数据
    if (expiredKeys.length > 0) {
      set((state) => {
        const newPrompts = { ...state.prompts };
        const newUIStates = { ...state.uiStates };
        const newIntercepting = { ...state.intercepting };

        for (const key of expiredKeys) {
          delete newPrompts[key];
          delete newUIStates[key];
          delete newIntercepting[key];
        }

        return {
          prompts: newPrompts,
          uiStates: newUIStates,
          intercepting: newIntercepting,
        };
      });

      console.log(`[PromptViewerStore] 清理过期数据: ${expiredKeys.length} 个对话`);
    }
  },

  destroy: async () => {
    const state = get();
    
    // 停止所有拦截
    const dialogueKeys = Object.keys(state.intercepting);
    for (const dialogueKey of dialogueKeys) {
      if (state.intercepting[dialogueKey]) {
        try {
          const { promptInterceptor } = await import("@/lib/prompt-viewer/prompt-interceptor");
          promptInterceptor.stopInterception(dialogueKey);
        } catch (error) {
          console.error(`[PromptViewerStore] 停止拦截失败: ${dialogueKey}`, error);
        }
      }
    }

    // 清理所有状态
    get().cleanup();

    console.log("[PromptViewerStore] Store 销毁完成");
  },
}));

/* ═══════════════════════════════════════════════════════════════════════════
   选择器 Hooks
   ═══════════════════════════════════════════════════════════════════════════ */

// 稳定的默认值，避免每次创建新对象
const DEFAULT_UI_STATE = createDefaultUIState();

/**
 * 获取指定对话的提示词数据
 */
export function usePromptData(dialogueKey: string): PromptData | null {
  return usePromptViewerStore((state) => state.prompts[dialogueKey] ?? null);
}

/**
 * 获取指定对话的 UI 状态
 * 
 * 使用 useShallow 优化，避免不必要的重渲染
 */
export function useViewerUIState(dialogueKey: string): ViewerUIState {
  return usePromptViewerStore(
    useShallow((state) => state.uiStates[dialogueKey] ?? DEFAULT_UI_STATE),
  );
}

/**
 * 获取指定对话的拦截状态
 */
export function useInterceptionState(dialogueKey: string): boolean {
  return usePromptViewerStore((state) => state.isIntercepting(dialogueKey));
}

/**
 * 获取弹窗控制操作
 * 
 * 使用 useShallow 优化，避免不必要的重渲染
 */
export function useModalActions() {
  return usePromptViewerStore(
    useShallow((state) => ({
      openModal: state.openModal,
      closeModal: state.closeModal,
    })),
  );
}

/**
 * 获取搜索控制操作
 */
export function useSearchActions() {
  return usePromptViewerStore(
    useShallow((state) => ({
      setSearchInput: state.setSearchInput,
      toggleMatchedOnly: state.toggleMatchedOnly,
    })),
  );
}

/**
 * 获取 UI 控制操作
 */
export function useUIActions() {
  return usePromptViewerStore(
    useShallow((state) => ({
      toggleRegionExpansion: state.toggleRegionExpansion,
      toggleImageGallery: state.toggleImageGallery,
      setLoading: state.setLoading,
      setError: state.setError,
    })),
  );
}

/**
 * 获取拦截控制操作
 */
export function useInterceptionActions() {
  return usePromptViewerStore(
    useShallow((state) => ({
      startInterception: state.startInterception,
      stopInterception: state.stopInterception,
      refreshPrompt: state.refreshPrompt,
    })),
  );
}

/**
 * 获取资源清理操作
 */
export function useCleanupActions() {
  return usePromptViewerStore(
    useShallow((state) => ({
      cleanup: state.cleanup,
      cleanupExpired: state.cleanupExpired,
      destroy: state.destroy,
    })),
  );
}
