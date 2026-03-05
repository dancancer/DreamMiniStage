/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   素材回放：Slash 控制流链路                                ║
 * ║                                                                           ║
 * ║  目标：使用真实素材复现 /while + /if 的控制流闭环，确保结果稳定。            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createMinimalContext, executeSlashCommandScript } from "../executor";

interface ControlFlowFixture {
  name: string;
  script: string;
  expect: {
    pipe: string;
    i: string;
  };
}

const CONTROL_FLOW_FIXTURE_PATH = path.join(
  process.cwd(),
  "test-baseline-assets",
  "slash-scripts",
  "control-flow-replay.json",
);

const controlFlowFixture = JSON.parse(
  fs.readFileSync(CONTROL_FLOW_FIXTURE_PATH, "utf8"),
) as ControlFlowFixture;

function splitReplayScript(script: string): string[] {
  return script
    .split("|")
    .map((command) => command.trim())
    .filter((command) => command.length > 0);
}

describe("slash control-flow material replay", () => {
  it("control-flow-replay 素材应收敛到期望 pipe 与变量状态", async () => {
    const ctx = createMinimalContext();
    const commands = splitReplayScript(controlFlowFixture.script);
    let lastPipe = "";

    expect(commands.length).toBeGreaterThan(0);

    for (const command of commands) {
      const result = await executeSlashCommandScript(command, ctx);
      expect(result.isError).toBe(false);
      lastPipe = result.pipe;
    }

    const iValue = await executeSlashCommandScript("/getvar i", ctx);

    expect(lastPipe).toBe(controlFlowFixture.expect.pipe);
    expect(iValue.isError).toBe(false);
    expect(iValue.pipe).toBe(controlFlowFixture.expect.i);
  });
});
