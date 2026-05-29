import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importRegexScripts } from "@/lib/adapters/import";
import type { RegexScript } from "@/lib/models/regex-script-model";
import {
  buildRegexClassificationReport,
  convertRegexScriptsToRenderIntents,
  convertRegexToRenderIntent,
} from "../index";

function readJson(pathname: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), pathname), "utf8"));
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
});
