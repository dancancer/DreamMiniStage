/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        Username Helper                                   ║
 * ║  显示名的存储与事件通知：读写封装                                            ║
 * ║  【重构】使用 Zustand Store 替代 localStorage + window 事件                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { getString } from "@/lib/storage/client-storage";
import { useUserStore } from "@/lib/store/user-store";

/**
 * Get the current display username for character dialogues
 * Returns displayUsername if set, otherwise falls back to login username
 */
export function getDisplayUsername(): string {
  if (typeof window === "undefined") return "";
  
  const displayUsername = useUserStore.getState().displayUsername;
  const loginUsername = getString("username");

  return displayUsername || loginUsername || "";
}

/**
 * Set the display username for character dialogues
 * 自动通知所有订阅者（无需 window 事件）
 */
export function setDisplayUsername(username: string): void {
  if (typeof window === "undefined") return;
  useUserStore.getState().setDisplayUsername(username);
}

/**
 * Reset display username to login username
 */
export function resetDisplayUsername(): void {
  const loginUsername = getString("username");
  setDisplayUsername(loginUsername);
}
