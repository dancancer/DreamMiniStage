/**
 * Script Variables Store
 * 
 * Manages variables accessible to scripts running in the sandbox.
 * Supports different scopes: global, character-specific, and session-specific.
 * Uses Zustand for state management and persistence.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface VariableScope {
  global: Record<string, any>;
  character: Record<string, Record<string, any>>; // characterId -> variables
  session: Record<string, Record<string, any>>;   // sessionId -> variables
}

interface ScriptVariablesState {
  variables: VariableScope;
  
  // Actions
  setGlobalVariable: (key: string, value: any) => void;
  getGlobalVariable: (key: string) => any;
  deleteGlobalVariable: (key: string) => void;
  
  setCharacterVariable: (characterId: string, key: string, value: any) => void;
  getCharacterVariable: (characterId: string, key: string) => any;
  deleteCharacterVariable: (characterId: string, key: string) => void;
  
  setSessionVariable: (sessionId: string, key: string, value: any) => void;
  getSessionVariable: (sessionId: string, key: string) => any;
  deleteSessionVariable: (sessionId: string, key: string) => void;
  
  // Unified access (defaults to global if scope not specified)
  setVariable: (key: string, value: any, scope?: "global" | "character" | "session", id?: string) => void;
  getVariable: (key: string, scope?: "global" | "character" | "session", id?: string) => any;
  deleteVariable: (key: string, scope?: "global" | "character" | "session", id?: string) => void;
  
  clearAll: () => void;
}

export const useScriptVariables = create<ScriptVariablesState>()(
  persist(
    (set, get) => ({
      variables: {
        global: {},
        character: {},
        session: {},
      },

      setGlobalVariable: (key, value) =>
        set((state) => ({
          variables: {
            ...state.variables,
            global: {
              ...state.variables.global,
              [key]: value,
            },
          },
        })),

      getGlobalVariable: (key) => get().variables.global[key],

      deleteGlobalVariable: (key) =>
        set((state) => {
          const newGlobal = { ...state.variables.global };
          delete newGlobal[key];
          return {
            variables: {
              ...state.variables,
              global: newGlobal,
            },
          };
        }),

      setCharacterVariable: (characterId, key, value) =>
        set((state) => ({
          variables: {
            ...state.variables,
            character: {
              ...state.variables.character,
              [characterId]: {
                ...(state.variables.character[characterId] || {}),
                [key]: value,
              },
            },
          },
        })),

      getCharacterVariable: (characterId, key) =>
        get().variables.character[characterId]?.[key],

      deleteCharacterVariable: (characterId, key) =>
        set((state) => {
          const charVars = { ...(state.variables.character[characterId] || {}) };
          delete charVars[key];
          return {
            variables: {
              ...state.variables,
              character: {
                ...state.variables.character,
                [characterId]: charVars,
              },
            },
          };
        }),

      setSessionVariable: (sessionId, key, value) =>
        set((state) => ({
          variables: {
            ...state.variables,
            session: {
              ...state.variables.session,
              [sessionId]: {
                ...(state.variables.session[sessionId] || {}),
                [key]: value,
              },
            },
          },
        })),

      getSessionVariable: (sessionId, key) =>
        get().variables.session[sessionId]?.[key],

      deleteSessionVariable: (sessionId, key) =>
        set((state) => {
          const sessionVars = { ...(state.variables.session[sessionId] || {}) };
          delete sessionVars[key];
          return {
            variables: {
              ...state.variables,
              session: {
                ...state.variables.session,
                [sessionId]: sessionVars,
              },
            },
          };
        }),

      setVariable: (key, value, scope = "global", id) => {
        if (scope === "character" && id) {
          get().setCharacterVariable(id, key, value);
        } else if (scope === "session" && id) {
          get().setSessionVariable(id, key, value);
        } else {
          get().setGlobalVariable(key, value);
        }
      },

      getVariable: (key, scope = "global", id) => {
        if (scope === "character" && id) {
          return get().getCharacterVariable(id, key);
        } else if (scope === "session" && id) {
          return get().getSessionVariable(id, key);
        } else {
          return get().getGlobalVariable(key);
        }
      },

      deleteVariable: (key, scope = "global", id) => {
        if (scope === "character" && id) {
          get().deleteCharacterVariable(id, key);
        } else if (scope === "session" && id) {
          get().deleteSessionVariable(id, key);
        } else {
          get().deleteGlobalVariable(key);
        }
      },

      clearAll: () =>
        set({
          variables: {
            global: {},
            character: {},
            session: {},
          },
        }),
    }),
    {
      name: "DreamMiniStage-script-variables",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
