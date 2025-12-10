/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                            UI State Store                                 ║
 * ║                                                                           ║
 * ║  UI 状态的全局管理 - 侧边栏、模态框、视图切换                                  ║
 * ║  替代 window 事件：closeCharacterSidebar, switchToPresetView 等             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { create } from "zustand";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export type CharacterView = "chat" | "worldbook" | "preset" | "regex";

interface PresetViewPayload {
  characterId?: string;
  presetId?: string;
  presetName?: string;
}

interface UIState {
  // ========== 侧边栏状态 ==========
  characterSidebarOpen: boolean;
  modelSidebarOpen: boolean;
  
  // ========== 视图状态 ==========
  characterView: CharacterView;
  presetViewPayload: PresetViewPayload | null;
  
  // ========== 操作 ==========
  setCharacterSidebarOpen: (open: boolean) => void;
  setModelSidebarOpen: (open: boolean) => void;
  toggleCharacterSidebar: () => void;
  toggleModelSidebar: () => void;
  
  setCharacterView: (view: CharacterView, payload?: PresetViewPayload) => void;
  resetPresetViewPayload: () => void;
  
  // ========== 便捷方法 ==========
  closeAllSidebars: () => void;
  switchToPresetView: (payload: PresetViewPayload) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Store 实现
   ═══════════════════════════════════════════════════════════════════════════ */

export const useUIStore = create<UIState>((set) => ({
  // ========== 初始状态 ==========
  characterSidebarOpen: true,
  modelSidebarOpen: false,
  characterView: "chat",
  presetViewPayload: null,

  // ========== 侧边栏操作 ==========
  setCharacterSidebarOpen: (open) => set({ characterSidebarOpen: open }),
  setModelSidebarOpen: (open) => set({ modelSidebarOpen: open }),
  
  toggleCharacterSidebar: () =>
    set((state) => ({ characterSidebarOpen: !state.characterSidebarOpen })),
  
  toggleModelSidebar: () =>
    set((state) => ({ modelSidebarOpen: !state.modelSidebarOpen })),

  // ========== 视图操作 ==========
  setCharacterView: (view, payload) =>
    set({
      characterView: view,
      presetViewPayload: payload || null,
    }),

  resetPresetViewPayload: () => set({ presetViewPayload: null }),

  // ========== 便捷方法 ==========
  closeAllSidebars: () =>
    set({
      characterSidebarOpen: false,
      modelSidebarOpen: false,
    }),

  switchToPresetView: (payload) =>
    set({
      characterView: "preset",
      presetViewPayload: payload,
    }),
}));
