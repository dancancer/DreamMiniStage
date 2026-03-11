import { describe, expect, it } from "vitest";
import { analyzeNoiseBaseline, buildReplayRunIndex, renderReplayFailureDigest, renderReplayJobSummaryMarkdown, resolveReplayArtifactLayout } from "../p4-session-replay-lib.mjs";

describe("analyzeNoiseBaseline", () => {
  it("returns per-rule audit with unused rule ids", () => {
    const report = analyzeNoiseBaseline({
      baseline: {
        version: 1,
        consoleRules: [
          { id: "console-a", level: "error", messageIncludes: "known-a" },
          { id: "console-b", level: "warning", messageIncludes: "known-b" },
        ],
        networkRules: [
          { id: "network-a", eventType: "response", method: "GET", status: 404, urlIncludes: "/asset.png" },
        ],
      },
      consoleEvents: [
        { level: "error", message: "known-a happened" },
      ],
      networkEvents: [],
    });

    expect(report.ruleAudit.console.matchedRuleIds).toEqual(["console-a"]);
    expect(report.ruleAudit.console.unusedRuleIds).toEqual(["console-b"]);
    expect(report.ruleAudit.network.unusedRuleIds).toEqual(["network-a"]);
    expect(report.unknownSignatureCount).toBe(0);
  });
});

describe("analyzeNoiseBaseline network noise rules", () => {
  it("classifies googletagmanager script aborts as known noise when baseline includes the rule", () => {
    const report = analyzeNoiseBaseline({
      baseline: {
        version: 1,
        consoleRules: [],
        networkRules: [
          {
            id: "network-ga-script-aborted",
            eventType: "requestfailed",
            method: "GET",
            urlIncludes: "https://www.googletagmanager.com/gtag/js",
            errorIncludes: "net::ERR_ABORTED",
            classification: "known-noise",
          },
        ],
      },
      consoleEvents: [],
      networkEvents: [
        {
          eventType: "requestfailed",
          method: "GET",
          url: "https://www.googletagmanager.com/gtag/js?id=G-KDEPSL9CJG",
          status: null,
          error: "net::ERR_ABORTED",
        },
      ],
    });

    expect(report.unknownSignatureCount).toBe(0);
    expect(report.network.known).toEqual([
      expect.objectContaining({ id: "network-ga-script-aborted", count: 1 }),
    ]);
  });
});

describe("buildReplayRunIndex", () => {
  function makeSummary(runId: string, finishedAt: string) {
    return {
      runId,
      startedAt: "2026-03-04T00:00:00.000Z",
      finishedAt,
      allPassed: true,
      checkpoints: [{ name: "c1", passed: true }],
      runDir: `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-${runId}`,
      summaryPath: `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-${runId}/summary.md`,
      noiseReportPath: `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-${runId}/round10-noise-baseline-report.md`,
      noiseBaseline: {
        unknownSignatureCount: 0,
        hasNewNoise: false,
        ruleAudit: {
          console: {
            allRuleIds: ["console-a", "console-b"],
            matchedRuleIds: ["console-a"],
          },
          network: {
            allRuleIds: ["network-a"],
            matchedRuleIds: [],
          },
        },
      },
    };
  }

  it("tracks consecutive misses and marks stale rules", () => {
    const first = buildReplayRunIndex({
      previousIndex: null,
      summary: makeSummary("run-a", "2026-03-04T00:00:10.000Z"),
      staleMissThreshold: 2,
      maxRuns: 10,
      nowIso: () => "2026-03-04T00:00:10.000Z",
    });

    expect(first.staleRules.console).toEqual([]);
    expect(first.ruleHealth.console["console-b"].consecutiveMisses).toBe(1);
    expect(first.ruleHealth.network["network-a"].consecutiveMisses).toBe(1);

    const second = buildReplayRunIndex({
      previousIndex: first,
      summary: makeSummary("run-b", "2026-03-04T00:00:20.000Z"),
      staleMissThreshold: 2,
      maxRuns: 10,
      nowIso: () => "2026-03-04T00:00:20.000Z",
    });

    expect(second.staleRules.console.map((item) => item.id)).toEqual(["console-b"]);
    expect(second.staleRules.network.map((item) => item.id)).toEqual(["network-a"]);
    expect(second.runs.map((item) => item.runId)).toEqual(["run-b", "run-a"]);
    expect(second.latestRunId).toBe("run-b");
  });
});


describe("resolveReplayArtifactLayout", () => {
  it("defaults runtime artifacts to .artifacts/p4-session-replay", () => {
    const layout = resolveReplayArtifactLayout("/repo");

    expect(layout.artifactRoot).toBe("/repo/.artifacts/p4-session-replay");
    expect(layout.runIndexJsonPath).toBe("/repo/.artifacts/p4-session-replay/p4-session-replay-run-index.json");
    expect(layout.runIndexMdPath).toBe("/repo/.artifacts/p4-session-replay/p4-session-replay-run-index.md");
  });
});

describe("replay failure digest rendering", () => {
  function makeFailedSummary() {
    return {
      runId: "p4r16-123",
      error: "Error: Noise baseline drift: 1 new signatures",
      runDir: ".artifacts/p4-session-replay/p4-session-replay-p4r16-123",
      noiseReportPath: ".artifacts/p4-session-replay/p4-session-replay-p4r16-123/round13-noise-baseline-report.md",
      noiseBaseline: {
        unknownSignatureCount: 2,
        console: {
          unknown: [{ signature: "warning|Node llm-1: Required input 'topP' not found", count: 2 }],
        },
        network: {
          unknown: [{ signature: "requestfailed|none|GET|https://example.com/script.js|net::ERR_ABORTED", count: 1 }],
        },
      },
    };
  }

  it("renders actionable plain-text digest for CI logs", () => {
    const digest = renderReplayFailureDigest(makeFailedSummary());

    expect(digest).toContain("[p4-session-replay] Failure digest");
    expect(digest).toContain("- runId: p4r16-123");
    expect(digest).toContain("- artifacts: .artifacts/p4-session-replay/p4-session-replay-p4r16-123");
    expect(digest).toContain("- unknownSignatureCount: 2");
    expect(digest).toContain("Console New Signatures");
    expect(digest).toContain("Network New Signatures");
  });

  it("renders markdown digest for GitHub step summary", () => {
    const digest = renderReplayJobSummaryMarkdown(makeFailedSummary());

    expect(digest).toContain("## P4 Session Replay Failure");
    expect(digest).toContain("- runId: `p4r16-123`");
    expect(digest).toContain("### Console New Signatures");
    expect(digest).toContain("### Network New Signatures");
  });
});
