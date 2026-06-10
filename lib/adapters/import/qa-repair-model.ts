// qa-repair-model —— QaModelPort 的 prod 适配器。
// 把"调真实模型"收敛在这里：用用户当前会话模型配置 + QA prompt 走非流式 invokeLLM，
// 解析出待校验的 patch 输出。invokeLLM 被注入，便于单测；prompt/parse 是纯函数。
import type { LLMConfig } from "@/lib/nodeflow/LLMNode/llm-config";
import { cleanModelCallConfig } from "@/lib/nodeflow/LLMNode/clean-model-call-config";
import { extractFirstJsonObject } from "@/lib/utils/extract-json";
import type { QaModelPort } from "./qa-repair";
import type { LlmQaInput } from "./repair-patch";

type ChatMessage = { role: string; content: string };

const SYSTEM_INSTRUCTION = [
  "You are an import QA assistant for DreamMiniStage.",
  "You receive import diagnostics for a compiled asset bundle and propose minimal, typed repair patches.",
  "Rules:",
  '- Output ONLY a JSON object of the shape {"patches": RepairPatch[]}. No prose, no markdown fences.',
  "- Each patch: { id, operation: 'add'|'replace'|'remove', targetPath, value (omit for remove), reason }.",
  "- targetPath MUST be a JSON Pointer starting with '/'. Only patch paths listed in repairablePaths.",
  "- Do NOT rewrite whole assets. Do NOT set a claimedRisk; risk is computed deterministically by the host.",
  '- If nothing should change, return {"patches": []}.',
].join("\n");

export function buildQaRepairPrompt(input: LlmQaInput): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_INSTRUCTION },
    { role: "user", content: JSON.stringify(input, null, 2) },
  ];
}

export function parseQaRepairResponse(text: string): unknown {
  const json = extractFirstJsonObject(stripCodeFence(text));
  if (!json) {
    throw new Error("QA repair response did not contain a JSON object.");
  }
  return JSON.parse(json);
}

export interface QaModelAdapterDeps {
  /** 非流式模型调用，返回完整文本（prod 传 LLMNodeTools.invokeLLM）。 */
  invokeLLM: (config: LLMConfig) => Promise<string>;
  /** 用户当前会话模型配置（modelName/apiKey/baseUrl/llmType/...）。 */
  baseConfig: LLMConfig;
}

export function createQaModelAdapter(deps: QaModelAdapterDeps): QaModelPort {
  return async (input) => {
    const response = await deps.invokeLLM({
      ...cleanModelCallConfig(deps.baseConfig),
      streaming: false,
      messages: buildQaRepairPrompt(input),
    });
    return parseQaRepairResponse(response);
  };
}

function stripCodeFence(value: string): string {
  return value
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}
