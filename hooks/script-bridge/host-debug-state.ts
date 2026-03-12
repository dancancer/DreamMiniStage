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

const MAX_RECENT_API_CALLS = 20;

export interface ScriptHostDebugState {
  getRecentApiCalls: () => ScriptHostApiCallRecord[];
  recordApiCall: (entry: ScriptHostApiCallRecord) => void;
}

export function createHostDebugState(): ScriptHostDebugState {
  let recentApiCalls: ScriptHostApiCallRecord[] = [];

  return {
    getRecentApiCalls: () => [...recentApiCalls],
    recordApiCall: (entry) => {
      recentApiCalls = [entry, ...recentApiCalls].slice(0, MAX_RECENT_API_CALLS);
    },
  };
}
