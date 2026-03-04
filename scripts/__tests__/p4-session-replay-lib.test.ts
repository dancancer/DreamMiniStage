import { describe, expect, it } from "vitest";
import { analyzeNoiseBaseline, buildReplayRunIndex } from "../p4-session-replay-lib.mjs";

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
