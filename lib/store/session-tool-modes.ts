import { create } from "zustand";
import type React from "react";

export interface SessionPerspectiveMode {
  active: boolean;
  mode: "novel" | "protagonist";
}

export interface SessionToolModes {
  "story-progress": boolean;
  perspective: SessionPerspectiveMode;
  "scene-setting": boolean;
  streaming?: boolean;
  fastModel?: boolean;
}

const INITIAL_SESSION_TOOL_MODES: SessionToolModes = {
  "story-progress": false,
  perspective: { active: false, mode: "novel" },
  "scene-setting": false,
};

interface SessionToolModesState {
  activeModes: SessionToolModes;
  setActiveModes: (updater: React.SetStateAction<SessionToolModes>) => void;
  toggleStoryProgress: () => void;
  cyclePerspective: () => void;
  toggleSceneSetting: () => void;
  resetModes: () => void;
}

export const useSessionToolModesStore = create<SessionToolModesState>((set) => ({
  activeModes: INITIAL_SESSION_TOOL_MODES,

  setActiveModes: (updater) => {
    set((state) => ({
      activeModes: typeof updater === "function"
        ? updater(state.activeModes)
        : updater,
    }));
  },

  toggleStoryProgress: () => {
    set((state) => ({
      activeModes: {
        ...state.activeModes,
        "story-progress": !state.activeModes["story-progress"],
      },
    }));
  },

  cyclePerspective: () => {
    set((state) => {
      const perspective = state.activeModes.perspective;

      if (!perspective.active) {
        return {
          activeModes: {
            ...state.activeModes,
            perspective: { active: true, mode: "novel" },
          },
        };
      }

      if (perspective.mode === "novel") {
        return {
          activeModes: {
            ...state.activeModes,
            perspective: { active: true, mode: "protagonist" },
          },
        };
      }

      return {
        activeModes: {
          ...state.activeModes,
          perspective: { active: false, mode: "novel" },
        },
      };
    });
  },

  toggleSceneSetting: () => {
    set((state) => ({
      activeModes: {
        ...state.activeModes,
        "scene-setting": !state.activeModes["scene-setting"],
      },
    }));
  },

  resetModes: () => {
    set({
      activeModes: INITIAL_SESSION_TOOL_MODES,
    });
  },
}));
