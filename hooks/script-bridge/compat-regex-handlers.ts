/**
 * @input  hooks/script-bridge/types, lib/core/regex-processor, lib/data/roleplay/regex-script-operation
 * @output compatRegexHandlers
 * @pos    JS-Slash-Runner regex 兼容 API（format/get/enabled）
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import type { ApiCallContext, ApiHandlerMap } from "./types";
import { RegexPlacement as ProcessorRegexPlacement, RegexProcessor } from "@/lib/core/regex-processor";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";
import { ScriptSource, type RegexScript } from "@/lib/models/regex-script-model";
import type { MacroParams } from "@/lib/core/macro-substitutor";

type MacroPrimitive = string | number;
type TavernRegexScope = "all" | "global" | "character";
type TavernRegexEnableState = "all" | "enabled" | "disabled";
type TavernRegexSource = "user_input" | "ai_output" | "slash_command" | "world_info" | "reasoning";
type TavernRegexDestination = "display" | "prompt";

type TavernRegex = {
  id: string;
  script_name: string;
  enabled: boolean;
  run_on_edit: boolean;
  scope: "global" | "character";
  find_regex: string;
  replace_string: string;
  source: Record<TavernRegexSource, boolean>;
  destination: Record<TavernRegexDestination, boolean>;
  min_depth: number | null;
  max_depth: number | null;
};

const TAVERN_REGEX_SOURCE_TO_PLACEMENT: Record<TavernRegexSource, ProcessorRegexPlacement> = {
  user_input: ProcessorRegexPlacement.USER_INPUT,
  ai_output: ProcessorRegexPlacement.AI_OUTPUT,
  slash_command: ProcessorRegexPlacement.SLASH_COMMAND,
  world_info: ProcessorRegexPlacement.WORLD_INFO,
  reasoning: ProcessorRegexPlacement.REASONING,
};

function parseOptionsArg(value: unknown, apiName: string): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${apiName} requires options object`);
  }
  return value as Record<string, unknown>;
}

function parseRegexScope(rawValue: unknown, apiName: string): TavernRegexScope {
  const scope = rawValue ?? "all";
  if (scope === "all" || scope === "global" || scope === "character") {
    return scope;
  }
  throw new Error(`${apiName} scope must be all|global|character`);
}

function parseRegexEnableState(rawValue: unknown, apiName: string): TavernRegexEnableState {
  const state = rawValue ?? "all";
  if (state === "all" || state === "enabled" || state === "disabled") {
    return state;
  }
  throw new Error(`${apiName} enable_state must be all|enabled|disabled`);
}

function parseRegexSource(rawValue: unknown): TavernRegexSource {
  if (
    rawValue === "user_input" ||
    rawValue === "ai_output" ||
    rawValue === "slash_command" ||
    rawValue === "world_info" ||
    rawValue === "reasoning"
  ) {
    return rawValue;
  }
  throw new Error("formatAsTavernRegexedString source is invalid");
}

function parseRegexDestination(rawValue: unknown): TavernRegexDestination {
  if (rawValue === "display" || rawValue === "prompt") {
    return rawValue;
  }
  throw new Error("formatAsTavernRegexedString destination must be display|prompt");
}

function toMacroPrimitive(value: unknown): MacroPrimitive | undefined {
  if (typeof value === "string" || typeof value === "number") {
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

function buildMacroParams(ctx: ApiCallContext): MacroParams {
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

function toTavernRegex(script: RegexScript): TavernRegex {
  const placement = script.placement || [];
  const scope = script.source === ScriptSource.GLOBAL ? "global" : "character";

  return {
    id: script.id || script.scriptKey,
    script_name: script.scriptName,
    enabled: !script.disabled,
    run_on_edit: !!script.runOnEdit,
    scope,
    find_regex: script.findRegex,
    replace_string: script.replaceString || "",
    source: {
      user_input: placement.includes(ProcessorRegexPlacement.USER_INPUT),
      ai_output: placement.includes(ProcessorRegexPlacement.AI_OUTPUT),
      slash_command: placement.includes(ProcessorRegexPlacement.SLASH_COMMAND),
      world_info: placement.includes(ProcessorRegexPlacement.WORLD_INFO),
      reasoning: placement.includes(ProcessorRegexPlacement.REASONING),
    },
    destination: {
      display: !!script.markdownOnly,
      prompt: !!script.promptOnly,
    },
    min_depth: typeof script.minDepth === "number" ? script.minDepth : null,
    max_depth: typeof script.maxDepth === "number" ? script.maxDepth : null,
  };
}

async function loadRegexScriptsByScope(
  scope: TavernRegexScope,
  ctx: ApiCallContext,
): Promise<RegexScript[]> {
  if (scope === "character") {
    if (!ctx.characterId) {
      throw new Error("getTavernRegexes scope=character requires characterId");
    }
    return RegexScriptOperations.getScriptsBySource(ScriptSource.CHARACTER, ctx.characterId);
  }

  const ownerId = ctx.characterId || "";
  const collected = await RegexScriptOperations.getAllScriptsForProcessing(ownerId, {
    includeGlobal: true,
  });

  if (scope === "global") {
    return collected.filter((script) => script.source === ScriptSource.GLOBAL);
  }

  return collected.filter((script) =>
    script.source === ScriptSource.GLOBAL || script.source === ScriptSource.CHARACTER,
  );
}

export const compatRegexHandlers: ApiHandlerMap = {
  "formatAsTavernRegexedString": async (args: unknown[], ctx: ApiCallContext): Promise<string> => {
    const [text, rawSource, rawDestination, rawOptions] = args;
    if (typeof text !== "string") {
      throw new Error("formatAsTavernRegexedString requires text string");
    }

    const source = parseRegexSource(rawSource);
    const destination = parseRegexDestination(rawDestination);
    const options = parseOptionsArg(rawOptions, "formatAsTavernRegexedString");
    const depth = typeof options.depth === "number" ? options.depth : undefined;
    const characterName = typeof options.character_name === "string" ? options.character_name : undefined;

    const result = await RegexProcessor.processFullContext(text, {
      ownerId: ctx.characterId || "",
      includeGlobal: true,
      placement: TAVERN_REGEX_SOURCE_TO_PLACEMENT[source],
      isMarkdown: destination === "display",
      isPrompt: destination === "prompt",
      depth,
      macroParams: {
        ...buildMacroParams(ctx),
        ...(characterName ? { char: characterName } : {}),
      },
    });

    return result.replacedText;
  },

  "isCharacterTavernRegexesEnabled": async (_args: unknown[], ctx: ApiCallContext): Promise<boolean> => {
    if (!ctx.characterId) {
      return false;
    }
    const settings = await RegexScriptOperations.getRegexScriptSettings(ctx.characterId);
    return settings.enabled;
  },

  "getTavernRegexes": async (args: unknown[], ctx: ApiCallContext): Promise<TavernRegex[]> => {
    const options = parseOptionsArg(args[0], "getTavernRegexes");
    const scope = parseRegexScope(options.scope, "getTavernRegexes");
    const enableState = parseRegexEnableState(
      options.enable_state ?? options.enableState,
      "getTavernRegexes",
    );

    const scripts = await loadRegexScriptsByScope(scope, ctx);

    return scripts
      .filter((script) => {
        if (enableState === "all") {
          return true;
        }
        return enableState === "enabled" ? !script.disabled : !!script.disabled;
      })
      .map(toTavernRegex);
  },
};
