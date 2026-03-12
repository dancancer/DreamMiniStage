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

const HOST_CAPABILITIES = [
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

const METHOD_CAPABILITY_MAP = {
  registerFunctionTool: "function-tool-registry",
  unregisterFunctionTool: "function-tool-registry",
  getAudioSettings: "audio-channel-control",
  setAudioSettings: "audio-channel-control",
  setAudioEnabled: "audio-channel-control",
  setAudioMode: "audio-channel-control",
  setGlobalVolume: "audio-channel-control",
  muteAll: "audio-channel-control",
} as const;

export const SCRIPT_HOST_CAPABILITY_MATRIX: ScriptHostCapability[] = [...HOST_CAPABILITIES];

export function getScriptHostCapabilityById(id: string): ScriptHostCapability | undefined {
  return SCRIPT_HOST_CAPABILITY_MATRIX.find((capability) => capability.id === id);
}

export function getScriptHostCapabilityByMethod(method: string): ScriptHostCapability | undefined {
  const capabilityId = METHOD_CAPABILITY_MAP[method as keyof typeof METHOD_CAPABILITY_MAP];
  if (!capabilityId) {
    return undefined;
  }

  return getScriptHostCapabilityById(capabilityId);
}
