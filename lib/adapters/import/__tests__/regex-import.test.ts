import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { importRegexScripts } from "../regex-import";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), path), "utf8"));
}

describe("regex import Phase 0 fixtures", () => {
  it("imports wrapper and single-script regex fixtures into one normalized shape", () => {
    const textScripts = importRegexScripts(
      readJson("test-baseline-assets/regex-scripts/sgw3-sample.json"),
    );
    const uiScripts = importRegexScripts(
      readJson("test-baseline-assets/worldbook/regex-1美化夜空多选追加收起.json"),
    );

    expect(textScripts).toHaveLength(3);
    expect(textScripts.every((script) => Array.isArray(script.placement))).toBe(true);
    expect(textScripts.map((script) => script.scriptName)).toEqual([
      "歌曲隐藏",
      "春日影 (MyGO!!!!! ver.)",
      "春日影",
    ]);

    expect(uiScripts).toHaveLength(1);
    expect(uiScripts[0]).toMatchObject({
      scriptName: "1美化夜空多选追加收起",
      disabled: true,
      markdownOnly: true,
      placement: [2],
    });
    expect(uiScripts[0].replaceString).toContain("<!DOCTYPE html>");
  });
});
