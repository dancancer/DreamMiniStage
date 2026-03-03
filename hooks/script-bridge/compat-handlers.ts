/**
 * @input  hooks/script-bridge/types, function/*, lib/script-runner/script-storage
 * @output compatHandlers
 * @pos    JS-Slash-Runner 高价值兼容 API（import_raw / script buttons / version）
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       Script Bridge Compatibility Handlers                ║
 * ║                                                                           ║
 * ║  目标：补齐迁移高频 API，统一走 Script Bridge 单路径                           ║
 * ║  覆盖：import_raw / getAllEnabledScriptButtons / version 相关接口         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiCallContext, ApiHandlerMap } from "./types";
import { importPresetFromJson } from "@/function/preset/import";
import { importWorldBookFromJson } from "@/function/worldbook/import";
import { importDialogueJsonl } from "@/function/dialogue/jsonl";
import { canImportRegexScripts, importRegexScripts } from "@/lib/adapters/import";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";
import { getScriptButtons } from "@/lib/script-runner/script-storage";

const DEFAULT_FRONTEND_VERSION = "0.1.0";

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

export const compatHandlers: ApiHandlerMap = {
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
};

