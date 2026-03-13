/**
 * @input  browser window/document
 * @output 默认 UI host 回调与工具
 * @pos    JS-Slash-Runner 与 /session 共享的默认 UI host 实现
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

export function isCssColorValue(value: string): boolean {
  if (typeof document === "undefined") {
    return value.trim().length > 0;
  }

  const probe = document.createElement("span");
  probe.style.color = "";
  probe.style.color = value;
  return probe.style.color.length > 0;
}

export function applyChatDisplayMode(mode: "default" | "bubble" | "document"): void {
  if (typeof document === "undefined") {
    throw new Error("chat display mode is not available in current context");
  }

  const body = document.body;
  if (!body) {
    throw new Error("chat display mode host body is not available");
  }

  body.classList.remove("bubblechat", "documentstyle");
  if (mode === "bubble") {
    body.classList.add("bubblechat");
    return;
  }
  if (mode === "document") {
    body.classList.add("documentstyle");
  }
}

function requireDocumentBody(commandName: string): HTMLBodyElement {
  if (typeof document === "undefined") {
    throw new Error(`/${commandName} is not available in current context`);
  }

  if (!document.body) {
    throw new Error(`/${commandName} host body is not available`);
  }

  return document.body as HTMLBodyElement;
}

export function resolveAutoBackgroundColor(): string {
  if (typeof document === "undefined") {
    throw new Error("bgcol is not available in current context");
  }

  const rootStyle = getComputedStyle(document.documentElement);
  const bodyStyle = getComputedStyle(document.body);
  const candidates = [
    rootStyle.getPropertyValue("--SmartThemeBlurTintColor"),
    bodyStyle.backgroundColor,
    rootStyle.backgroundColor,
  ];

  for (const candidate of candidates) {
    const normalized = candidate.trim();
    if (normalized.length > 0 && normalized !== "rgba(0, 0, 0, 0)" && normalized !== "transparent") {
      return normalized;
    }
  }

  return "rgb(0, 0, 0)";
}

export async function defaultShowButtonsPopup(
  text: string,
  labels: string[],
  options?: { multiple?: boolean },
): Promise<string | string[]> {
  if (typeof window === "undefined" || typeof window.prompt !== "function") {
    throw new Error("/buttons host popup is not available in current context");
  }

  const promptBody = labels
    .map((label, index) => `${index + 1}. ${label}`)
    .join("\n");
  const promptTitle = (text || "Select option").trim();

  if (options?.multiple) {
    const raw = window.prompt(
      `${promptTitle}\n${promptBody}\nInput comma-separated numbers:`,
      "",
    );
    if (!raw || raw.trim().length === 0) {
      return [];
    }

    const selected = Array.from(new Set(
      raw
        .split(",")
        .map((chunk) => Number.parseInt(chunk.trim(), 10))
        .filter((index) => Number.isInteger(index) && index > 0 && index <= labels.length),
    ));
    return selected.map((index) => labels[index - 1]);
  }

  const raw = window.prompt(
    `${promptTitle}\n${promptBody}\nInput number:`,
    "",
  );
  if (!raw || raw.trim().length === 0) {
    return "";
  }

  const index = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(index) || index <= 0 || index > labels.length) {
    return "";
  }
  return labels[index - 1];
}

export async function defaultShowPopup(
  text: string,
  options?: {
    header?: string;
    scroll?: boolean;
    large?: boolean;
    wide?: boolean;
    wider?: boolean;
    transparent?: boolean;
    okButton?: string;
    cancelButton?: string;
    result?: boolean;
  },
): Promise<string | number> {
  if (typeof window === "undefined") {
    throw new Error("/popup is not available in current context");
  }

  const header = options?.header?.trim();
  const popupText = [header, text].filter(Boolean).join("\n\n");
  const useResult = options?.result === true;
  const hasCancelButton = typeof options?.cancelButton === "string";

  if (hasCancelButton || useResult) {
    const confirmed = window.confirm(popupText);
    if (useResult) {
      return confirmed ? 1 : 0;
    }
    return confirmed ? text : "";
  }

  window.alert(popupText);
  return useResult ? 1 : text;
}

export async function defaultPickIcon(): Promise<string | false> {
  if (typeof window === "undefined" || typeof window.prompt !== "function") {
    throw new Error("/pick-icon is not available in current context");
  }

  const raw = window.prompt("Input icon name:", "");
  const iconName = (raw || "").trim();
  return iconName || false;
}

export function defaultIsMobile(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent || "";
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua);
}

export async function defaultCloseCurrentChat(): Promise<void> {
  if (typeof document === "undefined") {
    throw new Error("/closechat is not available in current context");
  }

  const closeButton = document.querySelector<HTMLElement>("#option_close_chat");
  if (!closeButton) {
    throw new Error("/closechat host close button is not available");
  }

  closeButton.click();
}

export function createDefaultTogglePanels() {
  if (typeof document === "undefined") {
    return undefined;
  }

  return async (): Promise<void> => {
    const body = requireDocumentBody("panels");
    const nextValue = body.dataset.panelsCollapsed === "true" ? "false" : "true";
    body.dataset.panelsCollapsed = nextValue;
  };
}

export function createDefaultResetPanels() {
  if (typeof document === "undefined") {
    return undefined;
  }

  return async (): Promise<void> => {
    const body = requireDocumentBody("resetpanels");
    delete body.dataset.panelsCollapsed;
    delete body.dataset.vnMode;
    delete body.dataset.movingUiPreset;
  };
}

export function createDefaultToggleVisualNovelMode() {
  if (typeof document === "undefined") {
    return undefined;
  }

  return async (): Promise<void> => {
    const body = requireDocumentBody("vn");
    const nextValue = body.dataset.vnMode === "true" ? "false" : "true";
    body.dataset.vnMode = nextValue;
  };
}

export function createDefaultSetTheme() {
  if (typeof document === "undefined") {
    return undefined;
  }

  return async (theme?: string): Promise<string> => {
    const root = document.documentElement;
    const currentTheme = root.getAttribute("data-theme") || "dark";
    if (!theme) {
      return currentTheme;
    }

    const nextTheme = theme.trim();
    if (!nextTheme) {
      return currentTheme;
    }

    root.setAttribute("data-theme", nextTheme);
    return nextTheme;
  };
}

export function createDefaultSetMovingUiPreset() {
  if (typeof document === "undefined") {
    return undefined;
  }

  return async (presetName: string): Promise<string> => {
    const body = requireDocumentBody("movingui");
    const nextPreset = presetName.trim();
    if (!nextPreset) {
      throw new Error("/movingui requires a preset name");
    }

    body.dataset.movingUiPreset = nextPreset;
    return nextPreset;
  };
}

export function createDefaultSetBackground() {
  if (typeof document === "undefined") {
    return undefined;
  }

  return async (background?: string): Promise<string> => {
    const body = requireDocumentBody("bg");
    const currentBackground = body.dataset.background || "";
    if (!background) {
      return currentBackground;
    }

    const nextBackground = background.trim();
    if (!nextBackground) {
      return currentBackground;
    }

    body.dataset.background = nextBackground;
    return nextBackground;
  };
}

export function createDefaultLockBackground() {
  if (typeof document === "undefined") {
    return undefined;
  }

  return async (): Promise<void> => {
    const body = requireDocumentBody("lockbg");
    body.dataset.backgroundLocked = "true";
  };
}

export function createDefaultUnlockBackground() {
  if (typeof document === "undefined") {
    return undefined;
  }

  return async (): Promise<void> => {
    const body = requireDocumentBody("unlockbg");
    delete body.dataset.backgroundLocked;
  };
}

export function createDefaultAutoBackground() {
  if (typeof document === "undefined") {
    return undefined;
  }

  return async (): Promise<void> => {
    const body = requireDocumentBody("autobg");
    if (body.dataset.backgroundLocked === "true") {
      return;
    }
    body.dataset.background = body.dataset.backgroundAuto || "auto";
  };
}

export function createDefaultSetCssVariable() {
  if (typeof document === "undefined") {
    return undefined;
  }

  return async (args: { varName: string; value: string; target?: string }): Promise<void> => {
    const nextValue = args.value.trim();
    if (!args.varName.startsWith("--")) {
      throw new Error('/css-var varname must start with "--"');
    }
    if (!nextValue) {
      throw new Error("/css-var requires a value");
    }

    const element = args.target === "chat"
      ? requireDocumentBody("css-var")
      : document.documentElement;
    element.style.setProperty(args.varName, nextValue);
  };
}

export function createDefaultSetAverageBackgroundColor() {
  if (typeof document === "undefined") {
    return undefined;
  }

  return async (color?: string): Promise<string> => {
    const nextColor = (color || resolveAutoBackgroundColor()).trim();
    if (!nextColor) {
      throw new Error("/bgcol could not resolve target color");
    }
    if (!isCssColorValue(nextColor)) {
      throw new Error(`/bgcol invalid color value: ${color}`);
    }
    document.documentElement.style.setProperty("--SmartThemeBlurTintColor", nextColor);
    return nextColor;
  };
}

export function createDefaultSetChatDisplayMode() {
  if (typeof document === "undefined") {
    return undefined;
  }

  return async (mode: "default" | "bubble" | "document"): Promise<void> => {
    applyChatDisplayMode(mode);
  };
}
