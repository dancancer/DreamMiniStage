/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                             UI Layout 状态                          ║
 * ║  左侧导航与右侧抽屉的统一状态容器，减少分支与漂移。                      ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const PANEL_IDS = [
  "characters",
  "worldbook",
  "regex",
  "presets",
  "modelSettings",
  "plugins",
  "tagColors",
  "advancedSettings",
  "data",
] as const;

export type PanelId = (typeof PANEL_IDS)[number];

export interface UiLayoutState {
  activePanel: PanelId | null;
  isPanelOpen: boolean;
  openPanel: (panelId: PanelId) => void;
  closePanel: () => void;
}

const UiLayoutContext = createContext<UiLayoutState | null>(null);

function isPanelId(value: string | null): value is PanelId {
  return value !== null && PANEL_IDS.includes(value as PanelId);
}

export function parsePanelId(value: string | null): PanelId | null {
  return isPanelId(value) ? value : null;
}

export function UiLayoutProvider({ children }: { children: React.ReactNode }) {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);

  const openPanel = useCallback((panelId: PanelId) => {
    setActivePanel(panelId);
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  const value = useMemo<UiLayoutState>(
    () => ({
      activePanel,
      isPanelOpen: activePanel !== null,
      openPanel,
      closePanel,
    }),
    [activePanel, openPanel, closePanel],
  );

  return <UiLayoutContext.Provider value={value}>{children}</UiLayoutContext.Provider>;
}

export function useUiLayout() {
  const context = useContext(UiLayoutContext);

  if (!context) {
    throw new Error("useUiLayout must be used within UiLayoutProvider");
  }

  return context;
}
