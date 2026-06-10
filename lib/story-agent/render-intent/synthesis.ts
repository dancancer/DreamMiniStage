// Render Intent Synthesis（见 ADR-0011）的安全地基：把"导入期分析 script-driven widget 得到的
// 声明式规格"校验并编译成白名单 RenderIntent。LLM 只产 RenderIntentSpec、绝不产可执行代码；
// 安全由这里的确定性校验保证（类比 repair-patch 的 typed patch + 校验）。
import {
  RENDER_INTENT_SCHEMA_VERSION,
  type RenderIntent,
  type RenderIntentKind,
} from "./types";

export interface RenderIntentSpecField {
  label: string;
  valueTemplate: string;
}

export interface RenderIntentSpecOption {
  id: string;
  labelTemplate: string;
  descriptionTemplate?: string;
  valueTemplate: string;
}

/** 导入期 widget 分析产出的声明式规格——描述渲染什么数据，不含任何可执行代码。 */
export interface RenderIntentSpec {
  kind: RenderIntentKind;
  title: string;
  /** 模型按约定吐出、承载数据的源 tag（如 StatusDashboard / SFW）。 */
  sourceTag: string;
  fields?: RenderIntentSpecField[];
  bodyTemplate?: string;
  collapsedLabel?: string;
  expandedLabel?: string;
  options?: RenderIntentSpecOption[];
}

export interface RenderIntentSpecValidation {
  valid: boolean;
  reasons: string[];
}

const WHITELIST_KINDS: RenderIntentKind[] = [
  "choice-list",
  "collapsible-panel",
  "status-panel",
  "state-panel",
];

export function validateRenderIntentSpec(spec: RenderIntentSpec): RenderIntentSpecValidation {
  const reasons: string[] = [];

  if (!WHITELIST_KINDS.includes(spec.kind)) reasons.push(`kind not in whitelist: ${spec.kind}`);
  if (!isSafeText(spec.title)) reasons.push("title carries markup/script");
  if (!isSafeTag(spec.sourceTag)) reasons.push(`unsafe sourceTag: ${spec.sourceTag}`);

  if (spec.kind === "status-panel") {
    if (!Array.isArray(spec.fields) || spec.fields.length === 0) {
      reasons.push("status-panel requires fields");
    } else {
      for (const field of spec.fields) {
        if (!field || !isSafeText(field.label) || !isSafeText(field.valueTemplate)) {
          reasons.push(`unsafe status field: ${field?.label}`);
        }
      }
    }
  } else if (spec.kind === "collapsible-panel") {
    if (!spec.bodyTemplate || !isSafeText(spec.bodyTemplate)) reasons.push("collapsible-panel needs a safe bodyTemplate");
    if (spec.collapsedLabel !== undefined && !isSafeText(spec.collapsedLabel)) reasons.push("unsafe collapsedLabel");
    if (spec.expandedLabel !== undefined && !isSafeText(spec.expandedLabel)) reasons.push("unsafe expandedLabel");
  } else if (spec.kind === "choice-list") {
    if (!Array.isArray(spec.options) || spec.options.length === 0) {
      reasons.push("choice-list requires options");
    } else {
      for (const option of spec.options) {
        const safe = option &&
          isSafeText(option.labelTemplate) &&
          isSafeText(option.valueTemplate) &&
          (option.descriptionTemplate === undefined || isSafeText(option.descriptionTemplate));
        if (!safe) reasons.push(`unsafe option: ${option?.id}`);
      }
    }
  } else if (spec.kind === "state-panel") {
    if (!spec.bodyTemplate && !spec.fields) {
      // state-panel renders the raw structured snapshot; sourceTag is enough.
    }
  }

  return { valid: reasons.length === 0, reasons };
}

export function compileRenderIntentSpec(spec: RenderIntentSpec, sourceScriptId: string): RenderIntent {
  const validation = validateRenderIntentSpec(spec);
  if (!validation.valid) {
    throw new Error(`Invalid RenderIntentSpec: ${validation.reasons.join("; ")}`);
  }

  const base = {
    schemaVersion: RENDER_INTENT_SCHEMA_VERSION,
    id: `${sourceScriptId}:${spec.kind}`,
    sourceScriptId,
    title: spec.title,
    confidence: 0.7,
  } as const;
  const sourcePattern = tagJsonPattern(spec.sourceTag);

  switch (spec.kind) {
    case "status-panel":
      return {
        ...base,
        kind: "status-panel",
        fields: (spec.fields ?? []).map((field) => ({ label: field.label, valueTemplate: field.valueTemplate })),
        dataTemplate: "$1",
        sourcePattern,
      };
    case "collapsible-panel":
      return {
        ...base,
        kind: "collapsible-panel",
        bodyTemplate: spec.bodyTemplate ?? "$1",
        collapsedLabel: spec.collapsedLabel ?? "展开",
        expandedLabel: spec.expandedLabel ?? "收起",
        sourcePattern,
      };
    case "choice-list":
      return {
        ...base,
        kind: "choice-list",
        // 不信任模型给的 option.id（可能含 raw tag/script 文本）；确定性生成稳定 id。
        options: (spec.options ?? []).map((option, index) => ({
          id: `choice-${index + 1}`,
          labelTemplate: option.labelTemplate,
          descriptionTemplate: option.descriptionTemplate,
          action: { type: "append-input", valueTemplate: option.valueTemplate },
        })),
      };
    case "state-panel":
      return { ...base, kind: "state-panel", dataTemplate: "$1", sourcePattern };
    default:
      throw new Error(`unreachable render intent kind: ${spec.kind as string}`);
  }
}

// 安全文本：不含尖括号（杜绝任何 markup）、不含 javascript: 协议、不含 inline 事件处理器。
// 允许 $1 / $json.path / 纯文本等安全模板。
function isSafeText(value: string): boolean {
  if (typeof value !== "string") return false;
  if (/[<>]/.test(value)) return false;
  if (/javascript:/i.test(value)) return false;
  if (/\bon[a-z]+\s*=/i.test(value)) return false;
  return true;
}

function isSafeTag(tag: string): boolean {
  return typeof tag === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(tag);
}

function tagJsonPattern(tag: string): string {
  return `<${tag}>\\s*(\\{[\\s\\S]*?\\})\\s*</${tag}>`;
}
