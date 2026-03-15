export type ScriptHostDebugResolvedPath =
  | "session-default"
  | "api-context"
  | "bridge-only"
  | "fail-fast";

export type ScriptHostDebugOutcome = "supported" | "fail-fast";

export interface ScriptHostApiCallRecord {
  method: string;
  capability: string;
  resolvedPath: ScriptHostDebugResolvedPath;
  outcome: ScriptHostDebugOutcome;
  timestamp: number;
}

export interface ScriptHostRuntimeState {
  toolRegistrations: number;
  eventListeners: number;
  hasHostOverrides: boolean;
}

export interface ScriptHostDebugSnapshot {
  recentApiCalls: ScriptHostApiCallRecord[];
  runtimeState: ScriptHostRuntimeState;
}

const MAX_RECENT_API_CALLS = 20;

export interface ScriptHostDebugState {
  getRecentApiCalls: () => ScriptHostApiCallRecord[];
  getRuntimeState: () => ScriptHostRuntimeState;
  recordApiCall: (entry: ScriptHostApiCallRecord) => void;
  setToolRegistrationCount: (count: number) => void;
  setEventListenerCount: (count: number) => void;
  setHasHostOverrides: (value: boolean) => void;
}

export function createHostDebugState(): ScriptHostDebugState {
  let recentApiCalls: ScriptHostApiCallRecord[] = [];
  let runtimeState: ScriptHostRuntimeState = {
    toolRegistrations: 0,
    eventListeners: 0,
    hasHostOverrides: false,
  };

  return {
    getRecentApiCalls: () => [...recentApiCalls],
    getRuntimeState: () => ({ ...runtimeState }),
    recordApiCall: (entry) => {
      recentApiCalls = [entry, ...recentApiCalls].slice(0, MAX_RECENT_API_CALLS);
    },
    setToolRegistrationCount: (count) => {
      runtimeState = {
        ...runtimeState,
        toolRegistrations: count,
      };
    },
    setEventListenerCount: (count) => {
      runtimeState = {
        ...runtimeState,
        eventListeners: count,
      };
    },
    setHasHostOverrides: (value) => {
      runtimeState = {
        ...runtimeState,
        hasHostOverrides: value,
      };
    },
  };
}

export function readHostDebugSnapshot(state: ScriptHostDebugState): ScriptHostDebugSnapshot {
  return {
    recentApiCalls: state.getRecentApiCalls(),
    runtimeState: state.getRuntimeState(),
  };
}
