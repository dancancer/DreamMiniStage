import type { RegexScript } from "@/lib/models/regex-script-model";
import { classifyRegexScript, stripCodeFence } from "./classifier";
import {
  RENDER_INTENT_SCHEMA_VERSION,
  type ChoiceOption,
  type RenderIntent,
  type RenderIntentConversion,
  type UnsupportedRegexFallback,
} from "./types";

export function convertRegexToRenderIntent(script: RegexScript): RenderIntentConversion {
  const classification = classifyRegexScript(script);
  if (!classification.canExtractRenderIntent) {
    return {
      classification,
      fallback: unsupportedFallback(script, classification.unsupportedReason ?? "not convertible"),
    };
  }

  const html = stripCodeFence(script.replaceString ?? "");
  const intent = extractChoiceList(script, html) ??
    extractCollapsiblePanel(script, html) ??
    extractStatusPanel(script, html);

  if (!intent) {
    return {
      classification: {
        ...classification,
        canExtractRenderIntent: false,
        kind: "unsupported",
        unsupportedReason: "no whitelist extractor matched",
      },
      fallback: unsupportedFallback(script, "no whitelist extractor matched"),
    };
  }

  return { classification, intent };
}

export function convertRegexScriptsToRenderIntents(
  scripts: RegexScript[],
): RenderIntentConversion[] {
  return scripts.map(convertRegexToRenderIntent);
}

function extractChoiceList(script: RegexScript, html: string): RenderIntent | undefined {
  if (!html.includes("choice-item")) return undefined;
  const options = Array.from(html.matchAll(/<strong>\$(\d+)<\/strong>\s*<span[^>]*>\s*-\s*\$(\d+)/g))
    .slice(0, 6)
    .map((match, index): ChoiceOption => ({
      id: `choice-${index + 1}`,
      labelTemplate: `$${match[1]}`,
      descriptionTemplate: `$${match[2]}`,
      action: {
        type: "append-input",
        valueTemplate: `$${match[1]}`,
      },
    }));

  if (options.length === 0) return undefined;

  return {
    schemaVersion: RENDER_INTENT_SCHEMA_VERSION,
    id: intentId(script, "choice-list"),
    kind: "choice-list",
    sourceScriptId: scriptId(script),
    title: extractTitle(html) ?? "Choices",
    confidence: 0.86,
    options,
  };
}

function extractCollapsiblePanel(script: RegexScript, html: string): RenderIntent | undefined {
  if (!html.includes("<details") || !html.includes("$1")) return undefined;
  return {
    schemaVersion: RENDER_INTENT_SCHEMA_VERSION,
    id: intentId(script, "collapsible-panel"),
    kind: "collapsible-panel",
    sourceScriptId: scriptId(script),
    title: extractTitle(html) ?? script.scriptName,
    confidence: 0.82,
    bodyTemplate: "$1",
    collapsedLabel: extractAttr(html, "data-close") ?? "Expand",
    expandedLabel: extractAttr(html, "data-open") ?? "Collapse",
  };
}

function extractStatusPanel(script: RegexScript, html: string): RenderIntent | undefined {
  if (!html.includes("status-panel")) return undefined;
  const fields = Array.from(html.matchAll(/data-field="([^"]+)"[^>]*>\s*\$(\d+)/g))
    .slice(0, 12)
    .map((match) => ({
      label: match[1] ?? "field",
      valueTemplate: `$${match[2]}`,
    }));

  if (fields.length === 0) return undefined;

  return {
    schemaVersion: RENDER_INTENT_SCHEMA_VERSION,
    id: intentId(script, "status-panel"),
    kind: "status-panel",
    sourceScriptId: scriptId(script),
    title: extractTitle(html) ?? script.scriptName,
    confidence: 0.78,
    fields,
  };
}

export function unsupportedFallback(
  script: RegexScript,
  reason: string,
): UnsupportedRegexFallback {
  const replacement = stripCodeFence(script.replaceString ?? "");
  return {
    scriptId: script.scriptKey || script.id || script.scriptName,
    scriptName: script.scriptName,
    reason,
    rawSummary: summarizeRawRule(script),
    allowedActions: ["disable", "plain-text"],
    plainText: htmlToPlainText(replacement),
  };
}

function intentId(script: RegexScript, kind: string): string {
  return `${scriptId(script)}:${kind}`;
}

function scriptId(script: RegexScript): string {
  return script.scriptKey || script.id || script.scriptName;
}

function extractTitle(html: string): string | undefined {
  const summary = html.match(/<summary[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i)?.[1];
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const header = html.match(/<div[^>]*>\s*<span[^>]*>[^<]*<\/span>\s*<span>([^<]+)<\/span>/i)?.[1];
  return cleanText(summary ?? title ?? header);
}

function extractAttr(html: string, attr: string): string | undefined {
  return cleanText(html.match(new RegExp(`${attr}="([^"]+)"`, "i"))?.[1]);
}

function summarizeRawRule(script: RegexScript): string {
  const pattern = script.findRegex.length > 80
    ? `${script.findRegex.slice(0, 77)}...`
    : script.findRegex;
  return `${script.scriptName}: ${pattern}`;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.replace(/\s+/g, " ").trim();
  return text && text.length > 0 ? text : undefined;
}
