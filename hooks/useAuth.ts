/**
 * @input  hooks/useLocalStorage
 * @output useAuth
 * @pos    本地游客身份状态管理 - 登录态/登出/用户名更新
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                              useAuth Hook                                  ║
 * ║  本地优先身份管理：只承载 guest 身份，不再隐式调用远端账号 API。               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback, useState, useEffect } from "react";
import { useLocalStorageBoolean, useLocalStorageString } from "@/hooks/useLocalStorage";

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const { remove: removeStoredToken } =
    useLocalStorageString("authToken", "");
  const { value: storedUsername, setValue: setStoredUsername, remove: removeStoredUsername } =
    useLocalStorageString("username", "");
  const { value: storedUserId, setValue: setStoredUserId, remove: removeStoredUserId } =
    useLocalStorageString("userId", "");
  const { value: storedEmail, remove: removeStoredEmail } =
    useLocalStorageString("email", "");
  const { value: storedLoginMode, setValue: setStoredLoginMode, remove: removeStoredLoginMode } =
    useLocalStorageString("loginMode", "");
  const { value: isLoggedIn, setValue: setIsLoggedIn, remove: removeIsLoggedIn } =
    useLocalStorageBoolean("isLoggedIn", false);

  const readGuestAuthState = useCallback((): AuthState => {
    if (isLoggedIn && storedLoginMode === "guest" && storedUsername && storedUserId) {
      return {
        user: {
          id: storedUserId,
          username: storedUsername,
          email: storedEmail || "",
        },
        isLoading: false,
        isAuthenticated: true,
      };
    }

    return {
      user: null,
      isLoading: false,
      isAuthenticated: false,
    };
  }, [isLoggedIn, storedEmail, storedLoginMode, storedUserId, storedUsername]);

  useEffect(() => {
    setAuthState(readGuestAuthState());
  }, [readGuestAuthState]);

  const logout = () => {
    // 同时清理历史 authToken，避免旧远端账号残留继续影响本地身份判断。
    removeStoredToken();
    removeStoredUsername();
    removeStoredUserId();
    removeStoredEmail();
    removeIsLoggedIn();
    removeStoredLoginMode();

    setAuthState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });

    // Refresh the page to ensure all components are properly updated
    window.location.reload();
  };

  const refreshAuth = () => {
    setAuthState(readGuestAuthState());
  };

  const updateUsername = async (newUsername: string) => {
    const trimmed = newUsername.trim();
    if (!trimmed) {
      return { success: false, message: "Username is required" };
    }

    const nextUserId = storedUserId || `guest_${Date.now()}`;

    setStoredUsername(trimmed);
    if (!storedUserId) {
      setStoredUserId(nextUserId);
    }
    setStoredLoginMode("guest");
    setIsLoggedIn(true);
    setAuthState(prev => ({
      ...prev,
      user: prev.user
        ? { ...prev.user, username: trimmed }
        : { id: nextUserId, username: trimmed, email: storedEmail || "" },
      isAuthenticated: true,
      isLoading: false,
    }));

    setTimeout(() => {
      window.location.reload();
    }, 1500);

    return { success: true };
  };

  return {
    ...authState,
    logout,
    refreshAuth,
    updateUsername,
  };
};
