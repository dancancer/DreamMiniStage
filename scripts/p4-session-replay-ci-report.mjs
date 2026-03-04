#!/usr/bin/env node

import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// ============================================================================
// P4 Session Replay CI 报告
// 目标：
// 1) 读取 run-index 并生成主链路状态摘要
// 2) 注入 GitHub Job Summary（降低翻产物成本）
// 3) 输出风险门禁字段（供 PR 自动评论步骤消费）
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const RUN_INDEX_JSON_PATH = path.resolve(
  REPO_ROOT,
  process.env.P4_RUN_INDEX_JSON_PATH || "docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-run-index.json",
);

function toNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDurationText(durationMs) {
  const ms = toNumber(durationMs, NaN);
  if (!Number.isFinite(ms) || ms < 0) return "n/a";
  return `${(ms / 1000).toFixed(1)}s`;
}

export function resolveLatestRun(index) {
  const runs = Array.isArray(index?.runs) ? index.runs : [];
  if (runs.length === 0) return null;

  if (typeof index?.latestRunId === "string" && index.latestRunId.length > 0) {
    const matched = runs.find((run) => run.runId === index.latestRunId);
    if (matched) return matched;
  }

  return runs[0];
}

function getStaleCounts(index) {
  const staleConsole = Array.isArray(index?.staleRules?.console) ? index.staleRules.console.length : 0;
  const staleNetwork = Array.isArray(index?.staleRules?.network) ? index.staleRules.network.length : 0;
  return {
    staleConsoleCount: staleConsole,
    staleNetworkCount: staleNetwork,
    staleRuleCount: staleConsole + staleNetwork,
  };
}

function toRelativePath(filePath) {
  if (!filePath || typeof filePath !== "string") return "n/a";
  return filePath;
}

export function buildCiReport(index) {
  const latestRun = resolveLatestRun(index);
  if (!latestRun) {
    return {
      latestRunId: "unavailable",
      allPassed: false,
      checkpointPassed: 0,
      checkpointTotal: 0,
      unknownSignatureCount: 0,
      staleConsoleCount: 0,
      staleNetworkCount: 0,
      staleRuleCount: 0,
      riskDetected: true,
      durationText: "n/a",
      summaryPath: "n/a",
      noiseReportPath: "n/a",
      runDir: "n/a",
      parseError: "No run entries found in run-index.",
      markdown: [
        "## P4 Session Replay",
        "",
        "- latestRunId: unavailable",
        "- status: invalid run-index (no runs)",
      ].join("\n"),
    };
  }

  const unknownSignatureCount = Math.max(0, toNumber(latestRun.unknownSignatureCount, 0));
  const { staleConsoleCount, staleNetworkCount, staleRuleCount } = getStaleCounts(index);
  const riskDetected = unknownSignatureCount > 0 || staleRuleCount > 0;

  const markdown = [
    "## P4 Session Replay",
    "",
    `- latestRunId: ${latestRun.runId || "unknown"}`,
    `- pass: ${Boolean(latestRun.allPassed)}`,
    `- checkpoints: ${toNumber(latestRun.checkpointPassed, 0)}/${toNumber(latestRun.checkpointTotal, 0)}`,
    `- unknownSignatureCount: ${unknownSignatureCount}`,
    `- staleRuleCount: ${staleRuleCount} (console=${staleConsoleCount}, network=${staleNetworkCount})`,
    `- duration: ${toDurationText(latestRun.durationMs)}`,
    `- summary: ${toRelativePath(latestRun.summaryPath)}`,
    `- noiseReport: ${toRelativePath(latestRun.noiseReportPath)}`,
    `- runDir: ${toRelativePath(latestRun.runDir)}`,
  ].join("\n");

  return {
    latestRunId: latestRun.runId || "unknown",
    allPassed: Boolean(latestRun.allPassed),
    checkpointPassed: toNumber(latestRun.checkpointPassed, 0),
    checkpointTotal: toNumber(latestRun.checkpointTotal, 0),
    unknownSignatureCount,
    staleConsoleCount,
    staleNetworkCount,
    staleRuleCount,
    riskDetected,
    durationText: toDurationText(latestRun.durationMs),
    summaryPath: toRelativePath(latestRun.summaryPath),
    noiseReportPath: toRelativePath(latestRun.noiseReportPath),
    runDir: toRelativePath(latestRun.runDir),
    parseError: "",
    markdown,
  };
}

function formatOutputEntry(name, value) {
  const normalized = String(value ?? "");
  if (!normalized.includes("\n")) {
    return `${name}=${normalized}`;
  }

  const delimiter = "__P4_CI_REPORT__";
  return `${name}<<${delimiter}\n${normalized}\n${delimiter}`;
}

async function appendGithubOutput(report) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) return;

  const lines = [
    formatOutputEntry("risk_detected", report.riskDetected),
    formatOutputEntry("all_passed", report.allPassed),
    formatOutputEntry("latest_run_id", report.latestRunId),
    formatOutputEntry("checkpoint_passed", report.checkpointPassed),
    formatOutputEntry("checkpoint_total", report.checkpointTotal),
    formatOutputEntry("unknown_signature_count", report.unknownSignatureCount),
    formatOutputEntry("stale_console_count", report.staleConsoleCount),
    formatOutputEntry("stale_network_count", report.staleNetworkCount),
    formatOutputEntry("stale_rule_count", report.staleRuleCount),
    formatOutputEntry("duration_text", report.durationText),
    formatOutputEntry("summary_path", report.summaryPath),
    formatOutputEntry("noise_report_path", report.noiseReportPath),
    formatOutputEntry("run_dir", report.runDir),
    formatOutputEntry("parse_error", report.parseError),
    formatOutputEntry("report_markdown", report.markdown),
  ];

  await appendFile(outputFile, `${lines.join("\n")}\n`, "utf8");
}

async function appendStepSummary(markdown) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;
  await appendFile(summaryFile, `${markdown}\n`, "utf8");
}

async function loadRunIndex(filePath) {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("run-index root is not an object");
  }
  return parsed;
}

function buildParseFailureReport(error) {
  return {
    latestRunId: "unavailable",
    allPassed: false,
    checkpointPassed: 0,
    checkpointTotal: 0,
    unknownSignatureCount: 0,
    staleConsoleCount: 0,
    staleNetworkCount: 0,
    staleRuleCount: 0,
    riskDetected: true,
    durationText: "n/a",
    summaryPath: "n/a",
    noiseReportPath: "n/a",
    runDir: "n/a",
    parseError: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    markdown: [
      "## P4 Session Replay",
      "",
      "- latestRunId: unavailable",
      "- status: failed to parse run-index",
      `- parseError: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
    ].join("\n"),
  };
}

export async function main() {
  let report;
  try {
    const index = await loadRunIndex(RUN_INDEX_JSON_PATH);
    report = buildCiReport(index);
  } catch (error) {
    report = buildParseFailureReport(error);
  }

  await appendStepSummary(report.markdown);
  await appendGithubOutput(report);

  console.log(
    `[p4-ci-report] latestRun=${report.latestRunId} pass=${report.allPassed} unknown=${report.unknownSignatureCount} stale=${report.staleRuleCount} risk=${report.riskDetected}`,
  );
  if (report.parseError) {
    console.warn(`[p4-ci-report] parseError=${report.parseError}`);
  }

  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.exit(await main());
}
