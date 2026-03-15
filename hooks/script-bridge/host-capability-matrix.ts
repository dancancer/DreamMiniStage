export type ScriptHostCapabilityArea =
  | "tool-registration"
  | "extension-state"
  | "clipboard"
  | "audio"
  | "gallery"
  | "navigation"
  | "proxy"
  | "quick-reply"
  | "checkpoint"
  | "group-member"
  | "translation"
  | "youtube-transcript"
  | "timed-world-info"
  | "ui-style"
  | "popup"
  | "device"
  | "chat-control"
  | "panel-layout"
  | "background";

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

export type ScriptHostCapabilitySourceKey =
  | "translation"
  | "youtubeTranscript"
  | "clipboardRead"
  | "clipboardWrite"
  | "extensionRead"
  | "extensionWrite"
  | "galleryList"
  | "galleryShow";

export interface ScriptHostCapabilityMatch {
  capability: ScriptHostCapability;
  sourceKey?: ScriptHostCapabilitySourceKey;
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
    id: "extension-state-read",
    area: "extension-state",
    support: "default",
    hostSource: "session-default",
    hasProductEntry: false,
    visibleInDebugger: true,
    failFastReason: "Extension reads fail fast when the /session host plugin registry is unavailable or returns invalid state.",
  },
  {
    id: "extension-state-write",
    area: "extension-state",
    support: "conditional",
    hostSource: "api-context",
    hasProductEntry: false,
    visibleInDebugger: true,
    failFastReason: "Extension writes stay conditional until an explicit host writer is injected.",
  },
  {
    id: "clipboard-bridge",
    area: "clipboard",
    support: "default",
    hostSource: "session-default",
    hasProductEntry: false,
    visibleInDebugger: true,
    failFastReason: "Clipboard commands fail fast when browser clipboard access is unavailable or the current host rejects the request.",
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
  {
    id: "gallery-browser",
    area: "gallery",
    support: "default",
    hostSource: "session-default",
    hasProductEntry: true,
    visibleInDebugger: true,
    failFastReason: "Gallery commands fail fast when the current /session page cannot resolve gallery items for the requested target.",
  },
  {
    id: "session-navigation",
    area: "navigation",
    support: "default",
    hostSource: "session-default",
    hasProductEntry: true,
    visibleInDebugger: true,
    failFastReason: "Navigation commands fail fast when the current /session page cannot create the requested target or resolve the requested message anchor.",
  },
  {
    id: "proxy-preset",
    area: "proxy",
    support: "default",
    hostSource: "session-default",
    hasProductEntry: true,
    visibleInDebugger: true,
    failFastReason: "Proxy preset selection fails fast when the target preset cannot be resolved from the active model store.",
  },
  {
    id: "quick-reply-execution",
    area: "quick-reply",
    support: "default",
    hostSource: "session-default",
    hasProductEntry: true,
    visibleInDebugger: true,
    failFastReason: "Quick Reply execution fails fast when the requested reply index or visible set cannot be resolved in the current session.",
  },
  {
    id: "checkpoint-navigation",
    area: "checkpoint",
    support: "default",
    hostSource: "session-default",
    hasProductEntry: true,
    visibleInDebugger: true,
    failFastReason: "Checkpoint commands fail fast when the current /session store has no matching checkpoint or branch target.",
  },
  {
    id: "group-member-management",
    area: "group-member",
    support: "default",
    hostSource: "session-default",
    hasProductEntry: true,
    visibleInDebugger: true,
    failFastReason: "Group member commands fail fast when the current /session store cannot resolve the requested member target.",
  },
  {
    id: "session-translation",
    area: "translation",
    support: "default",
    hostSource: "session-default",
    hasProductEntry: true,
    visibleInDebugger: true,
    failFastReason: "Translation fails fast when the current /session host has no available translator or the requested provider is unsupported.",
  },
  {
    id: "youtube-transcript",
    area: "youtube-transcript",
    support: "default",
    hostSource: "session-default",
    hasProductEntry: true,
    visibleInDebugger: true,
    failFastReason: "YouTube transcript extraction fails fast when the current /session host cannot resolve transcript content from the requested URL.",
  },
  {
    id: "timed-world-info",
    area: "timed-world-info",
    support: "default",
    hostSource: "session-default",
    hasProductEntry: true,
    visibleInDebugger: true,
    failFastReason: "Timed world info commands fail fast when the current /session dialogue store cannot resolve the requested lore entry or effect.",
  },
  {
    id: "ui-style-control",
    area: "ui-style",
    support: "default",
    hostSource: "bridge-only",
    hasProductEntry: true,
    visibleInDebugger: true,
    failFastReason: "UI style commands fail fast when the current browser context cannot apply the requested visual state.",
  },
  {
    id: "popup-interaction",
    area: "popup",
    support: "default",
    hostSource: "bridge-only",
    hasProductEntry: true,
    visibleInDebugger: true,
    failFastReason: "Popup commands fail fast when browser dialog APIs are unavailable in the current context.",
  },
  {
    id: "device-capability-read",
    area: "device",
    support: "default",
    hostSource: "bridge-only",
    hasProductEntry: false,
    visibleInDebugger: true,
    failFastReason: "Device capability reads fail fast when the current runtime cannot inspect browser user-agent state.",
  },
  {
    id: "chat-window-control",
    area: "chat-control",
    support: "default",
    hostSource: "bridge-only",
    hasProductEntry: false,
    visibleInDebugger: true,
    failFastReason: "Chat window control fails fast when the current browser document has no close-chat target.",
  },
  {
    id: "panel-layout-control",
    area: "panel-layout",
    support: "default",
    hostSource: "bridge-only",
    hasProductEntry: true,
    visibleInDebugger: true,
    failFastReason: "Panel layout commands fail fast when the current browser document cannot persist or toggle the requested layout state.",
  },
  {
    id: "background-control",
    area: "background",
    support: "default",
    hostSource: "bridge-only",
    hasProductEntry: true,
    visibleInDebugger: true,
    failFastReason: "Background commands fail fast when the current browser document cannot persist the requested background state.",
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

const TRIGGER_SLASH_CAPABILITY_MAP = {
  "clipboard-get": {
    capabilityId: "clipboard-bridge",
    sourceKey: "clipboardRead",
  },
  "clipboard-set": {
    capabilityId: "clipboard-bridge",
    sourceKey: "clipboardWrite",
  },
  "extension-state": {
    capabilityId: "extension-state-read",
    sourceKey: "extensionRead",
  },
  "extension-exists": {
    capabilityId: "extension-state-read",
    sourceKey: "extensionRead",
  },
  "extension-installed": {
    capabilityId: "extension-state-read",
    sourceKey: "extensionRead",
  },
  "extension-enable": {
    capabilityId: "extension-state-write",
    sourceKey: "extensionWrite",
  },
  "extension-disable": {
    capabilityId: "extension-state-write",
    sourceKey: "extensionWrite",
  },
  "extension-toggle": {
    capabilityId: "extension-state-write",
    sourceKey: "extensionWrite",
  },
  "list-gallery": {
    capabilityId: "gallery-browser",
    sourceKey: "galleryList",
  },
  "lg": {
    capabilityId: "gallery-browser",
    sourceKey: "galleryList",
  },
  "show-gallery": {
    capabilityId: "gallery-browser",
    sourceKey: "galleryShow",
  },
  "sg": {
    capabilityId: "gallery-browser",
    sourceKey: "galleryShow",
  },
  "tempchat": {
    capabilityId: "session-navigation",
  },
  "chat-jump": {
    capabilityId: "session-navigation",
  },
  "floor-teleport": {
    capabilityId: "session-navigation",
  },
  "proxy": {
    capabilityId: "proxy-preset",
  },
  "qr": {
    capabilityId: "quick-reply-execution",
  },
  "checkpoint-create": {
    capabilityId: "checkpoint-navigation",
  },
  "checkpoint-get": {
    capabilityId: "checkpoint-navigation",
  },
  "checkpoint-list": {
    capabilityId: "checkpoint-navigation",
  },
  "checkpoint-go": {
    capabilityId: "checkpoint-navigation",
  },
  "checkpoint-exit": {
    capabilityId: "checkpoint-navigation",
  },
  "checkpoint-parent": {
    capabilityId: "checkpoint-navigation",
  },
  "member-add": {
    capabilityId: "group-member-management",
  },
  "addmember": {
    capabilityId: "group-member-management",
  },
  "memberadd": {
    capabilityId: "group-member-management",
  },
  "member-remove": {
    capabilityId: "group-member-management",
  },
  "removemember": {
    capabilityId: "group-member-management",
  },
  "memberremove": {
    capabilityId: "group-member-management",
  },
  "member-up": {
    capabilityId: "group-member-management",
  },
  "upmember": {
    capabilityId: "group-member-management",
  },
  "memberup": {
    capabilityId: "group-member-management",
  },
  "member-down": {
    capabilityId: "group-member-management",
  },
  "downmember": {
    capabilityId: "group-member-management",
  },
  "memberdown": {
    capabilityId: "group-member-management",
  },
  "member-peek": {
    capabilityId: "group-member-management",
  },
  "peek": {
    capabilityId: "group-member-management",
  },
  "memberpeek": {
    capabilityId: "group-member-management",
  },
  "peekmember": {
    capabilityId: "group-member-management",
  },
  "member-count": {
    capabilityId: "group-member-management",
  },
  "countmember": {
    capabilityId: "group-member-management",
  },
  "membercount": {
    capabilityId: "group-member-management",
  },
  "member-get": {
    capabilityId: "group-member-management",
  },
  "getmember": {
    capabilityId: "group-member-management",
  },
  "memberget": {
    capabilityId: "group-member-management",
  },
  "member-enable": {
    capabilityId: "group-member-management",
  },
  "enablemember": {
    capabilityId: "group-member-management",
  },
  "memberenable": {
    capabilityId: "group-member-management",
  },
  "member-disable": {
    capabilityId: "group-member-management",
  },
  "disablemember": {
    capabilityId: "group-member-management",
  },
  "memberdisable": {
    capabilityId: "group-member-management",
  },
  "enable": {
    capabilityId: "group-member-management",
  },
  "disable": {
    capabilityId: "group-member-management",
  },
  "translate": {
    capabilityId: "session-translation",
    sourceKey: "translation",
  },
  "yt-script": {
    capabilityId: "youtube-transcript",
    sourceKey: "youtubeTranscript",
  },
  "wi-get-timed-effect": {
    capabilityId: "timed-world-info",
  },
  "wi-set-timed-effect": {
    capabilityId: "timed-world-info",
  },
  "bgcol": {
    capabilityId: "ui-style-control",
  },
  "theme": {
    capabilityId: "ui-style-control",
  },
  "movingui": {
    capabilityId: "ui-style-control",
  },
  "css-var": {
    capabilityId: "ui-style-control",
  },
  "bubble": {
    capabilityId: "ui-style-control",
  },
  "bubbles": {
    capabilityId: "ui-style-control",
  },
  "default": {
    capabilityId: "ui-style-control",
  },
  "single": {
    capabilityId: "ui-style-control",
  },
  "story": {
    capabilityId: "ui-style-control",
  },
  "buttons": {
    capabilityId: "popup-interaction",
  },
  "popup": {
    capabilityId: "popup-interaction",
  },
  "pick-icon": {
    capabilityId: "popup-interaction",
  },
  "is-mobile": {
    capabilityId: "device-capability-read",
  },
  "panels": {
    capabilityId: "panel-layout-control",
  },
  "togglepanels": {
    capabilityId: "panel-layout-control",
  },
  "resetpanels": {
    capabilityId: "panel-layout-control",
  },
  "vn": {
    capabilityId: "panel-layout-control",
  },
  "bg": {
    capabilityId: "background-control",
  },
  "background": {
    capabilityId: "background-control",
  },
  "lockbg": {
    capabilityId: "background-control",
  },
  "bglock": {
    capabilityId: "background-control",
  },
  "unlockbg": {
    capabilityId: "background-control",
  },
  "bgunlock": {
    capabilityId: "background-control",
  },
  "autobg": {
    capabilityId: "background-control",
  },
  "bgauto": {
    capabilityId: "background-control",
  },
  "closechat": {
    capabilityId: "chat-window-control",
  },
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

function extractSlashCommandName(script: string): string | null {
  const match = script.trim().match(/^\/([a-z0-9-]+)/i);
  return match?.[1]?.toLowerCase() || null;
}

export function getScriptHostCapabilityFromCall(
  method: string,
  args: unknown[],
): ScriptHostCapabilityMatch | undefined {
  const direct = getScriptHostCapabilityByMethod(method);
  if (direct) {
    return { capability: direct };
  }

  if (method !== "triggerSlash" && method !== "triggerSlashWithResult") {
    return undefined;
  }

  const script = typeof args[0] === "string" ? args[0] : "";
  const commandName = extractSlashCommandName(script);
  if (!commandName) {
    return undefined;
  }

  const matched = TRIGGER_SLASH_CAPABILITY_MAP[commandName as keyof typeof TRIGGER_SLASH_CAPABILITY_MAP];
  if (!matched) {
    return undefined;
  }

  const capability = getScriptHostCapabilityById(matched.capabilityId);
  if (!capability) {
    return undefined;
  }

  return {
    capability,
    sourceKey: "sourceKey" in matched ? matched.sourceKey : undefined,
  };
}
