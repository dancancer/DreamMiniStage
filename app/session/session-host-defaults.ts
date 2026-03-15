/**
 * @input  app/session/session-host-bridge, lib/store/model-store, lib/api/backends, lib/core/gemini-client, lib/storage/client-storage
 * @output SESSION_DEFAULT_TRANSLATE_PROVIDER, SESSION_DEFAULT_YOUTUBE_PROVIDER, createSessionDefaultHostBridge
 * @pos    /session 默认宿主能力实现
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Session Host Default Providers                       ║
 * ║                                                                           ║
 * ║  为 /session 提供内建默认宿主能力：translate / yt-script / clipboard，     ║
 * ║  以及 extension-state 的稳定读取路径；写能力继续显式交给外部宿主。         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { createApiClient } from "@/lib/api/backends";
import { callGeminiOnce } from "@/lib/core/gemini-client";
import { getString } from "@/lib/storage/client-storage";
import { useModelStore, type APIConfig } from "@/lib/store/model-store";
import type {
  TranslateTextOptions,
  YouTubeTranscriptOptions,
} from "@/lib/slash-command/types";
import type { SessionSlashHostBridge } from "@/app/session/session-host-bridge";

export const SESSION_DEFAULT_TRANSLATE_PROVIDER = "session-host" as const;
export const SESSION_DEFAULT_YOUTUBE_PROVIDER = "session-host" as const;
export const SESSION_NO_TRANSCRIPT_TOKEN = "__NO_TRANSCRIPT_AVAILABLE__" as const;

const SESSION_TRANSLATE_PROVIDER_ALIASES = new Set([
  SESSION_DEFAULT_TRANSLATE_PROVIDER,
  "default",
]);

const SESSION_JINA_READER_BASE_URL = "https://r.jina.ai/http://";
const SESSION_MODEL_MAX_TOKENS = 1200;
const SESSION_TRANSLATE_SYSTEM_PROMPT = "You are a translation engine. Translate the user text to the requested target language. Return only the translated text with no explanation.";
const SESSION_YOUTUBE_TRANSCRIPT_SYSTEM_PROMPT = "You extract only the spoken transcript or song lyrics from a YouTube reader page dump. Return only the transcript text. If the source does not contain a transcript or lyrics, return exactly __NO_TRANSCRIPT_AVAILABLE__.";

interface SessionDefaultHostBridgeOptions {
  language: "zh" | "en";
}

interface SessionHostPluginRegistryEntry {
  manifest?: {
    id?: string;
    name?: string;
  };
  enabled?: boolean;
}

interface SessionHostPluginRegistry {
  initialize?: () => Promise<void> | void;
  getPlugins?: () => unknown[];
}

function getActiveModelConfig(commandName: "/translate" | "/yt-script"): APIConfig {
  const state = useModelStore.getState();
  const active = state.getActiveConfig?.() || state.configs.find((config) => config.id === state.activeConfigId);
  if (!active) {
    throw new Error(`${commandName} default host requires an active model preset`);
  }
  return active;
}

function assertActiveModelConfig(config: APIConfig, commandName: "/translate" | "/yt-script"): void {
  if (config.type === "openai" && !config.apiKey?.trim()) {
    throw new Error(`${commandName} default host requires apiKey for active openai preset`);
  }
  if (config.type === "gemini" && !config.apiKey?.trim()) {
    throw new Error(`${commandName} default host requires apiKey for active gemini preset`);
  }
}

async function callActiveModelTextOnce(input: {
  commandName: "/translate" | "/yt-script";
  system: string;
  user: string;
}): Promise<string> {
  const config = getActiveModelConfig(input.commandName);
  assertActiveModelConfig(config, input.commandName);

  const result = config.type === "gemini"
    ? await callGeminiOnce({
      system: input.system,
      user: input.user,
      config: {
        apiKey: config.apiKey || "",
        model: config.model,
        baseUrl: config.baseUrl,
        temperature: 0.1,
        maxTokens: SESSION_MODEL_MAX_TOKENS,
      },
    })
    : await createApiClient({
      type: config.type,
      apiKey: config.apiKey,
      apiUrl: config.baseUrl,
    }).chat({
      model: config.model,
      temperature: 0.1,
      max_tokens: SESSION_MODEL_MAX_TOKENS,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }).then((response) => response.content);

  const normalized = result.trim();
  if (!normalized) {
    throw new Error(`${input.commandName} default host returned empty result`);
  }
  return normalized;
}

function assertTranslateProvider(provider?: string): void {
  const normalized = provider?.trim();
  if (!normalized || SESSION_TRANSLATE_PROVIDER_ALIASES.has(normalized)) {
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

function normalizeYouTubeTarget(urlOrId: string): string {
  const trimmed = urlOrId.trim();
  if (!trimmed) {
    throw new Error("/yt-script requires a YouTube url or id");
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const videoId = parsed.pathname.replace(/^\//, "").trim();
      if (!videoId) {
        throw new Error("/yt-script requires a valid YouTube short url");
      }
      return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    }

    if (host.endsWith("youtube.com")) {
      if (parsed.pathname === "/watch") {
        const videoId = parsed.searchParams.get("v")?.trim();
        if (!videoId) {
          throw new Error("/yt-script requires a valid YouTube watch url");
        }
        return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
      }

      if (parsed.pathname.startsWith("/shorts/")) {
        const videoId = parsed.pathname.split("/")[2]?.trim();
        if (!videoId) {
          throw new Error("/yt-script requires a valid YouTube shorts url");
        }
        return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
      }

      throw new Error("/yt-script requires a YouTube url or id");
    }

    throw new Error("/yt-script requires a YouTube url or id");
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error;
    }
    return `https://www.youtube.com/watch?v=${encodeURIComponent(trimmed)}`;
  }
}

function resolveYouTubeReaderLanguage(lang: string | undefined, language: "zh" | "en"): string {
  const normalized = lang?.trim();
  if (normalized) {
    return normalized;
  }
  return language === "zh" ? "zh-CN" : "en";
}

function getJinaApiKey(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_JINA_API_KEY || "";
  }
  return getString("jinaApiKey") || process.env.NEXT_PUBLIC_JINA_API_KEY || "";
}

function normalizeExtensionToken(value: string): string {
  return value.trim().toLowerCase();
}

function resolveSessionPluginRegistry(): SessionHostPluginRegistry | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const registry = (window as Window & { pluginRegistry?: unknown }).pluginRegistry;
  if (!registry || typeof registry !== "object") {
    return undefined;
  }
  return registry as SessionHostPluginRegistry;
}

async function readSessionPluginEntries(): Promise<SessionHostPluginRegistryEntry[]> {
  const registry = resolveSessionPluginRegistry();
  if (!registry) {
    throw new Error("/extension-state default host plugin registry is not available");
  }

  await Promise.resolve(registry.initialize?.());
  const entries = registry.getPlugins?.();
  if (!Array.isArray(entries)) {
    throw new Error("/extension-state default host plugin registry getPlugins is not available");
  }

  return entries as SessionHostPluginRegistryEntry[];
}

function findSessionPluginEntry(
  entries: SessionHostPluginRegistryEntry[],
  extensionName: string,
): SessionHostPluginRegistryEntry | undefined {
  const target = normalizeExtensionToken(extensionName);
  return entries.find((entry) => {
    const id = typeof entry.manifest?.id === "string"
      ? normalizeExtensionToken(entry.manifest.id)
      : "";
    const name = typeof entry.manifest?.name === "string"
      ? normalizeExtensionToken(entry.manifest.name)
      : "";
    return id === target || name === target;
  });
}

async function readClipboardText(): Promise<string> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
    throw new Error("/clipboard-get default host clipboard api is not available");
  }

  const text = await navigator.clipboard.readText();
  if (typeof text !== "string") {
    throw new Error("/clipboard-get default host returned non-string clipboard text");
  }
  return text;
}

async function writeClipboardText(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("/clipboard-set default host clipboard api is not available");
  }

  await navigator.clipboard.writeText(text);
}

async function isExtensionInstalled(extensionName: string): Promise<boolean> {
  const entries = await readSessionPluginEntries();
  return !!findSessionPluginEntry(entries, extensionName);
}

async function getExtensionEnabledState(extensionName: string): Promise<boolean> {
  const entries = await readSessionPluginEntries();
  const entry = findSessionPluginEntry(entries, extensionName);
  if (!entry) {
    throw new Error(`/extension-state extension not installed: ${extensionName}`);
  }
  if (typeof entry.enabled !== "boolean") {
    throw new Error(`/extension-state host returned non-boolean enabled state: ${extensionName}`);
  }
  return entry.enabled;
}

function buildJinaReaderUrl(sourceUrl: string, lang: string): string {
  const joined = `${SESSION_JINA_READER_BASE_URL}${sourceUrl.replace(/^https?:\/\//, "")}`;
  const parsed = new URL(joined);
  parsed.searchParams.set("hl", lang);
  return parsed.toString();
}

async function fetchJinaReaderPage(sourceUrl: string, lang: string): Promise<string> {
  const readerUrl = buildJinaReaderUrl(sourceUrl, lang);
  const jinaApiKey = getJinaApiKey();
  const response = await fetch(readerUrl, {
    headers: jinaApiKey ? { Authorization: `Bearer ${jinaApiKey}` } : undefined,
  });

  if (!response.ok) {
    throw new Error(`/yt-script default host reader fetch failed: ${response.status}`);
  }

  const text = (await response.text()).trim();
  if (!text) {
    throw new Error("/yt-script default host reader returned empty content");
  }
  return text;
}

function pickYouTubeTranscriptExcerpt(readerText: string): string {
  const markers = ["Lyrics:", "\nTranscript\n", "\nTranscript\r\n"];
  const index = markers
    .map((marker) => readerText.indexOf(marker))
    .find((value) => value >= 0);
  const start = typeof index === "number" && index >= 0 ? index : 0;
  return readerText.slice(start, start + 12000).trim();
}

function buildYouTubeTranscriptUserPrompt(sourceUrl: string, lang: string, readerText: string): string {
  return [
    `Source URL: ${sourceUrl}`,
    `Preferred language: ${lang}`,
    "Reader dump:",
    pickYouTubeTranscriptExcerpt(readerText),
  ].join("\n\n");
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
  return callActiveModelTextOnce({
    commandName: "/translate",
    system: SESSION_TRANSLATE_SYSTEM_PROMPT,
    user: buildTranslateUserPrompt(trimmedText, target),
  });
}

async function runDefaultYouTubeTranscript(
  urlOrId: string,
  options: YouTubeTranscriptOptions | undefined,
  language: "zh" | "en",
): Promise<string> {
  const sourceUrl = normalizeYouTubeTarget(urlOrId);
  const preferredLanguage = resolveYouTubeReaderLanguage(options?.lang, language);
  const readerText = await fetchJinaReaderPage(sourceUrl, preferredLanguage);
  const transcript = await callActiveModelTextOnce({
    commandName: "/yt-script",
    system: SESSION_YOUTUBE_TRANSCRIPT_SYSTEM_PROMPT,
    user: buildYouTubeTranscriptUserPrompt(sourceUrl, preferredLanguage, readerText),
  });

  if (transcript === SESSION_NO_TRANSCRIPT_TOKEN) {
    throw new Error("/yt-script transcript not available from /session default host");
  }
  return transcript;
}

export function createSessionDefaultHostBridge(
  options: SessionDefaultHostBridgeOptions,
): SessionSlashHostBridge {
  return {
    translateText: (text, translateOptions) => runDefaultTranslate(text, translateOptions, options.language),
    getYouTubeTranscript: (urlOrId, transcriptOptions) =>
      runDefaultYouTubeTranscript(urlOrId, transcriptOptions, options.language),
    getClipboardText: () => readClipboardText(),
    setClipboardText: (text) => writeClipboardText(text),
    isExtensionInstalled: (extensionName) => isExtensionInstalled(extensionName),
    getExtensionEnabledState: (extensionName) => getExtensionEnabledState(extensionName),
  };
}

export function getSessionTranslatePromptSignature(): string {
  return SESSION_TRANSLATE_SYSTEM_PROMPT;
}

export function getSessionYouTubeTranscriptPromptSignature(): string {
  return SESSION_YOUTUBE_TRANSCRIPT_SYSTEM_PROMPT;
}
