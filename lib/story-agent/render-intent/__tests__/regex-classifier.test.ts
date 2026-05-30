import fs from "node:fs";
import path from "node:path";
import extract from "png-chunks-extract";
import PNGtext from "png-chunk-text";
import { describe, expect, it } from "vitest";
import { importRegexScripts } from "@/lib/adapters/import";
import type { RegexScript } from "@/lib/models/regex-script-model";
import {
  buildRegexClassificationReport,
  classifyRegexScripts,
  convertRegexScriptsToRenderIntents,
  convertRegexToRenderIntent,
} from "../index";

function readJson(pathname: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), pathname), "utf8"));
}

function readPngCard(filename: string): unknown {
  const chunks = extract(new Uint8Array(fs.readFileSync(path.join(
    process.cwd(),
    "test-baseline-assets",
    "character-card",
    filename,
  ))));
  const metadata = chunks
    .filter((chunk) => chunk.name === "tEXt")
    .map((chunk) => PNGtext.decode(chunk.data))
    .find((chunk) => ["ccv3", "chara"].includes(chunk.keyword.toLowerCase()));

  if (!metadata) throw new Error(`No character metadata in ${filename}`);
  return JSON.parse(Buffer.from(metadata.text, "base64").toString("utf8"));
}

function collectRegexObjects(value: unknown, results: unknown[] = []): unknown[] {
  if (Array.isArray(value)) {
    for (const item of value) collectRegexObjects(item, results);
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.findRegex === "string") results.push(record);
    for (const item of Object.values(record)) collectRegexObjects(item, results);
  }
  return results;
}

function expandedCorpus(): RegexScript[] {
  return [
    ...importRegexScripts(readJson("test-baseline-assets/regex-scripts/sgw3-sample.json")),
    ...importRegexScripts(readJson("test-baseline-assets/worldbook/regex-1美化夜空多选追加收起.json")),
    ...importRegexScripts(collectRegexObjects(readJson("test-baseline-assets/preset/明月秋青v3.94.json"))),
  ];
}

describe("regex RenderIntent classification", () => {
  it("classifies the expanded UI regex corpus with a measurable coverage ratio", () => {
    const conversions = convertRegexScriptsToRenderIntents(expandedCorpus());
    const report = buildRegexClassificationReport(conversions);

    expect(report.total).toBe(14);
    expect(report.uiTotal).toBe(7);
    expect(report.renderIntentConvertible).toBe(4);
    expect(report.renderIntentCoverage).toBeGreaterThanOrEqual(0.5);
    expect(report.unsupportedReasons).toMatchInlineSnapshot(`
      {
        "script tag is not allowed": 3,
      }
    `);
  });

  it("extracts whitelist RenderIntent objects from convertible UI regex scripts", () => {
    const scripts = expandedCorpus();
    const intents = scripts
      .map(convertRegexToRenderIntent)
      .flatMap((conversion) => conversion.intent ? [conversion.intent] : []);

    expect(intents.map((intent) => intent.kind).sort()).toEqual([
      "choice-list",
      "collapsible-panel",
      "collapsible-panel",
      "collapsible-panel",
    ]);
    expect(intents.every((intent) => intent.schemaVersion === 1)).toBe(true);
  });

  it("keeps malicious or complex HTML out of the UI execution path", () => {
    const malicious = importRegexScripts([{
      scriptKey: "malicious",
      scriptName: "malicious",
      findRegex: "(.*)",
      replaceString: "<div><img src=x onerror=\"fetch('/secret')\"><script>window.parent.postMessage('x','*')</script></div>",
      markdownOnly: true,
      placement: [2],
    }])[0];

    const conversion = convertRegexToRenderIntent(malicious);

    expect(conversion.intent).toBeUndefined();
    expect(conversion.classification.kind).toBe("unsupported");
    expect(conversion.fallback?.allowedActions).toEqual(["disable", "plain-text"]);
    expect(conversion.fallback?.plainText).not.toContain("<script>");
  });

  it("classifies theater UpdateVariable cleanup apart from unsafe HTML widgets", () => {
    const scripts = importRegexScripts(collectRegexObjects(readPngCard("V2.0Beta.png")));
    const classifications = classifyRegexScripts(scripts);

    expect(classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scriptName: "去除变量更新",
          kind: "state_update",
        }),
        expect.objectContaining({
          scriptName: "隐藏动作选项",
          kind: "prompt_transform",
        }),
        expect.objectContaining({
          scriptName: "正文-诡秘之主",
          kind: "unsupported",
          unsupportedReason: "script tag is not allowed",
        }),
      ]),
    );
  });
});
