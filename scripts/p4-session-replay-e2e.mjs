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
// P4 /session Replay（round7 + round8）
// 目标：单命令复验 slash 直达、刷新持久化、会话隔离、401 失败链路。
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const BASE_URL = process.env.P4_BASE_URL || "http://127.0.0.1:3303";
const HEADLESS = process.env.P4_HEADLESS !== "false";
const RUN_ID = process.env.P4_RUN_ID || `p4r11-${Date.now()}`;
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

const consoleLogs = [];
const networkLogs = [];
const consoleEvents = [];
const networkEvents = [];
const checkpoints = [];

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

    await page.route("**/v1/chat/completions", async (route) => {
      const method = route.request().method();
      const url = route.request().url();
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
