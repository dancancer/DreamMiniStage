export type ScriptHostCapabilityArea =
  | "tool-registration"
  | "extension-state"
  | "clipboard"
  | "audio";

export type ScriptHostSupportLevel =
  | "default"
  | "conditional"
  | "fail-fast"
  | "unsupported";

export interface ScriptHostCapability {
  id: string;
  area: ScriptHostCapabilityArea;
  support: ScriptHostSupportLevel;
  hostSource: "session-default" | "api-context" | "bridge-only";
  hasProductEntry: boolean;
  visibleInDebugger: boolean;
  failFastReason?: string;
}

export const SCRIPT_HOST_CAPABILITY_MATRIX: ScriptHostCapability[] = [
  {
    id: "function-tool-registry",
    area: "tool-registration",
    support: "default",
    hostSource: "bridge-only",
    hasProductEntry: false,
    visibleInDebugger: true,
    failFastReason: "Function tool invocation still fails fast when the iframe callback never returns.",
  },
  {
    id: "extension-enabled-state",
    area: "extension-state",
    support: "conditional",
    hostSource: "api-context",
    hasProductEntry: false,
    visibleInDebugger: true,
    failFastReason: "Extension state requires a host plugin registry or explicit extension callbacks.",
  },
  {
    id: "clipboard-bridge",
    area: "clipboard",
    support: "conditional",
    hostSource: "api-context",
    hasProductEntry: false,
    visibleInDebugger: true,
    failFastReason: "Clipboard commands fail fast when the current host does not inject clipboard callbacks.",
  },
  {
    id: "audio-channel-control",
    area: "audio",
    support: "default",
    hostSource: "session-default",
    hasProductEntry: true,
    visibleInDebugger: true,
    failFastReason: "Audio commands fail fast when arguments are invalid even though the local host path exists.",
  },
] as const;
