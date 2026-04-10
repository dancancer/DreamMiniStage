/**
 * @input  react, hooks/useLocalStorage
 * @output ThemeProvider, useTheme
 * @pos    主题状态层 - 管理 light/dark 模式切换与本地持久化
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { THEME_STORAGE_KEY, resolveThemeMode } from "@/lib/theme/initial-theme";

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const resolveInitialTheme = (): ThemeMode => {
  const prefersDark = typeof window !== "undefined"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (typeof document !== "undefined") {
    return resolveThemeMode(document.documentElement.dataset.theme, null, prefersDark);
  }

  return resolveThemeMode(null, null, prefersDark);
};

const applyTheme = (mode: ThemeMode) => {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { value: theme, setValue: setTheme } = useLocalStorage<ThemeMode>(
    THEME_STORAGE_KEY,
    resolveInitialTheme(),
    {
      serializer: (mode) => mode,
      deserializer: (mode) => (mode === "light" ? "light" : "dark"),
      readOnInit: false,
    },
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      setTheme,
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
