import { RegexPlacement, type RegexScript } from "@/lib/models/regex-script-model";
import type { RegexClassification } from "./types";

export function classifyRegexScript(script: RegexScript): RegexClassification {
  const html = stripCodeFence(script.replaceString ?? "");
  const scriptId = script.scriptKey || script.id || script.scriptName;
  if (isStatusSourcePattern(script, html)) {
    return {
      scriptId,
      scriptName: script.scriptName,
      kind: "render_intent_extractor",
      confidence: 0.8,
      canExtractRenderIntent: true,
      reasons: ["status source pattern", "compiled to whitelist status panel"],
    };
  }
  if (isStateUpdateCleanup(script, html)) {
    return classification(script, "state_update", 0.86, [
      "UpdateVariable block cleanup",
      "compiled to StoryState update grammar",
    ]);
  }
  const ui = classifyUi(script, html);
  if (ui) return { scriptId, scriptName: script.scriptName, ...ui };

  if (script.promptOnly) {
    return classification(script, "prompt_transform", 0.9, ["promptOnly"]);
  }
  if (script.markdownOnly && script.placement.includes(RegexPlacement.AI_OUTPUT)) {
    return classification(script, "display_transform", 0.78, ["markdownOnly", "placement:AI_OUTPUT"]);
  }
  if (script.placement.includes(RegexPlacement.USER_INPUT)) {
    return classification(script, "input_filter", 0.8, ["placement:USER_INPUT"]);
  }
  if (script.placement.includes(RegexPlacement.AI_OUTPUT)) {
    return classification(script, "output_filter", 0.8, ["placement:AI_OUTPUT"]);
  }

  return classification(script, "unsupported", 0.4, ["no supported placement"], "unclassified regex rule");
}

function isStatusSourcePattern(script: RegexScript, html: string): boolean {
  return /状态栏|status/i.test(script.scriptName) &&
    containsHtml(html) &&
    /<SFW>|<NSFW>/i.test(script.findRegex) &&
    /\\\{/.test(script.findRegex);
}

function isStateUpdateCleanup(script: RegexScript, html: string): boolean {
  return /UpdateVariable/i.test(script.findRegex) && html.trim().length === 0;
}

export function classifyRegexScripts(scripts: RegexScript[]): RegexClassification[] {
  return scripts.map(classifyRegexScript);
}

function classifyUi(
  script: RegexScript,
  html: string,
): Omit<RegexClassification, "scriptId" | "scriptName"> | undefined {
  if (!containsHtml(html)) return undefined;

  const reasons = ["html replacement"];
  const unsafe = findUnsafeHtmlReason(html);
  const convertible = isConvertibleUi(html);
  if (convertible && !unsafe) {
    return {
      kind: "render_intent_extractor",
      confidence: 0.86,
      canExtractRenderIntent: true,
      reasons: [...reasons, "matches whitelist component pattern"],
    };
  }

  return {
    kind: "unsupported",
    confidence: 0.92,
    canExtractRenderIntent: false,
    reasons: unsafe ? [...reasons, unsafe] : [...reasons, "no whitelist component pattern"],
    unsupportedReason: unsafe ?? "html widget does not match RenderIntent whitelist",
  };
}

function classification(
  script: RegexScript,
  kind: RegexClassification["kind"],
  confidence: number,
  reasons: string[],
  unsupportedReason?: string,
): RegexClassification {
  return {
    scriptId: script.scriptKey || script.id || script.scriptName,
    scriptName: script.scriptName,
    kind,
    confidence,
    canExtractRenderIntent: false,
    reasons,
    unsupportedReason,
  };
}

export function isConvertibleUi(html: string): boolean {
  const text = html.toLowerCase();
  return text.includes("choice-item") ||
    (text.includes("<details") && text.includes("$1")) ||
    text.includes("status-panel");
}

export function findUnsafeHtmlReason(html: string): string | undefined {
  const text = html.toLowerCase();
  if (text.includes("<script")) return "script tag is not allowed";
  if (text.includes("<iframe")) return "iframe is not allowed";
  if (/\son[a-z]+\s*=/.test(text)) return "inline event handler is not allowed";
  if (text.includes("window.parent") || text.includes("document.")) {
    return "dom access is not allowed";
  }
  return undefined;
}

export function containsHtml(value: string): boolean {
  const text = value.toLowerCase();
  return text.includes("<html") ||
    text.includes("<style") ||
    text.includes("<div") ||
    text.includes("<details") ||
    text.includes("<button") ||
    text.includes("<iframe");
}

export function stripCodeFence(value: string): string {
  return value
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}
