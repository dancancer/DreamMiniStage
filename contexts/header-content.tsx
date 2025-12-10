/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                       Header Content Context                       ║
 * ║  允许页面注入自定义 TopBar 内容，便于合并重复的标题区域。               ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { createContext, useContext, useState, useMemo } from "react";

interface HeaderContentState {
  headerContent: React.ReactNode | null;
  setHeaderContent: (content: React.ReactNode | null) => void;
}

const HeaderContentContext = createContext<HeaderContentState | null>(null);

export function HeaderContentProvider({ children }: { children: React.ReactNode }) {
  const [headerContent, setHeaderContent] = useState<React.ReactNode | null>(null);

  const value = useMemo(
    () => ({ headerContent, setHeaderContent }),
    [headerContent],
  );

  return (
    <HeaderContentContext.Provider value={value}>
      {children}
    </HeaderContentContext.Provider>
  );
}

export function useHeaderContent() {
  const ctx = useContext(HeaderContentContext);
  if (!ctx) {
    throw new Error("useHeaderContent must be used within HeaderContentProvider");
  }
  return ctx;
}
