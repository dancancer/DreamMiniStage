import { spawn } from "node:child_process";

const steps = [
  { name: "lint", command: "pnpm", args: ["lint"] },
  { name: "typecheck", command: "pnpm", args: ["typecheck"] },
  { name: "test", command: "pnpm", args: ["vitest", "run"] },
  { name: "build", command: "pnpm", args: ["build"] },
];

function runStep(step) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(step.command, step.args, {
      stdio: "inherit",
      shell: false,
      env: process.env,
    });

    child.on("close", (code, signal) => {
      resolve({
        ...step,
        code: code ?? 1,
        signal: signal ?? null,
        durationMs: Date.now() - startedAt,
      });
    });

    child.on("error", (error) => {
      console.error(`[verify:stage] Failed to start ${step.name}:`, error);
      resolve({
        ...step,
        code: 1,
        signal: null,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

function formatDuration(durationMs) {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

async function main() {
  console.log("[verify:stage] Stage quality gate started");
  console.log("[verify:stage] Steps: lint -> typecheck -> test -> build");

  const results = [];

  for (const step of steps) {
    const commandLabel = `${step.command} ${step.args.join(" ")}`;
    console.log(`\n[verify:stage] Running ${step.name}: ${commandLabel}`);
    const result = await runStep(step);
    results.push(result);

    const status = result.code === 0 ? "PASS" : "FAIL";
    console.log(
      `[verify:stage] ${status} ${step.name} (${formatDuration(result.durationMs)})`,
    );
  }

  console.log("\n[verify:stage] Summary");
  for (const result of results) {
    const status = result.code === 0 ? "PASS" : "FAIL";
    console.log(`- ${status} ${result.name} (${formatDuration(result.durationMs)})`);
  }

  const failed = results.filter((result) => result.code !== 0);
  if (failed.length > 0) {
    console.error(
      `[verify:stage] Gate failed: ${failed.map((result) => result.name).join(", ")}`,
    );
    process.exit(1);
  }

  console.log("[verify:stage] Gate passed");
}

await main();
