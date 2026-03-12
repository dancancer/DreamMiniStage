import type { ScriptHostCapability } from "./host-capability-matrix";
import type {
  ScriptHostDebugOutcome,
  ScriptHostDebugResolvedPath,
} from "./host-debug-state";

export interface ResolveHostCapabilityOptions {
  hasInjectedHost?: boolean;
}

export interface ResolvedHostCapabilityState {
  support: ScriptHostCapability["support"];
  resolvedPath: ScriptHostDebugResolvedPath;
  outcome: ScriptHostDebugOutcome;
  reason?: string;
}

export function resolveHostCapabilityState(
  capability: ScriptHostCapability,
  options: ResolveHostCapabilityOptions = {},
): ResolvedHostCapabilityState {
  if (capability.support === "default") {
    return {
      support: capability.support,
      resolvedPath: capability.hostSource,
      outcome: "supported",
    };
  }

  if (capability.support === "conditional") {
    if (options.hasInjectedHost) {
      return {
        support: capability.support,
        resolvedPath: capability.hostSource,
        outcome: "supported",
      };
    }

    return {
      support: capability.support,
      resolvedPath: "fail-fast",
      outcome: "fail-fast",
      reason: capability.failFastReason,
    };
  }

  return {
    support: capability.support,
    resolvedPath: "fail-fast",
    outcome: "fail-fast",
    reason: capability.failFastReason,
  };
}
