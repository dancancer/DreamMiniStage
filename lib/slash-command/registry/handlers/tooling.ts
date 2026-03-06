/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                     Tooling Command Handlers                              ║
 * ║                                                                           ║
 * ║  工具/标签命令：tools-list/tools-invoke/tag-*                             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import type { SlashToolDefinition, SlashToolRegistration } from "../../types";

type ToolListReturnType = "json" | "object" | "pipe" | "none";

function ensureHostCallback<T>(callback: T | undefined, commandName: string): T {
  if (!callback) {
    throw new Error(`/${commandName} is not available in current context`);
  }
  return callback;
}

function resolveCommandText(args: string[], pipe: string): string {
  return (args.join(" ") || pipe || "").trim();
}

function resolveToolListReturnType(raw: string | undefined): ToolListReturnType {
  const normalized = (raw || "object").trim().toLowerCase();
  if (
    normalized === "json" ||
    normalized === "object" ||
    normalized === "pipe" ||
    normalized === "none"
  ) {
    return normalized;
  }
  throw new Error(`/tool-list invalid return type: ${raw}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseToolParameters(raw: string | undefined): Record<string, unknown> {
  if (!raw || raw.trim().length === 0) {
    throw new Error("/tool-invoke requires parameters=<json>");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("/tool-invoke parameters must be a valid JSON object");
  }

  if (!isPlainObject(parsed)) {
    throw new Error("/tool-invoke parameters must be a JSON object");
  }
  return parsed;
}

function parseToolSchema(raw: string | undefined): SlashToolRegistration["parameters"] {
  if (!raw || raw.trim().length === 0) {
    throw new Error("/tools-register requires parameters=<json>");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("/tools-register parameters must be a valid JSON object");
  }

  if (!isPlainObject(parsed)) {
    throw new Error("/tools-register parameters must be a JSON object");
  }

  const type = typeof parsed.type === "string" ? parsed.type.trim().toLowerCase() : "object";
  if (type !== "object") {
    throw new Error("/tools-register parameters.type must be 'object'");
  }

  return {
    type: "object",
    properties: isPlainObject(parsed.properties)
      ? parsed.properties as SlashToolRegistration["parameters"]["properties"]
      : {},
    required: Array.isArray(parsed.required)
      ? parsed.required.map((item) => String(item))
      : undefined,
  };
}

function parseOptionalBoolean(raw: string | undefined, commandName: string, argName: string): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();
  if (["true", "1", "on", "yes"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "off", "no"].includes(normalized)) {
    return false;
  }
  throw new Error(`/${commandName} invalid ${argName} value: ${raw}`);
}

function extractActionBlock(commandName: string, invocationMeta?: { blocks?: Array<{ raw: string }> }): string {
  const raw = invocationMeta?.blocks?.[0]?.raw?.trim();
  if (!raw) {
    throw new Error(`/${commandName} requires closure block action`);
  }
  if (!raw.startsWith("{:") || !raw.endsWith(":}")) {
    throw new Error(`/${commandName} received invalid closure block`);
  }

  const body = raw.slice(2, -2).trim();
  if (!body) {
    throw new Error(`/${commandName} requires non-empty closure block action`);
  }
  return body;
}

function normalizeToolDefinitions(value: unknown): SlashToolDefinition[] {
  if (!Array.isArray(value)) {
    throw new Error("/tool-list host callback must return tool definitions");
  }

  return value.map((item) => {
    if (!isPlainObject(item)) {
      throw new Error("/tool-list host callback must return tool definitions");
    }

    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) {
      throw new Error("/tool-list host callback returned invalid tool name");
    }

    const description = typeof item.description === "string"
      ? item.description
      : "";
    const parameters = isPlainObject(item.parameters)
      ? item.parameters
      : { type: "object", properties: {} };
    if (parameters.type !== "object") {
      throw new Error("/tool-list host callback returned invalid tool parameters");
    }

    return {
      name,
      description,
      parameters: {
        type: "object" as const,
        properties: isPlainObject(parameters.properties)
          ? parameters.properties as SlashToolDefinition["parameters"]["properties"]
          : {},
        required: Array.isArray(parameters.required)
          ? parameters.required.map((item) => String(item))
          : undefined,
      },
    };
  });
}

function toOpenAIToolDefinition(tool: SlashToolDefinition): Record<string, unknown> {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

function stringifyToolList(
  tools: SlashToolDefinition[],
  returnType: ToolListReturnType,
): string {
  if (returnType === "none") {
    return "";
  }

  if (returnType === "pipe") {
    return tools.map((tool) => tool.name).join(", ");
  }

  return JSON.stringify(tools.map(toOpenAIToolDefinition));
}

function normalizeToolResult(result: unknown): string {
  if (result === undefined || result === null) {
    return "";
  }
  if (typeof result === "string") {
    return result;
  }
  if (typeof result === "number" || typeof result === "boolean") {
    return String(result);
  }
  return JSON.stringify(result);
}

function resolveTagTarget(namedArgs: Record<string, string>): { name?: string } {
  const name = (namedArgs.name || "").trim();
  return name ? { name } : {};
}

function resolveTagName(
  args: string[],
  pipe: string,
  commandName: "tag-add" | "tag-remove" | "tag-exists",
): string {
  const tagName = resolveCommandText(args, pipe);
  if (!tagName) {
    throw new Error(`/${commandName} requires tag name`);
  }
  return tagName;
}

function normalizeBooleanResult(
  value: unknown,
  commandName: "tag-add" | "tag-remove" | "tag-exists",
): string {
  if (typeof value !== "boolean") {
    throw new Error(`/${commandName} host callback must return boolean`);
  }
  return String(value);
}

function normalizeStringList(value: unknown, commandName: "tag-list"): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`/${commandName} host callback must return string[]`);
  }
  return value;
}

/** /tools-list|/tool-list - 列出当前已注册工具 */
export const handleToolList: CommandHandler = async (_args, namedArgs, ctx, _pipe) => {
  const callback = ensureHostCallback(ctx.listTools, "tool-list");
  const tools = normalizeToolDefinitions(await callback());
  return stringifyToolList(tools, resolveToolListReturnType(namedArgs.return));
};

/** /tools-invoke|/tool-invoke <name> parameters=<json> - 调用工具 */
export const handleToolInvoke: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.invokeTool, "tool-invoke");
  const toolName = resolveCommandText(args, pipe);
  if (!toolName) {
    throw new Error("/tool-invoke requires tool name");
  }

  const parameters = parseToolParameters(namedArgs.parameters);
  const result = await callback(toolName, parameters);
  return normalizeToolResult(result);
};

/** /tools-register|/tool-register {: ... :} - 注册脚本工具 */
export const handleToolRegister: CommandHandler = async (
  _args,
  namedArgs,
  ctx,
  _pipe,
  invocationMeta,
) => {
  const callback = ensureHostCallback(ctx.registerTool, "tools-register");
  const name = (namedArgs.name || "").trim();
  const description = (namedArgs.description || "").trim();
  if (!name) {
    throw new Error("/tools-register requires name=<tool-name>");
  }
  if (!description) {
    throw new Error("/tools-register requires description=<text>");
  }

  const registered = await callback({
    name,
    description,
    parameters: parseToolSchema(namedArgs.parameters),
    action: extractActionBlock("tools-register", invocationMeta),
    displayName: (namedArgs.displayName || namedArgs.displayname || "").trim() || undefined,
    formatMessage: (namedArgs.formatMessage || namedArgs.formatmessage || "").trim() || undefined,
    shouldRegister: parseOptionalBoolean(namedArgs.shouldRegister || namedArgs.shouldregister, "tools-register", "shouldRegister"),
    stealth: parseOptionalBoolean(namedArgs.stealth, "tools-register", "stealth"),
  });
  if (typeof registered !== "boolean") {
    throw new Error("/tools-register host callback must return boolean");
  }
  return String(registered);
};

/** /tools-unregister|/tool-unregister <name> - 注销脚本工具 */
export const handleToolUnregister: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.unregisterTool, "tools-unregister");
  const name = resolveCommandText(args, pipe);
  if (!name) {
    throw new Error("/tools-unregister requires tool name");
  }

  const removed = await callback(name);
  if (typeof removed !== "boolean") {
    throw new Error("/tools-unregister host callback must return boolean");
  }
  return String(removed);
};

/** /tag-add <tag> - 为角色追加标签 */
export const handleTagAdd: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.addCharacterTag, "tag-add");
  const result = await callback(resolveTagName(args, pipe, "tag-add"), resolveTagTarget(namedArgs));
  return normalizeBooleanResult(result, "tag-add");
};

/** /tag-remove <tag> - 从角色移除标签 */
export const handleTagRemove: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.removeCharacterTag, "tag-remove");
  const result = await callback(resolveTagName(args, pipe, "tag-remove"), resolveTagTarget(namedArgs));
  return normalizeBooleanResult(result, "tag-remove");
};

/** /tag-exists <tag> - 检查角色是否含有标签 */
export const handleTagExists: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.hasCharacterTag, "tag-exists");
  const result = await callback(resolveTagName(args, pipe, "tag-exists"), resolveTagTarget(namedArgs));
  return normalizeBooleanResult(result, "tag-exists");
};

/** /tag-list - 返回角色标签列表 */
export const handleTagList: CommandHandler = async (_args, namedArgs, ctx, _pipe) => {
  const callback = ensureHostCallback(ctx.listCharacterTags, "tag-list");
  const tags = normalizeStringList(await callback(resolveTagTarget(namedArgs)), "tag-list");
  return tags.join(", ");
};
