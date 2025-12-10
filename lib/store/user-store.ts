/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                           User State Store                                ║
 * ║                                                                           ║
 * ║  用户状态的全局管理 - 用户名、认证状态等                                       ║
 * ║  替代 window 事件：displayUsernameChanged                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface UserState {
  // ========== 状态 ==========
  displayUsername: string;
  
  // ========== 操作 ==========
  setDisplayUsername: (username: string) => void;
  clearDisplayUsername: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Store 实现
   ═══════════════════════════════════════════════════════════════════════════ */

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      // ========== 初始状态 ==========
      displayUsername: "",

      // ========== 操作 ==========
      setDisplayUsername: (username) => set({ displayUsername: username }),
      clearDisplayUsername: () => set({ displayUsername: "" }),
    }),
    {
      name: "user-storage",
    },
  ),
);
