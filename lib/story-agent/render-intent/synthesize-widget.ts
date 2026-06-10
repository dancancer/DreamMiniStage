// NS-Phase 4.2 编排器（见 ADR-0011）：把 unsupported script-widget 交给导入期 LLM（注入的
// WidgetSynthesisModel 端口），产出 RenderIntentSpec → 经 4.1 确定性安全校验 → 编译成白名单
// RenderIntent。LLM 失败 / 输出非规格 / 规格不安全，一律降级为 reason（落 Import Diagnostic），
// 绝不让不安全内容进入渲染。prod 由调用方注入 model-gateway adapter，测试注入 fake。
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

  const validation = validateRenderIntentSpec(spec);
  if (!validation.valid) {
    return { reason: `unsafe or invalid spec: ${validation.reasons.join("; ")}` };
  }

  return { intent: compileRenderIntentSpec(spec, widget.scriptId) };
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
