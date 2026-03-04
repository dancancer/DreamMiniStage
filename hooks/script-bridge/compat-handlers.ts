/**
 * @input  hooks/script-bridge/types, function/*, lib/script-runner/script-storage
 * @output compatHandlers
 * @pos    JS-Slash-Runner 高价值兼容 API（import_raw / extension / script buttons / version）
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       Script Bridge Compatibility Handlers                ║
 * ║                                                                           ║
 * ║  目标：补齐迁移高频 API，统一走 Script Bridge 单路径                           ║
 * ║  覆盖：import_raw / extension / script buttons / version 相关接口         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiCallContext, ApiHandlerMap } from "./types";
import { importPresetFromJson } from "@/function/preset/import";
import { importWorldBookFromJson } from "@/function/worldbook/import";
import { importDialogueJsonl } from "@/function/dialogue/jsonl";
import { canImportRegexScripts, importRegexScripts } from "@/lib/adapters/import";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";
import { getScriptButtons } from "@/lib/script-runner/script-storage";
import { createMacroEvaluator } from "@/lib/core/st-macro-evaluator";
import type { MacroEnv } from "@/lib/core/st-preset-types";
import { compatRegexHandlers } from "./compat-regex-handlers";
import { compatDisplayedMessageHandlers } from "./compat-displayed-message-handlers";

const DEFAULT_FRONTEND_VERSION = "0.1.0";
const DEFAULT_EXTENSION_ID = "JS-Slash-Runner";
const HOST_EXTENSION_TYPES: Record<string, "local" | "global" | "system"> = {
  "JS-Slash-Runner": "system",
  "DreamMiniStage": "system",
};

interface ExtensionInstallationInfo {
  current_branch_name: string;
  current_commit_hash: string;
  is_up_to_date: boolean;
  remote_url: string;
}

type MacroPrimitive = string | number | boolean;

function getFrontendVersionValue(): string {
  const globalVersion = (globalThis as { __DREAM_FRONTEND_VERSION__?: string }).__DREAM_FRONTEND_VERSION__;
  if (typeof globalVersion === "string" && globalVersion.trim().length > 0) {
    return globalVersion.trim();
  }

  const envVersion = process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version;
  if (typeof envVersion === "string" && envVersion.trim().length > 0) {
    return envVersion.trim();
  }

  return DEFAULT_FRONTEND_VERSION;
}

function ensureArgsShape(
  args: unknown[],
  apiName: string,
): { name?: string; content: unknown } {
  if (args.length === 0) {
    throw new Error(`${apiName} requires content`);
  }

  if (args.length === 1) {
    return { content: args[0] };
  }

  const [name, content] = args;
  if (typeof name !== "string") {
    throw new Error(`${apiName} expects (name, content) or (content)`);
  }

  return { name, content };
}

function parseStructuredContent(content: unknown, apiName: string): unknown {
  if (typeof content === "string") {
    try {
      return JSON.parse(content);
    } catch {
      throw new Error(`${apiName} requires valid JSON string content`);
    }
  }

  if (content && typeof content === "object") {
    return content;
  }

  throw new Error(`${apiName} requires JSON object/array content`);
}

function parseExtensionId(args: unknown[], apiName: string): string {
  const extensionId = args[0];
  if (typeof extensionId !== "string" || extensionId.trim().length === 0) {
    throw new Error(`${apiName} requires extension id`);
  }

  return extensionId.trim();
}

function getHostExtensionType(extensionId: string): "local" | "global" | "system" | null {
  return HOST_EXTENSION_TYPES[extensionId] ?? null;
}

function toMacroPrimitive(value: unknown): MacroPrimitive | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return undefined;
}

function pickMacroVariables(source: Record<string, unknown> | undefined): Record<string, MacroPrimitive> {
  if (!source) {
    return {};
  }

  const result: Record<string, MacroPrimitive> = {};
  for (const [key, value] of Object.entries(source)) {
    const primitive = toMacroPrimitive(value);
    if (primitive !== undefined) {
      result[key] = primitive;
    }
  }
  return result;
}

function findLastMessageContent(
  messages: ApiCallContext["messages"],
  matcher: (role: string) => boolean,
): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message && matcher(message.role)) {
      return message.content;
    }
  }
  return "";
}

function buildMacroEnv(ctx: ApiCallContext): MacroEnv {
  const variableSnapshot = ctx.getVariablesSnapshot();
  const characterVariables = ctx.characterId
    ? variableSnapshot.character[ctx.characterId]
    : undefined;
  const lastMessage = ctx.messages[ctx.messages.length - 1];

  return {
    user: "User",
    char: ctx.characterId || "Character",
    lastMessage: lastMessage?.content || "",
    lastUserMessage: findLastMessageContent(ctx.messages, (role) => role === "user"),
    lastCharMessage: findLastMessageContent(
      ctx.messages,
      (role) => role !== "user" && role !== "system",
    ),
    lastMessageId: ctx.messages.length > 0 ? ctx.messages.length - 1 : undefined,
    messageCount: ctx.messages.length,
    ...pickMacroVariables(variableSnapshot.global),
    ...pickMacroVariables(characterVariables),
  };
}

function parseMessageIdFromIframeName(iframeName: string): number {
  const normalizedName = iframeName.trim();
  const matched = normalizedName.match(/^TH-message--(\d+)--\d+$/);
  if (!matched) {
    throw new Error(`getMessageId 无法从 iframe 名称解析消息 id: ${iframeName}`);
  }

  const parsed = Number(matched[1]);
  if (!Number.isFinite(parsed)) {
    throw new Error(`getMessageId 解析失败: ${iframeName}`);
  }
  return parsed;
}

export const compatHandlers: ApiHandlerMap = {
  "isAdmin": (): boolean => false,

  "getTavernHelperExtensionId": (): string => DEFAULT_EXTENSION_ID,

  "getExtensionType": (args: unknown[]): "local" | "global" | "system" | null => {
    const extensionId = parseExtensionId(args, "getExtensionType");
    return getHostExtensionType(extensionId);
  },

  "getExtensionStatus": (args: unknown[]): ExtensionInstallationInfo | null => {
    const extensionId = parseExtensionId(args, "getExtensionStatus");
    const extensionType = getHostExtensionType(extensionId);
    if (!extensionType) {
      return null;
    }

    return {
      current_branch_name: "host-mode",
      current_commit_hash: getFrontendVersionValue(),
      is_up_to_date: true,
      remote_url: `dreamministage://extensions/${extensionId}`,
    };
  },

  "isInstalledExtension": (args: unknown[]): boolean => {
    const extensionId = parseExtensionId(args, "isInstalledExtension");
    return getHostExtensionType(extensionId) !== null;
  },

  "installExtension": (): never => {
    throw new Error("installExtension is not supported in DreamMiniStage host mode");
  },

  "uninstallExtension": (): never => {
    throw new Error("uninstallExtension is not supported in DreamMiniStage host mode");
  },

  "reinstallExtension": (): never => {
    throw new Error("reinstallExtension is not supported in DreamMiniStage host mode");
  },

  "updateExtension": (): never => {
    throw new Error("updateExtension is not supported in DreamMiniStage host mode");
  },

  "getAllEnabledScriptButtons": (_args: unknown[], ctx: ApiCallContext): Record<string, Array<{
    button_id: string;
    button_name: string;
  }>> => {
    const grouped: Record<string, Array<{ button_id: string; button_name: string }>> = {};
    const buttons = getScriptButtons({
      characterId: ctx.characterId,
      presetId: ctx.presetName,
    });

    for (const button of buttons) {
      grouped[button.scriptId] ||= [];
      grouped[button.scriptId].push({
        button_id: button.id,
        button_name: button.label,
      });
    }

    return grouped;
  },

  "importRawPreset": async (args: unknown[]): Promise<boolean> => {
    const { name, content } = ensureArgsShape(args, "importRawPreset");
    const jsonContent = typeof content === "string"
      ? content
      : JSON.stringify(content ?? {});
    const result = await importPresetFromJson(jsonContent, name);

    if (!result.success) {
      throw new Error(result.error || "importRawPreset failed");
    }

    return true;
  },

  "importRawWorldbook": async (args: unknown[], ctx: ApiCallContext): Promise<boolean> => {
    if (!ctx.characterId) {
      throw new Error("importRawWorldbook requires characterId");
    }

    const { content } = ensureArgsShape(args, "importRawWorldbook");
    const parsed = parseStructuredContent(content, "importRawWorldbook");
    const result = await importWorldBookFromJson(ctx.characterId, parsed);

    if (!result.success) {
      throw new Error(result.message || "importRawWorldbook failed");
    }

    return true;
  },

  "importRawTavernRegex": async (args: unknown[], ctx: ApiCallContext): Promise<boolean> => {
    if (!ctx.characterId) {
      throw new Error("importRawTavernRegex requires characterId");
    }

    const { name, content } = ensureArgsShape(args, "importRawTavernRegex");
    const parsed = parseStructuredContent(content, "importRawTavernRegex");

    if (!canImportRegexScripts(parsed)) {
      throw new Error("importRawTavernRegex received unsupported payload");
    }

    const scripts = importRegexScripts(parsed).map((script, index) => ({
      ...script,
      scriptName: script.scriptName || name || `imported_regex_${index + 1}`,
    }));

    const updated = await RegexScriptOperations.updateRegexScripts(ctx.characterId, scripts);
    if (!updated) {
      throw new Error("importRawTavernRegex failed to persist scripts");
    }

    return true;
  },

  "importRawChat": async (args: unknown[], ctx: ApiCallContext): Promise<boolean> => {
    if (!ctx.characterId || !ctx.dialogueId) {
      throw new Error("importRawChat requires characterId and dialogueId");
    }

    const { content } = ensureArgsShape(args, "importRawChat");
    if (typeof content !== "string") {
      throw new Error("importRawChat requires JSONL string content");
    }

    await importDialogueJsonl({
      dialogueId: ctx.dialogueId,
      characterId: ctx.characterId,
      jsonlText: content,
    });

    return true;
  },

  "importRawCharacter": (_args: unknown[]): never => {
    throw new Error(
      "importRawCharacter requires binary PNG upload and is not supported via Script Bridge API_CALL",
    );
  },

  "getTavernHelperVersion": (): string => getFrontendVersionValue(),

  "getFrontendVersion": (): string => getFrontendVersionValue(),

  "updateTavernHelper": (): never => {
    throw new Error("updateTavernHelper is not supported in DreamMiniStage host mode");
  },

  "updateFrontendVersion": (): never => {
    throw new Error("updateFrontendVersion is not supported in DreamMiniStage host mode");
  },

  "getTavernVersion": (): string => `DreamMiniStage/${getFrontendVersionValue()}`,
  ...compatDisplayedMessageHandlers,
  ...compatRegexHandlers,

  "substitudeMacros": (args: unknown[], ctx: ApiCallContext): string => {
    const [text] = args as [unknown];
    if (typeof text !== "string") {
      throw new Error("substitudeMacros requires text string");
    }

    const macroEnv = buildMacroEnv(ctx);
    return createMacroEvaluator().evaluate(text, macroEnv);
  },

  "getLastMessageId": (_args: unknown[], ctx: ApiCallContext): number | null => {
    if (ctx.messages.length === 0) {
      return null;
    }

    return ctx.messages.length - 1;
  },

  "getMessageId": (args: unknown[]): number => {
    const [iframeName] = args as [unknown];
    if (typeof iframeName !== "string" || iframeName.trim().length === 0) {
      throw new Error("getMessageId requires iframe name");
    }

    return parseMessageIdFromIframeName(iframeName);
  },
};
