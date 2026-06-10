// NS-Phase 4.2 编排器（见 ADR-0011）：把 unsupported script-widget 交给导入期 LLM（注入的
// WidgetSynthesisModel 端口），产出 RenderIntentSpec → 经 4.1 确定性安全校验 → 编译成白名单
// RenderIntent。LLM 失败 / 输出非规格 / 规格不安全，一律降级为 reason（落 Import Diagnostic），
// 绝不让不安全内容进入渲染。prod 由调用方注入 model-gateway adapter，测试注入 fake。
import type { RegexScript } from "@/lib/models/regex-script-model";
import type { LLMConfig } from "@/lib/nodeflow/LLMNode/llm-config";
import { cleanModelCallConfig } from "@/lib/nodeflow/LLMNode/clean-model-call-config";
import { extractFirstJsonObject } from "@/lib/utils/extract-json";
import { classifyRegexScript, containsHtml, stripCodeFence } from "./classifier";
import {
  compileRenderIntentSpec,
  validateRenderIntentSpec,
  type RenderIntentSpec,
} from "./synthesis";
import type { RenderIntent } from "./types";

export interface WidgetSynthesisInput {
  scriptName: string;
  html: string;
}

/** widget 合成 LLM 端口：输入 widget，返回待 coerce/校验的原始 spec 输出。 */
export type WidgetSynthesisModel = (input: WidgetSynthesisInput) => Promise<unknown>;

export interface WidgetSynthesisWidget {
  scriptId: string;
  scriptName: string;
  html: string;
}

export interface WidgetSynthesisOutcome {
  /** 合成并校验通过的安全 RenderIntent。 */
  intent?: RenderIntent;
  /** 失败/不安全的原因，供落 Import Diagnostic（与 intent 互斥）。 */
  reason?: string;
}

export async function synthesizeRenderIntent(
  widget: WidgetSynthesisWidget,
  model: WidgetSynthesisModel,
): Promise<WidgetSynthesisOutcome> {
  let raw: unknown;
  try {
    raw = await model({ scriptName: widget.scriptName, html: widget.html });
  } catch (error) {
    return { reason: `synthesis model error: ${(error as Error).message}` };
  }

  const spec = coerceSpec(raw);
  if (!spec) {
    return { reason: "synthesis model did not return a RenderIntentSpec" };
  }

  // validate/compile 也兜在 try 内：即便 spec 形状畸形（嵌套字段非数组等），也降级为
  // reason 落诊断，绝不让单个坏 widget 抛出中断整个导入富化。
  try {
    const validation = validateRenderIntentSpec(spec);
    if (!validation.valid) {
      return { reason: `unsafe or invalid spec: ${validation.reasons.join("; ")}` };
    }
    return { intent: compileRenderIntentSpec(spec, widget.scriptId) };
  } catch (error) {
    return { reason: `synthesis validation error: ${(error as Error).message}` };
  }
}

export interface WidgetSynthesisDiagnostic {
  scriptName: string;
  reason: string;
}

export interface UnsupportedWidgetSynthesisResult {
  /** 合成并校验通过的安全 RenderIntent，供追加进 blueprint.renderRules。 */
  intents: RenderIntent[];
  /** 未能复现的 widget，供落 Import Diagnostic。 */
  diagnostics: WidgetSynthesisDiagnostic[];
}

// 对一组 regex 脚本：只挑分类为 unsupported 且确实是 HTML widget 的，逐个交给 model 合成，
// 合格 intent 收集、失败原因落诊断。非 UI / 可白名单转换的脚本由 compiler 既有路径处理，跳过。
export async function synthesizeUnsupportedWidgets(
  scripts: RegexScript[],
  model: WidgetSynthesisModel,
): Promise<UnsupportedWidgetSynthesisResult> {
  const intents: RenderIntent[] = [];
  const diagnostics: WidgetSynthesisDiagnostic[] = [];

  for (const script of scripts) {
    const classification = classifyRegexScript(script);
    if (classification.kind !== "unsupported") continue;
    const html = stripCodeFence(script.replaceString ?? "");
    if (!containsHtml(html)) continue;

    const outcome = await synthesizeRenderIntent(
      { scriptId: classification.scriptId, scriptName: classification.scriptName, html },
      model,
    );
    if (outcome.intent) {
      intents.push(outcome.intent);
    } else {
      diagnostics.push({
        scriptName: classification.scriptName,
        reason: outcome.reason ?? "widget synthesis produced no render intent",
      });
    }
  }

  return { intents, diagnostics };
}

// 仅做形状 coerce（kind/title/sourceTag 为字符串）；安全性交由 validateRenderIntentSpec。
function coerceSpec(raw: unknown): RenderIntentSpec | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  if (
    typeof record.kind !== "string" ||
    typeof record.title !== "string" ||
    typeof record.sourceTag !== "string"
  ) {
    return undefined;
  }
  return record as unknown as RenderIntentSpec;
}

// ── prod 适配器：把 widget 交给非流式模型，要求其只产 RenderIntentSpec JSON ──────────────
type ChatMessage = { role: string; content: string };

const SYNTHESIS_SYSTEM = [
  "You analyze a SillyTavern UI widget (HTML, possibly script-driven) and describe how to reproduce",
  "its visual function as a SAFE declarative RenderIntentSpec — WITHOUT executing any script.",
  "Rules:",
  "- Output ONLY a JSON object (a RenderIntentSpec). No prose, no markdown fences.",
  "- kind MUST be one of: status-panel | collapsible-panel | choice-list | state-panel.",
  "- Describe WHAT DATA the widget renders and the source tag the model emits to carry it",
  "  (sourceTag: a bare tag name like StatusDashboard or SFW).",
  "- status-panel: { kind, title, sourceTag, fields:[{label, valueTemplate}] }, valueTemplate like $json.affection.",
  "- collapsible-panel: { kind, title, sourceTag, bodyTemplate, collapsedLabel?, expandedLabel? }.",
  "- choice-list: { kind, title, sourceTag, options:[{id, labelTemplate, descriptionTemplate?, valueTemplate}] }.",
  "- NEVER include raw HTML, <script>, inline handlers or executable code in any value.",
  '- If the widget cannot be safely reproduced as data, return {"kind":"unsupported"}.',
].join("\n");

export function buildWidgetSynthesisPrompt(input: WidgetSynthesisInput): ChatMessage[] {
  return [
    { role: "system", content: SYNTHESIS_SYSTEM },
    { role: "user", content: `Widget name: ${input.scriptName}\nWidget HTML:\n${input.html}` },
  ];
}

export function parseRenderIntentSpec(text: string): unknown {
  const json = extractFirstJsonObject(stripCodeFence(text));
  if (!json) {
    throw new Error("widget synthesis response did not contain a JSON object.");
  }
  return JSON.parse(json);
}

export interface WidgetSynthesisModelDeps {
  invokeLLM: (config: LLMConfig) => Promise<string>;
  baseConfig: LLMConfig;
}

export function createWidgetSynthesisModel(deps: WidgetSynthesisModelDeps): WidgetSynthesisModel {
  return async (input) => {
    const response = await deps.invokeLLM({
      ...cleanModelCallConfig(deps.baseConfig),
      streaming: false,
      messages: buildWidgetSynthesisPrompt(input),
    });
    return parseRenderIntentSpec(response);
  };
}
