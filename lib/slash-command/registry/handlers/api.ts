/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      API Command Handlers                                 ║
 * ║                                                                           ║
 * ║  API 命令 - api / api-url / server                                        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";

type ApiSource = "openai" | "ollama" | "gemini";

const API_SOURCE_ALIASES: Record<string, ApiSource> = {
  openai: "openai",
  custom: "openai",
  zai: "openai",
  gemini: "gemini",
  ollama: "ollama",
  kobold: "ollama",
  textgenerationwebui: "ollama",
};

const API_URL_STORAGE_KEYS: Record<ApiSource, string> = {
  openai: "openaiBaseUrl",
  ollama: "ollamaBaseUrl",
  gemini: "geminiBaseUrl",
};

const API_URL_FALLBACKS: Record<ApiSource, string> = {
  openai: process.env.NEXT_PUBLIC_OPENAI_BASE_URL || "https://api.openai.com/v1",
  ollama: process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || "http://localhost:11434",
  gemini: process.env.NEXT_PUBLIC_GEMINI_API_BASE_URL || "",
};

function normalizeApiSource(raw: string | undefined, commandName: string): ApiSource {
  const normalized = (raw || "").trim().toLowerCase();
  const mapped = API_SOURCE_ALIASES[normalized];
  if (!mapped) {
    throw new Error(`${commandName} unsupported api source: ${raw || ""}`);
  }
  return mapped;
}

function readLocalStorage(key: string): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value === null ? undefined : value;
  } catch {
    return undefined;
  }
}

async function resolveCurrentApiSource(
  ctx: Parameters<CommandHandler>[2],
  commandName: string,
): Promise<ApiSource> {
  if (ctx.getApiSource) {
    const fromContext = await ctx.getApiSource();
    if (!fromContext) {
      throw new Error(`${commandName} api source is not available`);
    }
    return normalizeApiSource(fromContext, commandName);
  }

  const fromStorage = readLocalStorage("llmType");
  return fromStorage ? normalizeApiSource(fromStorage, commandName) : "openai";
}

async function resolveApiUrl(
  ctx: Parameters<CommandHandler>[2],
  source: ApiSource,
  commandName: string,
): Promise<string> {
  if (ctx.getApiUrl) {
    const fromContext = await ctx.getApiUrl(source);
    if (fromContext === undefined) {
      throw new Error(`${commandName} api url is not available`);
    }
    if (typeof fromContext !== "string") {
      throw new Error(`${commandName} api url must be a string`);
    }
    return fromContext;
  }

  const fromStorage = readLocalStorage(API_URL_STORAGE_KEYS[source]);
  if (typeof fromStorage === "string" && fromStorage.trim()) {
    return fromStorage;
  }
  return API_URL_FALLBACKS[source];
}

/** /api - 获取当前 API 类型（当前宿主仅支持只读） */
export const handleApi: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  const requested = (args.join(" ") || pipe || "").trim();
  if (requested) {
    throw new Error("/api set is not supported in host mode");
  }

  return resolveCurrentApiSource(ctx, "/api");
};

/** /api-url [api=...] - 获取 API URL（当前宿主仅支持只读） */
export const handleApiUrl: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const requestedUrl = (args.join(" ") || pipe || "").trim();
  if (requestedUrl) {
    throw new Error("/api-url set is not supported in host mode");
  }

  const source = namedArgs.api
    ? normalizeApiSource(namedArgs.api, "/api-url")
    : await resolveCurrentApiSource(ctx, "/api-url");

  return resolveApiUrl(ctx, source, "/api-url");
};
