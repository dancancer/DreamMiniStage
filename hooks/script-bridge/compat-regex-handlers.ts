/**
 * @input  hooks/script-bridge/types, lib/core/regex-processor, lib/data/roleplay/regex-script-operation
 * @output compatRegexHandlers
 * @pos    JS-Slash-Runner regex 兼容 API（format/get/enabled/replace）
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

function parseRegexReplaceScope(rawValue: unknown): TavernRegexScope {
  const scope = rawValue ?? "all";
  if (scope === "all" || scope === "global" || scope === "character") {
    return scope;
  }
  throw new Error("replaceTavernRegexes scope must be all|global|character");
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

function parseDepthValue(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`replaceTavernRegexes ${fieldName} must be number|null`);
  }
  return value;
}

function parseBooleanField(
  value: unknown,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== "boolean") {
    throw new Error("replaceTavernRegexes boolean fields must be boolean");
  }
  return value;
}

function parseSourceMap(value: unknown): Record<TavernRegexSource, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("replaceTavernRegexes source must be object");
  }

  const raw = value as Record<string, unknown>;
  return {
    user_input: parseBooleanField(raw.user_input, false),
    ai_output: parseBooleanField(raw.ai_output, false),
    slash_command: parseBooleanField(raw.slash_command, false),
    world_info: parseBooleanField(raw.world_info, false),
    reasoning: parseBooleanField(raw.reasoning, false),
  };
}

function parseDestinationMap(value: unknown): Record<TavernRegexDestination, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("replaceTavernRegexes destination must be object");
  }

  const raw = value as Record<string, unknown>;
  return {
    display: parseBooleanField(raw.display, false),
    prompt: parseBooleanField(raw.prompt, false),
  };
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

function parseTavernRegexInput(rawValue: unknown, index: number): TavernRegex {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    throw new Error(`replaceTavernRegexes regexes[${index}] must be object`);
  }

  const raw = rawValue as Record<string, unknown>;
  const id = typeof raw.id === "string" && raw.id.trim().length > 0
    ? raw.id.trim()
    : `regex_${index}`;
  const scriptName = typeof raw.script_name === "string" && raw.script_name.trim().length > 0
    ? raw.script_name.trim()
    : `未命名-${id}`;
  const findRegex = typeof raw.find_regex === "string" && raw.find_regex.length > 0
    ? raw.find_regex
    : null;
  if (!findRegex) {
    throw new Error(`replaceTavernRegexes regexes[${index}].find_regex must be non-empty string`);
  }

  const scope = raw.scope;
  if (scope !== "global" && scope !== "character") {
    throw new Error(`replaceTavernRegexes regexes[${index}].scope must be global|character`);
  }

  const replaceString = typeof raw.replace_string === "string"
    ? raw.replace_string
    : "";

  return {
    id,
    script_name: scriptName,
    enabled: parseBooleanField(raw.enabled, true),
    run_on_edit: parseBooleanField(raw.run_on_edit, false),
    scope,
    find_regex: findRegex,
    replace_string: replaceString,
    source: parseSourceMap(raw.source),
    destination: parseDestinationMap(raw.destination),
    min_depth: parseDepthValue(raw.min_depth, "min_depth"),
    max_depth: parseDepthValue(raw.max_depth, "max_depth"),
  };
}

function toRegexScriptPlacement(source: Record<TavernRegexSource, boolean>): ProcessorRegexPlacement[] {
  const placement: ProcessorRegexPlacement[] = [];
  if (source.user_input) {
    placement.push(ProcessorRegexPlacement.USER_INPUT);
  }
  if (source.ai_output) {
    placement.push(ProcessorRegexPlacement.AI_OUTPUT);
  }
  if (source.slash_command) {
    placement.push(ProcessorRegexPlacement.SLASH_COMMAND);
  }
  if (source.world_info) {
    placement.push(ProcessorRegexPlacement.WORLD_INFO);
  }
  if (source.reasoning) {
    placement.push(ProcessorRegexPlacement.REASONING);
  }
  return placement;
}

function toRegexScript(
  regex: TavernRegex,
  ownerId: string,
): RegexScript {
  return {
    id: regex.id,
    scriptKey: regex.id,
    scriptName: regex.script_name,
    findRegex: regex.find_regex,
    replaceString: regex.replace_string,
    trimStrings: [],
    placement: toRegexScriptPlacement(regex.source),
    disabled: !regex.enabled,
    runOnEdit: regex.run_on_edit,
    minDepth: regex.min_depth === null ? undefined : regex.min_depth,
    maxDepth: regex.max_depth === null ? undefined : regex.max_depth,
    markdownOnly: regex.destination.display,
    promptOnly: regex.destination.prompt,
    source: regex.scope === "global" ? ScriptSource.GLOBAL : ScriptSource.CHARACTER,
    sourceId: ownerId,
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

  "replaceTavernRegexes": async (args: unknown[], ctx: ApiCallContext): Promise<void> => {
    const [rawRegexes, rawOptions] = args;
    if (!Array.isArray(rawRegexes)) {
      throw new Error("replaceTavernRegexes requires regex array");
    }

    const options = parseOptionsArg(rawOptions, "replaceTavernRegexes");
    const scope = parseRegexReplaceScope(options.scope);
    const regexes = rawRegexes.map((item, index) => parseTavernRegexInput(item, index));
    const globalRegexes = regexes.filter((regex) => regex.scope === "global");
    const characterRegexes = regexes.filter((regex) => regex.scope === "character");

    if (scope === "global" && characterRegexes.length > 0) {
      throw new Error("replaceTavernRegexes scope=global only accepts global regex entries");
    }

    if (scope === "character" && globalRegexes.length > 0) {
      throw new Error("replaceTavernRegexes scope=character only accepts character regex entries");
    }

    const tasks: Array<Promise<boolean>> = [];

    if (scope === "all" || scope === "global") {
      const selected = scope === "all" ? globalRegexes : regexes;
      tasks.push(
        RegexScriptOperations.updateRegexScripts(
          ScriptSource.GLOBAL,
          selected.map((regex) => toRegexScript(regex, ScriptSource.GLOBAL)),
        ),
      );
    }

    if (scope === "all" || scope === "character") {
      const characterId = ctx.characterId;
      if (!characterId) {
        throw new Error("replaceTavernRegexes scope=character requires characterId");
      }
      const selected = scope === "all" ? characterRegexes : regexes;
      tasks.push(
        RegexScriptOperations.updateRegexScripts(
          characterId,
          selected.map((regex) => toRegexScript(regex, characterId)),
        ),
      );
    }

    const results = await Promise.all(tasks);
    if (results.some((saved) => !saved)) {
      throw new Error("replaceTavernRegexes failed to persist regex scripts");
    }
  },
};
