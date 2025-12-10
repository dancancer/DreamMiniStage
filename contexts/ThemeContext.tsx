"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "DreamMiniStage-theme";

const resolveInitialTheme = (): ThemeMode => {
  if (typeof document !== "undefined") {
    const preset = document.documentElement.dataset.theme;
    if (preset === "light" || preset === "dark") {
      return preset;
    }
  }
  if (typeof window === "undefined") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const applyTheme = (mode: ThemeMode) => {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.classList.toggle("dark", mode === "dark");
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { value: theme, setValue: setTheme } = useLocalStorage<ThemeMode>(
    STORAGE_KEY,
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
