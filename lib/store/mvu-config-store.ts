/**
 * @input  zustand
 * @output useMvuConfigStore, resetMvuConfigStore
 * @pos    MVU 配置状态管理 - 显式保存当前产品使用的 MVU 策略
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { MvuStrategyId } from "@/lib/mvu/debugger/strategy-matrix";

interface MvuConfigState {
  strategy: MvuStrategyId;
  setStrategy: (strategy: MvuStrategyId) => void;
}

const emptyStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const DEFAULT_STATE: Pick<MvuConfigState, "strategy"> = {
  strategy: "text-delta",
};

export const useMvuConfigStore = create<MvuConfigState>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,
      setStrategy: (strategy) => set({ strategy }),
    }),
    {
      name: "dreamministage-mvu-config",
      storage: createJSONStorage(() => typeof window !== "undefined" ? window.localStorage : emptyStorage),
      partialize: (state) => ({ strategy: state.strategy }),
    },
  ),
);

export function resetMvuConfigStore(): void {
  useMvuConfigStore.setState(DEFAULT_STATE);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("dreamministage-mvu-config");
  }
}
