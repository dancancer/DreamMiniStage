import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  executeDialogueFlow,
  type DialogueFlowConfig,
} from "./dialogue-flow-test-helpers";

const FIXTURE_PATH = path.join(
  process.cwd(),
  "lib/core/__tests__/fixtures/phase4/regex-flow.json",
);

function readFixture(): DialogueFlowConfig {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as DialogueFlowConfig;
}

describe("phase4 regex flow baseline", () => {
  it("applies USER_INPUT regex before worldbook matching and AI_OUTPUT regex after llm output", () => {
    const result = executeDialogueFlow(readFixture());

    expect(result.processedInput).toContain("标准化输入");
    expect(
      result.matchedWorldBookEntries.some(
        (entry) => entry.entry_id === "phase4-worldbook-entry",
      ),
    ).toBe(true);
    expect(result.processedResponse).toContain("后处理输出");
  });
});
