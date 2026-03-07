/**
 * @input  app/session/session-host-bridge, lib/store/model-store, lib/api/backends, lib/core/gemini-client
 * @output SESSION_DEFAULT_TRANSLATE_PROVIDER, createSessionDefaultHostBridge
 * @pos    /session 默认宿主能力实现
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Session Host Default Providers                       ║
 * ║                                                                           ║
 * ║  为 /session 提供内建默认宿主能力；当前只内建 translate，yt-script 仍由      ║
 * ║  外部宿主注入，避免引入不可靠的 transcript 抓取实现。                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { createApiClient } from "@/lib/api/backends";
import { callGeminiOnce } from "@/lib/core/gemini-client";
import { useModelStore, type APIConfig } from "@/lib/store/model-store";
import type { TranslateTextOptions } from "@/lib/slash-command/types";
import type { SessionSlashHostBridge } from "@/app/session/session-host-bridge";

export const SESSION_DEFAULT_TRANSLATE_PROVIDER = "session-host" as const;

const SESSION_TRANSLATE_PROVIDER_ALIASES = new Set([
  SESSION_DEFAULT_TRANSLATE_PROVIDER,
  "default",
]);

const SESSION_TRANSLATE_SYSTEM_PROMPT = "You are a translation engine. Translate the user text to the requested target language. Return only the translated text with no explanation.";

interface SessionDefaultHostBridgeOptions {
  language: "zh" | "en";
}

function getActiveModelConfig(): APIConfig {
  const state = useModelStore.getState();
  const active = state.getActiveConfig?.() || state.configs.find((config) => config.id === state.activeConfigId);
  if (!active) {
    throw new Error("/translate default host requires an active model preset");
  }
  return active;
}

function assertTranslateProvider(provider?: string): void {
  const normalized = provider?.trim();
  if (!normalized) {
    return;
  }
  if (SESSION_TRANSLATE_PROVIDER_ALIASES.has(normalized)) {
    return;
  }
  throw new Error(`/translate provider not available in /session default host: ${normalized}`);
}

function resolveTranslateTarget(target: string | undefined, language: "zh" | "en"): string {
  const normalized = target?.trim();
  if (normalized) {
    return normalized;
  }
  return language === "zh" ? "zh" : "en";
}

function buildTranslateUserPrompt(text: string, target: string): string {
  return [
    `Target language: ${target}`,
    "Return only the translation.",
    text,
  ].join("\n\n");
}

async function translateWithGemini(config: APIConfig, text: string, target: string): Promise<string> {
  if (!config.apiKey?.trim()) {
    throw new Error("/translate default host requires apiKey for active gemini preset");
  }

  return callGeminiOnce({
    system: SESSION_TRANSLATE_SYSTEM_PROMPT,
    user: buildTranslateUserPrompt(text, target),
    config: {
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      temperature: 0.1,
      maxTokens: 1200,
    },
  });
}

async function translateWithChatBackend(config: APIConfig, text: string, target: string): Promise<string> {
  if (config.type === "openai" && !config.apiKey?.trim()) {
    throw new Error("/translate default host requires apiKey for active openai preset");
  }

  const client = createApiClient({
    type: config.type,
    apiKey: config.apiKey,
    apiUrl: config.baseUrl,
  });
  const response = await client.chat({
    model: config.model,
    temperature: 0.1,
    max_tokens: 1200,
    messages: [
      { role: "system", content: SESSION_TRANSLATE_SYSTEM_PROMPT },
      { role: "user", content: buildTranslateUserPrompt(text, target) },
    ],
  });

  return response.content;
}

async function runDefaultTranslate(
  text: string,
  options: TranslateTextOptions | undefined,
  language: "zh" | "en",
): Promise<string> {
  assertTranslateProvider(options?.provider);

  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error("/translate requires text");
  }

  const target = resolveTranslateTarget(options?.target, language);
  const config = getActiveModelConfig();

  const translated = config.type === "gemini"
    ? await translateWithGemini(config, trimmedText, target)
    : await translateWithChatBackend(config, trimmedText, target);

  const normalized = translated.trim();
  if (!normalized) {
    throw new Error("/translate default host returned empty result");
  }
  return normalized;
}

export function createSessionDefaultHostBridge(
  options: SessionDefaultHostBridgeOptions,
): SessionSlashHostBridge {
  return {
    translateText: (text, translateOptions) => runDefaultTranslate(text, translateOptions, options.language),
  };
}

export function getSessionTranslatePromptSignature(): string {
  return SESSION_TRANSLATE_SYSTEM_PROMPT;
}
