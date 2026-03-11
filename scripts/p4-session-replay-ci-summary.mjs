#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  renderReplayJobSummaryMarkdown,
  resolveReplayArtifactLayout,
} from "./p4-session-replay-lib.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const STEP_SUMMARY_PATH = process.env.GITHUB_STEP_SUMMARY;
const { artifactRoot } = resolveReplayArtifactLayout(REPO_ROOT, process.env.P4_ARTIFACT_ROOT);

async function findLatestSummaryJson(rootDir) {
  let entries = [];
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("p4-session-replay-")) continue;
    candidates.push(path.join(rootDir, entry.name, "summary.json"));
  }

  candidates.sort().reverse();
  for (const candidate of candidates) {
    try {
      await readFile(candidate, "utf8");
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

async function main() {
  if (!STEP_SUMMARY_PATH) {
    console.log("[p4-session-replay:summary] GITHUB_STEP_SUMMARY is unset; skipping.");
    return;
  }

  try {
    const summaryJsonPath = await findLatestSummaryJson(artifactRoot);
    if (!summaryJsonPath) {
      await writeFile(STEP_SUMMARY_PATH, "## P4 Session Replay\n- replay summary not found\n", { flag: "a" });
      return;
    }

    const summary = JSON.parse(await readFile(summaryJsonPath, "utf8"));
    const markdown = `${renderReplayJobSummaryMarkdown(summary)}\n`;
    await writeFile(STEP_SUMMARY_PATH, markdown, { flag: "a" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeFile(STEP_SUMMARY_PATH, `## P4 Session Replay\n- summary generation failed: \`${message}\`\n`, { flag: "a" });
    console.error(`[p4-session-replay:summary] ${message}`);
  }
}

await main();
