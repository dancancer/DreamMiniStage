#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import {
  analyzeNoiseBaseline,
  artifactPaths,
  buildReplayRunIndex,
  buildPayload,
  renderReplayRunIndexMarkdown,
  renderNoiseReportMarkdown,
  renderSummaryMarkdown,
  seedIndexedDb,
} from "./p4-session-replay-lib.mjs";

// ============================================================================
// P4 /session Replay（round7 + round8 + round9 + round10 + round11 + round12）
// 目标：单命令复验 slash 直达、刷新持久化、会话隔离、401 失败链路、
//       高价值 slash 宿主 wiring（floor-teleport/proxy/yt-script/translate），
//       以及 provider 未注入 / proxy bad preset 的显式 fail-fast。
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const BASE_URL = process.env.P4_BASE_URL || "http://127.0.0.1:3303";
const HEADLESS = process.env.P4_HEADLESS !== "false";
const RUN_ID = process.env.P4_RUN_ID || `p4r15-${Date.now()}`;
const ARTIFACT_ROOT = path.resolve(
  REPO_ROOT,
  process.env.P4_ARTIFACT_ROOT || "docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts",
);
const RUN_DIR = path.join(ARTIFACT_ROOT, `p4-session-replay-${RUN_ID}`);
const NOISE_BASELINE_PATH = path.resolve(
  REPO_ROOT,
  process.env.P4_NOISE_BASELINE_PATH || "docs/plan/2026-03-03-sillytavern-gap-reduction/p4-session-replay-noise-baseline.json",
);
const RUN_INDEX_JSON_PATH = path.resolve(
  REPO_ROOT,
  process.env.P4_RUN_INDEX_JSON_PATH || "docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-run-index.json",
);
const RUN_INDEX_MD_PATH = path.resolve(
  REPO_ROOT,
  process.env.P4_RUN_INDEX_MD_PATH || "docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-run-index.md",
);
const STALE_RULE_MISS_THRESHOLD = Number.parseInt(process.env.P4_STALE_RULE_MISS_THRESHOLD || "3", 10);
const RUN_INDEX_MAX_RUNS = Number.parseInt(process.env.P4_RUN_INDEX_MAX_RUNS || "60", 10);
const CHECK_TIMEOUT_MS = 25_000;
const ROUND9_YT_TARGET = "https://youtu.be/dQw4w9WgXcQ";
const ROUND9_YT_LANG = "ja";
const ROUND9_TRANSCRIPT_SAMPLE = "P4 Round10 Transcript Line 1\nP4 Round10 Transcript Line 2";
const ROUND10_TRANSLATE_TEXT = "P4 Round10 Translate Input";
const ROUND10_TRANSLATE_TARGET = "zh";
const ROUND10_TRANSLATE_PROVIDER = "session-host";
const ROUND10_TRANSLATE_SAMPLE = "P4 Round10 Translate Output";
const ROUND11_TRANSLATE_TEXT = "P4 Round11 Translate FailFast";
const ROUND11_TRANSLATE_PROVIDER = "mocker";
const ROUND11_YT_TARGET = "https://youtu.be/invalidvideo1";
const ROUND11_YT_CANONICAL_URL = "https://www.youtube.com/watch?v=invalidvideo1";
const ROUND9_YT_CANONICAL_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const SESSION_YOUTUBE_TRANSCRIPT_SYSTEM_PROMPT = "You extract only the spoken transcript or song lyrics from a YouTube reader page dump. Return only the transcript text. If the source does not contain a transcript or lyrics, return exactly __NO_TRANSCRIPT_AVAILABLE__.";
const SESSION_NO_TRANSCRIPT_TOKEN = "__NO_TRANSCRIPT_AVAILABLE__";
const ROUND12_PROXY_MISSING_PRESET = "missing-profile";
const ROUND9_PROXY_PRESETS = [
  {
    id: "cfg-default",
    name: "Default Proxy",
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    apiKey: "sk-default",
  },
  {
    id: "cfg-reverse",
    name: "Claude Reverse",
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    apiKey: "sk-reverse",
  },
];

const consoleLogs = [];
const networkLogs = [];
const consoleEvents = [];
const networkEvents = [];
const checkpoints = [];
const translationRequests = [];
const transcriptRequests = [];
const jinaReaderRequests = [];

function nowIso() {
  return new Date().toISOString();
}

function log(message) {
  console.log(`[p4-session-replay] ${message}`);
}

function addCheckpoint(name, passed, detail = {}) {
  checkpoints.push({ name, passed, detail, timestamp: nowIso() });
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function summarizeError(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerReady() {
  try {
    const response = await fetch(BASE_URL, {
      redirect: "manual",
      signal: AbortSignal.timeout(1200),
    });
    return response.ok || response.status === 307 || response.status === 308;
  } catch {
    return false;
  }
}

async function waitForServerReady(timeoutMs) {
  const started = Date.now();
  while (Date.now() - started <= timeoutMs) {
    if (await isServerReady()) return;
    await sleep(500);
  }
  throw new Error(`Dev server not ready within ${timeoutMs}ms: ${BASE_URL}`);
}

function startDevServer() {
  const child = spawn("pnpm", ["dev"], {
    cwd: REPO_ROOT,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) {
      console.log(`[p4-session-replay:dev] ${text}`);
    }
  });

  child.stderr.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) {
      console.error(`[p4-session-replay:dev:stderr] ${text}`);
    }
  });

  return child;
}

async function stopDevServer(child) {
  if (!child) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
    }, 4000);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });

    child.kill("SIGTERM");
  });
}

async function waitForText(page, text) {
  await page.waitForFunction(
    (target) => document.body?.innerText?.includes(target),
    text,
    { timeout: CHECK_TIMEOUT_MS },
  );
}

async function expectText(page, text, checkpointName) {
  await waitForText(page, text);
  addCheckpoint(checkpointName, true, { text });
}

async function submitInput(page, value) {
  const input = page.locator("#send_textarea");
  await input.waitFor({ state: "visible", timeout: CHECK_TIMEOUT_MS });
  await input.fill(value);
  await input.press("Enter");
}

async function writeText(filePath, content) {
  await writeFile(filePath, content, "utf8");
}

async function writeList(filePath, lines) {
  await writeText(filePath, `${lines.join("\n")}\n`);
}

async function loadNoiseBaseline(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.consoleRules) || !Array.isArray(parsed.networkRules)) {
      throw new Error("missing consoleRules/networkRules");
    }
    return parsed;
  } catch (error) {
    throw new Error(`[noise-baseline] failed to load ${filePath}: ${summarizeError(error)}`);
  }
}

async function readJsonFileOrDefault(filePath, defaultValue) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    const code = error && typeof error === "object" ? error.code : null;
    if (code === "ENOENT") return defaultValue;
    throw new Error(`[run-index] failed to read ${filePath}: ${summarizeError(error)}`);
  }
}

async function buildNoiseReport(files) {
  const baseline = await loadNoiseBaseline(NOISE_BASELINE_PATH);
  const report = analyzeNoiseBaseline({
    baseline,
    consoleEvents,
    networkEvents,
  });
  await writeText(files.noiseReportJson, `${JSON.stringify(report, null, 2)}\n`);
  await writeText(files.noiseReportMd, renderNoiseReportMarkdown(report, NOISE_BASELINE_PATH, REPO_ROOT));
  return report;
}

async function updateRunIndex(summary) {
  const previousIndex = await readJsonFileOrDefault(RUN_INDEX_JSON_PATH, {
    version: 1,
    runs: [],
    ruleHealth: { console: {}, network: {} },
    staleRules: { console: [], network: [] },
  });
  const nextIndex = buildReplayRunIndex({
    previousIndex,
    summary,
    staleMissThreshold: STALE_RULE_MISS_THRESHOLD,
    maxRuns: RUN_INDEX_MAX_RUNS,
    nowIso,
  });

  await mkdir(path.dirname(RUN_INDEX_JSON_PATH), { recursive: true });
  await writeText(RUN_INDEX_JSON_PATH, `${JSON.stringify(nextIndex, null, 2)}\n`);
  await writeText(RUN_INDEX_MD_PATH, renderReplayRunIndexMarkdown(nextIndex, REPO_ROOT));

  return {
    jsonPath: path.relative(REPO_ROOT, RUN_INDEX_JSON_PATH),
    markdownPath: path.relative(REPO_ROOT, RUN_INDEX_MD_PATH),
    staleRuleCount: nextIndex.staleRules.console.length + nextIndex.staleRules.network.length,
  };
}

async function runRound7(page, payload, files) {
  await page.goto(`${BASE_URL}/session?id=${encodeURIComponent(payload.ids.sessionAId)}`, { waitUntil: "domcontentloaded" });
  await expectText(page, "P4 Round10 Opening A", "round7-open-session-a");

  await submitInput(page, "/send P4 Round10 SlashPathMessage|/trigger");
  await expectText(page, "P4 Round10 SlashPathMessage", "round7-slash-direct");
  await page.screenshot({ path: files.round7Slash, fullPage: true });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expectText(page, "P4 Round10 SlashPathMessage", "round7-refresh-persistence");
  await page.screenshot({ path: files.round7Refresh, fullPage: true });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  const sessionBCard = page.locator("div[role='button']").filter({ hasText: "P4 Round10 Session B" }).first();
  await sessionBCard.waitFor({ state: "visible", timeout: CHECK_TIMEOUT_MS });
  await sessionBCard.click();

  await page.waitForURL((url) => url.searchParams.get("id") === payload.ids.sessionBId, { timeout: CHECK_TIMEOUT_MS });
  await expectText(page, "P4 Round10 Opening B", "round7-session-b-opened");

  const leaked = await page.locator("text=P4 Round10 SlashPathMessage").count();
  if (leaked > 0) throw new Error("Cross-session leakage: session-b contains session-a message");
  addCheckpoint("round7-session-isolation", true, { leakedCount: leaked });

  await page.screenshot({ path: files.round7Isolation, fullPage: true });
}

async function runRound8(page, payload, files) {
  await page.goto(`${BASE_URL}/session?id=${encodeURIComponent(payload.ids.sessionPlainId)}`, { waitUntil: "domcontentloaded" });
  await expectText(page, "P4 Round10 Opening Plain", "round8-open-session-plain");

  const consoleStart = consoleLogs.length;
  const networkStart = networkLogs.length;
  const response401 = page.waitForResponse((response) => response.url().includes("/v1/chat/completions"), {
    timeout: CHECK_TIMEOUT_MS,
  });

  await submitInput(page, "P4 Round10 Plain401 Message A3");
  const completionResponse = await response401;
  if (completionResponse.status() !== 401) {
    throw new Error(`Expected 401 from completion API, got ${completionResponse.status()}`);
  }
  addCheckpoint("round8-plain-input-401", true, { status: completionResponse.status() });

  await expectText(page, "P4 Round10 Plain401 Message A3", "round8-pre-refresh-message-visible");
  await writeList(files.round8PreConsole, consoleLogs.slice(consoleStart));
  await writeList(files.round8PreNetwork, networkLogs.slice(networkStart));

  await page.reload({ waitUntil: "domcontentloaded" });
  await expectText(page, "P4 Round10 Plain401 Message A3", "round8-refresh-persistence");
  await page.screenshot({ path: files.round8Refresh, fullPage: true });
}

async function resolveTeleportTargetIndex(page) {
  await page.waitForSelector("[data-session-message-index]", {
    state: "attached",
    timeout: CHECK_TIMEOUT_MS,
  });

  const teleportIndex = await page.evaluate(() => {
    const firstAnchor = document.querySelector("[data-session-message-index]");
    if (!(firstAnchor instanceof HTMLElement)) return null;
    const rawIndex = firstAnchor.dataset.sessionMessageIndex;
    if (!rawIndex) return null;
    const parsed = Number.parseInt(rawIndex, 10);
    return Number.isNaN(parsed) ? null : parsed;
  });

  if (!Number.isInteger(teleportIndex)) {
    throw new Error("Teleport target index is unavailable");
  }

  return teleportIndex;
}

async function installTeleportProbe(page, index) {
  const probeReady = await page.evaluate((targetIndex) => {
    const target = document.querySelector(`[data-session-message-index="${targetIndex}"]`);
    if (!(target instanceof HTMLElement)) return false;

    window.__p4TeleportProbe = {
      calls: [],
    };

    target.scrollIntoView = (...args) => {
      window.__p4TeleportProbe.calls.push(args);
    };
    return true;
  }, index);

  if (!probeReady) {
    throw new Error(`Teleport target not found for index=${index}`);
  }
}

async function expectTeleportTriggered(page, checkpointName) {
  const probeResult = await page.evaluate(() => {
    const probe = window.__p4TeleportProbe;
    if (!probe) return null;
    return {
      callCount: probe.calls.length,
      firstCall: probe.calls[0] || null,
    };
  });

  if (!probeResult) {
    throw new Error("Teleport probe is missing");
  }
  if (probeResult.callCount < 1) {
    throw new Error("Teleport probe captured no scrollIntoView call");
  }

  addCheckpoint(checkpointName, true, {
    callCount: probeResult.callCount,
    firstCall: probeResult.firstCall,
  });
}

async function seedProxyPresets(page) {
  await page.evaluate((configs) => {
    const payload = {
      state: {
        configs,
        activeConfigId: configs[0]?.id || "",
      },
      version: 0,
    };
    window.localStorage.setItem("model-config-storage", JSON.stringify(payload));
  }, ROUND9_PROXY_PRESETS);
}

async function readProxyStorageSnapshot(page) {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("model-config-storage");
    let parsed = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    return {
      activeConfigId: parsed?.state?.activeConfigId || null,
      llmType: window.localStorage.getItem("llmType"),
      modelName: window.localStorage.getItem("modelName"),
      modelBaseUrl: window.localStorage.getItem("modelBaseUrl"),
      openaiModel: window.localStorage.getItem("openaiModel"),
      openaiBaseUrl: window.localStorage.getItem("openaiBaseUrl"),
      openaiApiKey: window.localStorage.getItem("openaiApiKey"),
    };
  });
}

function assertProxyPresetSnapshot(snapshot, expectedPreset, mode) {
  if (snapshot.activeConfigId !== expectedPreset.id) {
    throw new Error(
      `Proxy preset ${mode} mismatch: expected active=${expectedPreset.id}, got=${snapshot.activeConfigId}`,
    );
  }
  if (snapshot.llmType !== expectedPreset.type) {
    throw new Error(
      `Proxy llmType mismatch: expected ${expectedPreset.type}, got ${snapshot.llmType}`,
    );
  }
  if (snapshot.openaiModel !== expectedPreset.model || snapshot.modelName !== expectedPreset.model) {
    throw new Error(
      `Proxy model mismatch: expected ${expectedPreset.model}, got openaiModel=${snapshot.openaiModel}, modelName=${snapshot.modelName}`,
    );
  }
  if (snapshot.openaiBaseUrl !== expectedPreset.baseUrl || snapshot.modelBaseUrl !== expectedPreset.baseUrl) {
    throw new Error(
      `Proxy baseUrl mismatch: expected ${expectedPreset.baseUrl}, got openaiBaseUrl=${snapshot.openaiBaseUrl}, modelBaseUrl=${snapshot.modelBaseUrl}`,
    );
  }
  if (snapshot.openaiApiKey !== expectedPreset.apiKey) {
    throw new Error(
      `Proxy apiKey mismatch: expected ${expectedPreset.apiKey}, got ${snapshot.openaiApiKey}`,
    );
  }
}

async function expectProxyPresetSwitched(page, expectedPreset) {
  await page.waitForFunction((expectedId) => {
    const raw = window.localStorage.getItem("model-config-storage");
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.state?.activeConfigId === expectedId;
    } catch {
      return false;
    }
  }, expectedPreset.id, { timeout: CHECK_TIMEOUT_MS });

  const snapshot = await readProxyStorageSnapshot(page);
  assertProxyPresetSnapshot(snapshot, expectedPreset, "switch");
  return snapshot;
}

async function expectProxyPresetUnchanged(page, expectedPreset, checkpointName) {
  const snapshot = await readProxyStorageSnapshot(page);
  assertProxyPresetSnapshot(snapshot, expectedPreset, "unchanged");
  addCheckpoint(checkpointName, true, {
    expectedPresetId: expectedPreset.id,
    snapshot,
  });
  return snapshot;
}

function parseYouTubeTranscriptRequestDetail(requestBody) {
  const messages = Array.isArray(requestBody?.messages) ? requestBody.messages : [];
  const systemPrompt = typeof messages[0]?.content === "string" ? messages[0].content : "";
  const userPrompt = typeof messages[1]?.content === "string" ? messages[1].content : "";
  const sourceMatch = userPrompt.match(/Source URL:\s*([^\n]+)/);
  const langMatch = userPrompt.match(/Preferred language:\s*([^\n]+)/);
  return {
    model: requestBody?.model || null,
    systemPrompt,
    userPrompt,
    sourceUrl: sourceMatch?.[1]?.trim() || null,
    preferredLanguage: langMatch?.[1]?.trim() || null,
  };
}

function isYouTubeTranscriptRequest(requestBody) {
  const detail = parseYouTubeTranscriptRequestDetail(requestBody);
  return detail.systemPrompt.includes(SESSION_YOUTUBE_TRANSCRIPT_SYSTEM_PROMPT);
}

async function expectDefaultYouTubeTranscriptTriggered(expectedUrl, expectedLang, checkpointName) {
  const started = Date.now();
  while (Date.now() - started <= CHECK_TIMEOUT_MS) {
    if (transcriptRequests.length > 0 && jinaReaderRequests.length > 0) {
      break;
    }
    await sleep(100);
  }

  const firstTranscriptRequest = transcriptRequests[0] || null;
  if (!firstTranscriptRequest) {
    throw new Error("default yt-script provider captured no model request");
  }
  if (firstTranscriptRequest.sourceUrl !== expectedUrl) {
    throw new Error(
      `yt-script source url mismatch: expected ${expectedUrl}, got ${firstTranscriptRequest.sourceUrl}`,
    );
  }
  if (firstTranscriptRequest.preferredLanguage !== expectedLang) {
    throw new Error(
      `yt-script preferred language mismatch: expected ${expectedLang}, got ${firstTranscriptRequest.preferredLanguage}`,
    );
  }

  const firstReaderRequest = jinaReaderRequests[0] || null;
  if (!firstReaderRequest) {
    throw new Error("default yt-script provider captured no reader request");
  }
  if (!firstReaderRequest.includes(encodeURIComponent(expectedUrl)) && !firstReaderRequest.includes(expectedUrl.replace(/^https?:\/\//, ""))) {
    throw new Error(`yt-script reader request mismatch: expected url containing ${expectedUrl}, got ${firstReaderRequest}`);
  }
  if (!firstReaderRequest.includes(`hl=${expectedLang}`)) {
    throw new Error(`yt-script reader language mismatch: expected hl=${expectedLang}, got ${firstReaderRequest}`);
  }

  addCheckpoint(checkpointName, true, {
    firstTranscriptRequest,
    firstReaderRequest,
  });
}

function parseTranslateRequestDetail(requestBody) {
  const messages = Array.isArray(requestBody?.messages) ? requestBody.messages : [];
  const systemPrompt = typeof messages[0]?.content === "string" ? messages[0].content : "";
  const userPrompt = typeof messages[1]?.content === "string" ? messages[1].content : "";
  const targetMatch = userPrompt.match(/Target language:\s*([^\n]+)/);
  const userParts = userPrompt.split(/\n\n/);
  return {
    model: requestBody?.model || null,
    systemPrompt,
    userPrompt,
    target: targetMatch?.[1]?.trim() || null,
    text: userParts.slice(2).join("\n\n").trim(),
  };
}

function isTranslateRequest(requestBody) {
  const detail = parseTranslateRequestDetail(requestBody);
  return detail.systemPrompt.includes("translation engine")
    && detail.text === ROUND10_TRANSLATE_TEXT;
}

async function expectDefaultTranslateTriggered(expectedText, expectedTarget, checkpointName) {
  const started = Date.now();
  while (Date.now() - started <= CHECK_TIMEOUT_MS) {
    if (translationRequests.length > 0) {
      break;
    }
    await sleep(100);
  }

  const firstRequest = translationRequests[0] || null;
  if (!firstRequest) {
    throw new Error("default translate provider captured no request");
  }

  if (firstRequest.text !== expectedText) {
    throw new Error(
      `translate text mismatch: expected ${expectedText}, got ${firstRequest.text}`,
    );
  }
  if (firstRequest.target !== expectedTarget) {
    throw new Error(
      `translate target mismatch: expected ${expectedTarget}, got ${firstRequest.target}`,
    );
  }

  addCheckpoint(checkpointName, true, {
    firstRequest,
  });
}

async function runRound9(page, payload, files) {
  await page.goto(`${BASE_URL}/session?id=${encodeURIComponent(payload.ids.sessionAId)}`, { waitUntil: "domcontentloaded" });
  await expectText(page, "P4 Round10 Opening A", "round9-open-session-a");

  const firstTeleportIndex = await resolveTeleportTargetIndex(page);
  await installTeleportProbe(page, firstTeleportIndex);
  await submitInput(page, `/floor-teleport ${firstTeleportIndex}`);
  await expectTeleportTriggered(page, "round9-floor-teleport-anchor");
  await page.screenshot({ path: files.round9Teleport, fullPage: true });

  await seedProxyPresets(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  const refreshedTeleportIndex = await resolveTeleportTargetIndex(page);
  await installTeleportProbe(page, refreshedTeleportIndex);
  await submitInput(page, `/floor-teleport ${refreshedTeleportIndex}`);
  await expectTeleportTriggered(page, "round9-floor-teleport-refresh");

  const proxyTarget = ROUND9_PROXY_PRESETS[1];
  await submitInput(page, `/proxy ${proxyTarget.name}`);
  const proxySnapshot = await expectProxyPresetSwitched(page, proxyTarget);
  addCheckpoint("round9-proxy-switch-success", true, {
    targetPresetId: proxyTarget.id,
    snapshot: proxySnapshot,
  });
  await page.screenshot({ path: files.round9ProxySwitch, fullPage: true });

  transcriptRequests.length = 0;
  jinaReaderRequests.length = 0;
  await submitInput(page, `/yt-script lang=${ROUND9_YT_LANG} ${ROUND9_YT_TARGET}`);
  await expectDefaultYouTubeTranscriptTriggered(
    ROUND9_YT_CANONICAL_URL,
    ROUND9_YT_LANG,
    "round9-yt-script-default-provider-success",
  );
  await page.screenshot({ path: files.round9YtProvider, fullPage: true });
}

async function runRound10(page, payload, files) {
  await page.goto(`${BASE_URL}/session?id=${encodeURIComponent(payload.ids.sessionAId)}`, {
    waitUntil: "domcontentloaded",
  });
  await expectText(page, "P4 Round10 Opening A", "round10-open-session-a");

  translationRequests.length = 0;
  await submitInput(
    page,
    `/translate target=${ROUND10_TRANSLATE_TARGET} provider=${ROUND10_TRANSLATE_PROVIDER} ${ROUND10_TRANSLATE_TEXT}`,
  );
  await expectDefaultTranslateTriggered(
    ROUND10_TRANSLATE_TEXT,
    ROUND10_TRANSLATE_TARGET,
    "round10-translate-default-provider-success",
  );
  await page.screenshot({ path: files.round10TranslateProvider, fullPage: true });
}

async function runRound11(page, payload, files) {
  await page.goto(`${BASE_URL}/session?id=${encodeURIComponent(payload.ids.sessionAId)}`, {
    waitUntil: "domcontentloaded",
  });
  await expectText(page, "P4 Round10 Opening A", "round11-open-session-a");

  await submitInput(page, `/translate provider=${ROUND11_TRANSLATE_PROVIDER} ${ROUND11_TRANSLATE_TEXT}`);
  await expectText(
    page,
    `/translate provider not available in /session default host: ${ROUND11_TRANSLATE_PROVIDER}`,
    "round11-translate-unsupported-provider-failfast",
  );
  await page.screenshot({ path: files.round11TranslateUnsupportedProvider, fullPage: true });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expectText(page, "P4 Round10 Opening A", "round11-reload-session-a");

  await submitInput(page, `/yt-script ${ROUND11_YT_TARGET}`);
  await expectText(
    page,
    "/yt-script transcript not available from /session default host",
    "round11-yt-script-default-provider-failfast",
  );
  await page.screenshot({ path: files.round11YtFailFast, fullPage: true });
}

async function runRound12(page, payload, files) {
  await page.goto(`${BASE_URL}/session?id=${encodeURIComponent(payload.ids.sessionAId)}`, {
    waitUntil: "domcontentloaded",
  });
  await expectText(page, "P4 Round10 Opening A", "round12-open-session-a");

  await seedProxyPresets(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectText(page, "P4 Round10 Opening A", "round12-reload-session-a");

  const defaultProxyPreset = ROUND9_PROXY_PRESETS[0];
  await submitInput(page, `/proxy ${defaultProxyPreset.name}`);
  const defaultProxySnapshot = await expectProxyPresetSwitched(page, defaultProxyPreset);
  addCheckpoint("round12-proxy-reset-default", true, {
    targetPresetId: defaultProxyPreset.id,
    snapshot: defaultProxySnapshot,
  });

  await submitInput(page, `/proxy ${ROUND12_PROXY_MISSING_PRESET}`);
  await expectText(
    page,
    `/proxy preset not found: ${ROUND12_PROXY_MISSING_PRESET}`,
    "round12-proxy-unknown-preset-failfast",
  );
  await expectProxyPresetUnchanged(page, defaultProxyPreset, "round12-proxy-state-unchanged");
  await page.screenshot({ path: files.round12ProxyUnknownPresetFailFast, fullPage: true });
}

async function main() {
  const startedAt = nowIso();
  const files = artifactPaths(RUN_DIR);
  const payload = buildPayload(RUN_ID, nowIso);

  let browser = null;
  let devServer = null;
  let startedDevServer = false;
  let noiseReport = null;

  await mkdir(RUN_DIR, { recursive: true });

  try {
    if (!(await isServerReady())) {
      startedDevServer = true;
      log(`Dev server unavailable, starting local server at ${BASE_URL}`);
      devServer = startDevServer();
      await waitForServerReady(120_000);
    } else {
      log(`Detected running server at ${BASE_URL}, reusing it.`);
    }

    browser = await chromium.launch({ headless: HEADLESS });
    const context = await browser.newContext({ baseURL: BASE_URL });
    const page = await context.newPage();

    page.on("console", (msg) => {
      const level = msg.type();
      const message = normalizeText(msg.text());
      consoleEvents.push({ level, message });
      consoleLogs.push(`[${nowIso()}] [${level}] ${message}`);
    });

    page.on("requestfailed", (req) => {
      const method = req.method();
      const url = req.url();
      const error = req.failure()?.errorText || "unknown";
      networkEvents.push({
        eventType: "requestfailed",
        method,
        url,
        status: null,
        error,
      });
      networkLogs.push(`[${nowIso()}] [FAILED] ${method} ${url} ${error}`);
    });

    page.on("response", (response) => {
      const url = response.url();
      const status = response.status();
      if (status >= 400 || url.includes("/v1/chat/completions")) {
        const method = response.request().method();
        networkEvents.push({
          eventType: "response",
          method,
          url,
          status,
          error: "",
        });
        networkLogs.push(`[${nowIso()}] [${status}] ${method} ${url}`);
      }
    });

    await page.route("https://r.jina.ai/**", async (route) => {
      const url = route.request().url();
      if (!url.includes("youtube.com/watch") && !url.includes("youtu.be/")) {
        await route.continue();
        return;
      }

      jinaReaderRequests.push(url);
      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: [
          "Title: P4 Transcript Fixture",
          "",
          `URL Source: ${ROUND9_YT_CANONICAL_URL}`,
          "",
          "Transcript",
          "",
          ROUND9_TRANSCRIPT_SAMPLE,
        ].join("\n"),
      });
    });

    await page.route("**/v1/chat/completions", async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      const requestBody = route.request().postDataJSON?.() || null;

      if (isTranslateRequest(requestBody)) {
        const detail = parseTranslateRequestDetail(requestBody);
        translationRequests.push(detail);
        networkEvents.push({
          eventType: "mock",
          method,
          url,
          status: 200,
          error: "",
        });
        networkLogs.push(`[${nowIso()}] [MOCK-200-TRANSLATE] ${method} ${url}`);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: `chatcmpl-${RUN_ID}`,
            model: requestBody?.model || ROUND9_PROXY_PRESETS[0].model,
            choices: [{
              index: 0,
              message: {
                role: "assistant",
                content: ROUND10_TRANSLATE_SAMPLE,
              },
              finish_reason: "stop",
            }],
            usage: {
              prompt_tokens: 12,
              completion_tokens: 6,
              total_tokens: 18,
            },
          }),
        });
        return;
      }

      if (isYouTubeTranscriptRequest(requestBody)) {
        const detail = parseYouTubeTranscriptRequestDetail(requestBody);
        transcriptRequests.push(detail);
        networkEvents.push({
          eventType: "mock",
          method,
          url,
          status: 200,
          error: "",
        });
        networkLogs.push(`[${nowIso()}] [MOCK-200-YT-TRANSCRIPT] ${method} ${url}`);
        const transcriptContent = detail.sourceUrl === ROUND9_YT_CANONICAL_URL
          ? ROUND9_TRANSCRIPT_SAMPLE
          : SESSION_NO_TRANSCRIPT_TOKEN;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: `chatcmpl-${RUN_ID}-yt`,
            model: requestBody?.model || ROUND9_PROXY_PRESETS[0].model,
            choices: [{
              index: 0,
              message: {
                role: "assistant",
                content: transcriptContent,
              },
              finish_reason: "stop",
            }],
            usage: {
              prompt_tokens: 18,
              completion_tokens: 12,
              total_tokens: 30,
            },
          }),
        });
        return;
      }

      networkEvents.push({
        eventType: "mock",
        method,
        url,
        status: 401,
        error: "",
      });
      networkLogs.push(`[${nowIso()}] [MOCK-401] ${method} ${url}`);
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "P4 replay mock unauthorized" } }),
      });
    });

    await seedIndexedDb(page, BASE_URL, payload);
    addCheckpoint("seed-indexeddb", true, { sessions: payload.sessions.length, dialogues: payload.dialogues.length });

    await runRound7(page, payload, files);
    await runRound8(page, payload, files);
    await runRound9(page, payload, files);
    await runRound10(page, payload, files);
    await runRound11(page, payload, files);
    await runRound12(page, payload, files);

    noiseReport = await buildNoiseReport(files);
    addCheckpoint("noise-baseline-diff", !noiseReport.hasNewNoise, {
      unknownSignatureCount: noiseReport.unknownSignatureCount,
      report: path.relative(REPO_ROOT, files.noiseReportMd),
    });
    if (noiseReport.hasNewNoise) {
      throw new Error(`Noise baseline drift: ${noiseReport.unknownSignatureCount} new signatures`);
    }

    await context.close();

    const summary = {
      runId: RUN_ID,
      startedAt,
      finishedAt: nowIso(),
      baseUrl: BASE_URL,
      allPassed: checkpoints.every((item) => item.passed),
      checkpoints,
      runDir: path.relative(REPO_ROOT, RUN_DIR),
      startedDevServer,
      noiseBaseline: noiseReport,
      summaryPath: path.relative(REPO_ROOT, files.summaryMd),
      noiseReportPath: path.relative(REPO_ROOT, files.noiseReportMd),
    };
    summary.runIndex = await updateRunIndex(summary);

    await writeList(files.console, consoleLogs);
    await writeList(files.network, networkLogs);
    await writeText(files.summaryJson, `${JSON.stringify(summary, null, 2)}\n`);
    await writeText(files.summaryMd, renderSummaryMarkdown(summary, files, REPO_ROOT));

    log(`Replay succeeded. Artifacts: ${path.relative(REPO_ROOT, RUN_DIR)}`);
    return 0;
  } catch (error) {
    const summary = {
      runId: RUN_ID,
      startedAt,
      finishedAt: nowIso(),
      baseUrl: BASE_URL,
      allPassed: false,
      checkpoints,
      runDir: path.relative(REPO_ROOT, RUN_DIR),
      startedDevServer,
      noiseBaseline: noiseReport,
      summaryPath: path.relative(REPO_ROOT, files.summaryMd),
      noiseReportPath: path.relative(REPO_ROOT, files.noiseReportMd),
      error: summarizeError(error),
    };

    await writeList(files.console, consoleLogs);
    await writeList(files.network, networkLogs);
    if (!noiseReport) {
      try {
        noiseReport = await buildNoiseReport(files);
      } catch (noiseError) {
        console.error(`[p4-session-replay] Failed to build noise report: ${summarizeError(noiseError)}`);
      }
      summary.noiseBaseline = noiseReport;
    }
    try {
      summary.runIndex = await updateRunIndex(summary);
    } catch (runIndexError) {
      console.error(`[p4-session-replay] Failed to update run index: ${summarizeError(runIndexError)}`);
    }
    await writeText(files.summaryJson, `${JSON.stringify(summary, null, 2)}\n`);
    await writeText(files.summaryMd, renderSummaryMarkdown(summary, files, REPO_ROOT));

    console.error(`[p4-session-replay] FAILED: ${summary.error}`);
    return 1;
  } finally {
    if (browser) await browser.close();
    if (devServer) await stopDevServer(devServer);
  }
}

process.exit(await main());
