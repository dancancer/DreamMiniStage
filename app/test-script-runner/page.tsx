"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getP4ScenarioDefinitions,
  runAllP4Scenarios,
  runP4ScenarioById,
  type P4ScenarioResult,
} from "./scenarios";

type RunState = "idle" | "running";

export default function ScriptRunnerTestPage() {
  const scenarios = useMemo(() => getP4ScenarioDefinitions(), []);
  const [runState, setRunState] = useState<RunState>("idle");
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [finishedAt, setFinishedAt] = useState<string | null>(null);
  const [results, setResults] = useState<P4ScenarioResult[]>([]);

  const total = scenarios.length;
  const passedCount = results.filter((scenario) => scenario.passed).length;
  const allPassed = results.length === total && passedCount === total;

  const report = useMemo(() => {
    return {
      phase: "P4-Playwright-MCP-E2E",
      startedAt,
      finishedAt,
      total,
      passed: passedCount,
      failed: Math.max(results.length - passedCount, 0),
      allPassed,
      results,
    };
  }, [allPassed, finishedAt, passedCount, results, startedAt, total]);

  const runAll = async (): Promise<void> => {
    setRunState("running");
    setStartedAt(new Date().toISOString());
    setFinishedAt(null);
    setResults([]);

    const nextResults = await runAllP4Scenarios();

    setResults(nextResults);
    setFinishedAt(new Date().toISOString());
    setRunState("idle");
  };

  const runSingle = async (scenarioId: string): Promise<void> => {
    setRunState("running");
    if (!startedAt) {
      setStartedAt(new Date().toISOString());
    }

    const result = await runP4ScenarioById(scenarioId);

    setResults((previous) => {
      const filtered = previous.filter((item) => item.id !== scenarioId);
      return [...filtered, result];
    });
    setFinishedAt(new Date().toISOString());
    setRunState("idle");
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">SillyTavern P4 Playwright E2E 控制台</h1>
        <p className="text-sm text-muted-foreground">
          基于 test-baseline-assets 的四条主场景：脚本工具、Slash 控制流、MVU 变量链路、音频事件链路。
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <Button
          data-testid="run-p4-e2e"
          disabled={runState === "running"}
          onClick={runAll}
          type="button"
        >
          {runState === "running" ? "运行中..." : "运行全部 P4 场景"}
        </Button>
        <span
          className="rounded-md border border-border bg-muted px-3 py-1 text-sm"
          data-testid="p4-e2e-summary"
        >
          {results.length === 0
            ? "尚未执行"
            : `${passedCount}/${total} 通过${allPassed ? "（全绿）" : "（存在失败）"}`}
        </span>
        <span className="text-xs text-muted-foreground">Started: {startedAt ?? "-"}</span>
        <span className="text-xs text-muted-foreground">Finished: {finishedAt ?? "-"}</span>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {scenarios.map((scenario) => {
          const result = results.find((item) => item.id === scenario.id);
          const statusLabel = result ? (result.passed ? "PASS" : "FAIL") : "PENDING";
          const statusClass = result
            ? (result.passed ? "text-green-600" : "text-red-600")
            : "text-muted-foreground";

          return (
            <article className="rounded-lg border border-border bg-card p-4" key={scenario.id}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="text-base font-medium">{scenario.title}</h2>
                <span
                  className={`text-xs font-semibold ${statusClass}`}
                  data-testid={`scenario-${scenario.id}-status`}
                >
                  {statusLabel}
                </span>
              </div>

              <p className="mb-2 text-xs text-muted-foreground">{scenario.expectation}</p>
              <p className="mb-3 text-xs text-muted-foreground">
                资产：{scenario.assetReferences.join(" | ")}
              </p>

              <div className="flex items-center justify-between">
                <Button
                  data-testid={`run-${scenario.id}`}
                  disabled={runState === "running"}
                  onClick={() => runSingle(scenario.id)}
                  type="button"
                  variant="outline"
                >
                  单独执行
                </Button>
                <span className="text-xs text-muted-foreground">
                  用时：{result ? `${result.durationMs}ms` : "-"}
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-base font-medium">Run Report (JSON)</h2>
        <pre
          className="max-h-[520px] overflow-auto rounded-md bg-muted p-3 text-xs"
          data-testid="p4-e2e-report"
        >
          {JSON.stringify(report, null, 2)}
        </pre>
      </section>
    </div>
  );
}
