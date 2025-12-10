/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                              useAuth Hook                                  ║
 * ║  认证状态管理：登录/登出/游客模式/用户名更新                                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useEffect } from "react";
import { useLocalStorageBoolean, useLocalStorageString } from "@/hooks/useLocalStorage";
import AuthAPI from "@/lib/api/auth";

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

  const { value: storedToken, setValue: setStoredToken, remove: removeStoredToken } =
    useLocalStorageString("authToken", "");
  const { value: storedUsername, setValue: setStoredUsername, remove: removeStoredUsername } =
    useLocalStorageString("username", "");
  const { value: storedUserId, setValue: setStoredUserId, remove: removeStoredUserId } =
    useLocalStorageString("userId", "");
  const { value: storedEmail, setValue: setStoredEmail, remove: removeStoredEmail } =
    useLocalStorageString("email", "");
  const { value: storedLoginMode, setValue: setStoredLoginMode, remove: removeStoredLoginMode } =
    useLocalStorageString("loginMode", "");
  const { value: isLoggedIn, setValue: setIsLoggedIn, remove: removeIsLoggedIn } =
    useLocalStorageBoolean("isLoggedIn", false);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check for guest login first
      if (isLoggedIn && storedLoginMode === "guest" && storedUsername && storedUserId) {
        // Guest login mode
        setAuthState({
          user: {
            id: storedUserId,
            username: storedUsername,
            email: storedEmail || "",
          },
          isLoading: false,
          isAuthenticated: true,
        });
        return;
      }

      // Regular API-based authentication
      const response = await AuthAPI.getCurrentUser();

      if (response?.success && response.user) {
        setAuthState({
          user: response.user,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setAuthState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  // Login with email and password only
  const login = async (email: string, password: string) => {
    try {
      const response = await AuthAPI.login(email, password);
      if (response.success && response.token && response.user) {
        // Store authentication data
        setStoredToken(response.token);
        setStoredUsername(response.user.username);
        setStoredUserId(response.user.id);
        setStoredEmail(response.user.email);
        setIsLoggedIn(true);
        setStoredLoginMode("user");
        setAuthState({
          user: response.user,
          isLoading: false,
          isAuthenticated: true,
        });
        return { success: true };
      } else {
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error("Login failed:", error);
      return { success: false, message: "Login failed" };
    }
  };

  const logout = () => {
    // Clear all auth-related localStorage items
    removeStoredToken();
    removeStoredUsername();
    removeStoredUserId();
    removeStoredEmail();
    removeIsLoggedIn();
    removeStoredLoginMode();

    AuthAPI.logout();
    setAuthState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });
    
    // Refresh the page to ensure all components are properly updated
    window.location.reload();
  };

  const refreshAuth = () => {
    checkAuthStatus();
  };

  // Update username for both registered and guest users
  const updateUsername = async (newUsername: string) => {
    try {
      if (storedLoginMode === "guest") {
        // Update guest user locally
        setStoredUsername(newUsername.trim());
        setAuthState(prev => ({
          ...prev,
          user: prev.user ? { ...prev.user, username: newUsername.trim() } : null,
        }));
        // For guest users, return success first, then refresh
        setTimeout(() => {
          window.location.reload();
        }, 1500); // Give time for success message to show
        return { success: true };
      } else {
        // Update registered user via API
        const response = await AuthAPI.updateUsername(newUsername.trim());

        if (response.success && response.token && response.user) {
          // Update stored authentication data with new token and user info
          setStoredToken(response.token);
          setStoredUsername(response.user.username);
          setStoredUserId(response.user.id);
          setStoredEmail(response.user.email);
          setStoredLoginMode("user");

          // Update state
          setAuthState(prev => ({
            ...prev,
            user: response.user || null,
          }));
          
          // Refresh the page to ensure all components are properly updated
          setTimeout(() => {
            window.location.reload();
          }, 1500); // Give time for success message to show
          
          return { success: true };
        } else {
          return { success: false, message: response.message };
        }
      }
    } catch (error) {
      console.error("Update username failed:", error);
      return { success: false, message: error instanceof Error ? error.message : "Failed to update username" };
    }
  };

  return {
    ...authState,
    login,
    logout,
    refreshAuth,
    updateUsername,
  };
}; 
 
 
