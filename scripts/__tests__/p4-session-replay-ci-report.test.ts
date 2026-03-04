import { describe, expect, it } from "vitest";
import { buildCiReport, resolveLatestRun } from "../p4-session-replay-ci-report.mjs";

describe("resolveLatestRun", () => {
  it("prefers latestRunId when it exists", () => {
    const latest = resolveLatestRun({
      latestRunId: "run-b",
      runs: [
        { runId: "run-a", unknownSignatureCount: 0 },
        { runId: "run-b", unknownSignatureCount: 0 },
      ],
    });

    expect(latest?.runId).toBe("run-b");
  });

  it("falls back to first run when latestRunId is missing", () => {
    const latest = resolveLatestRun({
      latestRunId: "run-missing",
      runs: [
        { runId: "run-a", unknownSignatureCount: 0 },
        { runId: "run-b", unknownSignatureCount: 0 },
      ],
    });

    expect(latest?.runId).toBe("run-a");
  });
});

describe("buildCiReport", () => {
  it("marks report as risky when unknown signatures exist", () => {
    const report = buildCiReport({
      latestRunId: "run-a",
      runs: [
        {
          runId: "run-a",
          allPassed: true,
          checkpointPassed: 11,
          checkpointTotal: 11,
          unknownSignatureCount: 2,
          durationMs: 15000,
          summaryPath: "summary.md",
          noiseReportPath: "noise.md",
          runDir: "run-dir",
        },
      ],
      staleRules: {
        console: [],
        network: [],
      },
    });

    expect(report.riskDetected).toBe(true);
    expect(report.unknownSignatureCount).toBe(2);
    expect(report.staleRuleCount).toBe(0);
    expect(report.parseError).toBe("");
  });

  it("marks report as risky when stale rules exist", () => {
    const report = buildCiReport({
      latestRunId: "run-a",
      runs: [
        {
          runId: "run-a",
          allPassed: true,
          checkpointPassed: 11,
          checkpointTotal: 11,
          unknownSignatureCount: 0,
          durationMs: 15000,
          summaryPath: "summary.md",
          noiseReportPath: "noise.md",
          runDir: "run-dir",
        },
      ],
      staleRules: {
        console: [{ id: "console-a" }],
        network: [{ id: "network-a" }, { id: "network-b" }],
      },
    });

    expect(report.riskDetected).toBe(true);
    expect(report.staleConsoleCount).toBe(1);
    expect(report.staleNetworkCount).toBe(2);
    expect(report.staleRuleCount).toBe(3);
  });

  it("returns parse error report when run-index has no runs", () => {
    const report = buildCiReport({
      latestRunId: "run-a",
      runs: [],
      staleRules: {
        console: [],
        network: [],
      },
    });

    expect(report.latestRunId).toBe("unavailable");
    expect(report.riskDetected).toBe(true);
    expect(report.parseError).toContain("No run entries found");
  });
});
