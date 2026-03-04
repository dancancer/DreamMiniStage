/**
 * @input  hooks/script-bridge/types
 * @output compatDisplayedMessageHandlers
 * @pos    JS-Slash-Runner displayed-message 兼容 API（format/retrieve）
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║               Script Bridge Displayed-Message Compat Handlers            ║
 * ║                                                                           ║
 * ║  目标：补齐 displayed-message 子簇最小闭环，保持参数错误显式 fail-fast          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiCallContext, ApiHandlerMap } from "./types";

type DisplayedMessageLocator = "last" | "last_user" | "last_char" | number;

interface FormatAsDisplayedMessageOptions {
  message_id?: DisplayedMessageLocator;
}

interface RetrievedDisplayedMessagePayload {
  message_id: number;
  role: string;
  name: string | null;
  content: string;
  formatted_content: string;
}

function formatDisplayedText(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/\n/g, "<br>");
}

function parseMessageLocator(
  locator: unknown,
  apiName: string,
  defaultValue: DisplayedMessageLocator,
): DisplayedMessageLocator {
  if (locator === undefined) {
    return defaultValue;
  }

  if (locator === "last" || locator === "last_user" || locator === "last_char") {
    return locator;
  }

  if (typeof locator === "number" && Number.isInteger(locator)) {
    return locator;
  }

  throw new Error(
    `${apiName} message_id is invalid, expected "last" | "last_user" | "last_char" | integer`,
  );
}

function findLastMessageIndex(
  ctx: ApiCallContext,
  matcher: (role: string) => boolean,
): number {
  for (let index = ctx.messages.length - 1; index >= 0; index -= 1) {
    const message = ctx.messages[index];
    if (message && matcher(message.role)) {
      return index;
    }
  }

  return -1;
}

function resolveMessageIndex(
  ctx: ApiCallContext,
  locator: DisplayedMessageLocator,
  apiName: string,
): number {
  if (ctx.messages.length === 0) {
    throw new Error(`${apiName} requires at least one message`);
  }

  const lastMessageIndex = ctx.messages.length - 1;

  if (typeof locator === "number") {
    if (locator < 0 || locator > lastMessageIndex) {
      throw new Error(`${apiName} message_id out of range [0, ${lastMessageIndex}]`);
    }

    return locator;
  }

  if (locator === "last") {
    return lastMessageIndex;
  }

  if (locator === "last_user") {
    const userMessageIndex = findLastMessageIndex(ctx, (role) => role === "user");
    if (userMessageIndex < 0) {
      throw new Error(`${apiName} cannot resolve last_user message`);
    }
    return userMessageIndex;
  }

  const charMessageIndex = findLastMessageIndex(
    ctx,
    (role) => role !== "user" && role !== "system",
  );
  if (charMessageIndex < 0) {
    throw new Error(`${apiName} cannot resolve last_char message`);
  }
  return charMessageIndex;
}

function parseFormatOptions(args: unknown[]): FormatAsDisplayedMessageOptions {
  const rawOption = args[1];
  if (rawOption === undefined) {
    return {};
  }

  if (!rawOption || typeof rawOption !== "object" || Array.isArray(rawOption)) {
    throw new Error("formatAsDisplayedMessage options must be an object");
  }

  return rawOption as FormatAsDisplayedMessageOptions;
}

export const compatDisplayedMessageHandlers: ApiHandlerMap = {
  "formatAsDisplayedMessage": (args: unknown[], ctx: ApiCallContext): string => {
    const [rawText] = args as [unknown];
    if (typeof rawText !== "string") {
      throw new Error("formatAsDisplayedMessage requires text string");
    }

    const option = parseFormatOptions(args);
    const locator = parseMessageLocator(option.message_id, "formatAsDisplayedMessage", "last");
    resolveMessageIndex(ctx, locator, "formatAsDisplayedMessage");

    return formatDisplayedText(rawText);
  },

  "retrieveDisplayedMessage": (
    args: unknown[],
    ctx: ApiCallContext,
  ): RetrievedDisplayedMessagePayload => {
    const [rawMessageId] = args as [unknown];
    const locator = parseMessageLocator(rawMessageId, "retrieveDisplayedMessage", "last");
    const messageIndex = resolveMessageIndex(ctx, locator, "retrieveDisplayedMessage");
    const message = ctx.messages[messageIndex];

    return {
      message_id: messageIndex,
      role: message.role,
      name: typeof message.name === "string" && message.name.trim().length > 0
        ? message.name
        : null,
      content: message.content,
      formatted_content: formatDisplayedText(message.content),
    };
  },
};
