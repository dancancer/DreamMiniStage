/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║          Instruction Mode 模板定义                                       ║
 * ║                                                                          ║
 * ║  内置主流本地模型的 chat format 模板                                       ║
 * ║  对齐 SillyTavern instruct mode 语义                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

/* ═══════════════════════════════════════════════════════════════════════════
   模板接口
   ═══════════════════════════════════════════════════════════════════════════ */

export interface InstructTemplate {
  /** 模板唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 适用模型系列 */
  modelHint: string;

  /** 系统消息前缀 */
  systemPrefix: string;
  /** 系统消息后缀 */
  systemSuffix: string;
  /** 用户消息前缀 */
  userPrefix: string;
  /** 用户消息后缀 */
  userSuffix: string;
  /** 助手消息前缀 */
  assistantPrefix: string;
  /** 助手消息后缀 */
  assistantSuffix: string;

  /** 最终助手前缀（待生成回复之前） */
  lastOutputPrefix: string;
  /** 模板触发的停止序列 */
  stopSequences: string[];
  /** 是否在序列开头添加 BOS token 标记 */
  wrapWithBos: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   内置模板
   ═══════════════════════════════════════════════════════════════════════════ */

const CHATML: InstructTemplate = {
  id: "chatml",
  name: "ChatML",
  modelHint: "Qwen, Yi, DeepSeek, OpenHermes",
  systemPrefix: "<|im_start|>system\n",
  systemSuffix: "<|im_end|>\n",
  userPrefix: "<|im_start|>user\n",
  userSuffix: "<|im_end|>\n",
  assistantPrefix: "<|im_start|>assistant\n",
  assistantSuffix: "<|im_end|>\n",
  lastOutputPrefix: "<|im_start|>assistant\n",
  stopSequences: ["<|im_end|>", "<|im_start|>"],
  wrapWithBos: "",
};

const LLAMA3: InstructTemplate = {
  id: "llama3",
  name: "Llama 3 / 3.1 / 3.2",
  modelHint: "Meta Llama 3.x",
  systemPrefix: "<|start_header_id|>system<|end_header_id|>\n\n",
  systemSuffix: "<|eot_id|>",
  userPrefix: "<|start_header_id|>user<|end_header_id|>\n\n",
  userSuffix: "<|eot_id|>",
  assistantPrefix: "<|start_header_id|>assistant<|end_header_id|>\n\n",
  assistantSuffix: "<|eot_id|>",
  lastOutputPrefix: "<|start_header_id|>assistant<|end_header_id|>\n\n",
  stopSequences: ["<|eot_id|>", "<|start_header_id|>"],
  wrapWithBos: "<|begin_of_text|>",
};

const LLAMA2: InstructTemplate = {
  id: "llama2",
  name: "Llama 2",
  modelHint: "Meta Llama 2",
  systemPrefix: "[INST] <<SYS>>\n",
  systemSuffix: "\n<</SYS>>\n\n",
  userPrefix: "[INST] ",
  userSuffix: " [/INST]",
  assistantPrefix: "",
  assistantSuffix: " </s>",
  lastOutputPrefix: "",
  stopSequences: ["[INST]", "</s>"],
  wrapWithBos: "<s>",
};

const MISTRAL: InstructTemplate = {
  id: "mistral",
  name: "Mistral / Mixtral",
  modelHint: "Mistral AI",
  systemPrefix: "[INST] ",
  systemSuffix: "\n",
  userPrefix: "[INST] ",
  userSuffix: " [/INST]",
  assistantPrefix: "",
  assistantSuffix: "</s>",
  lastOutputPrefix: "",
  stopSequences: ["[INST]", "</s>"],
  wrapWithBos: "<s>",
};

const ALPACA: InstructTemplate = {
  id: "alpaca",
  name: "Alpaca",
  modelHint: "Alpaca 微调模型",
  systemPrefix: "### Instruction:\n",
  systemSuffix: "\n\n",
  userPrefix: "### Input:\n",
  userSuffix: "\n\n",
  assistantPrefix: "### Response:\n",
  assistantSuffix: "\n\n",
  lastOutputPrefix: "### Response:\n",
  stopSequences: ["### Instruction:", "### Input:", "### Response:"],
  wrapWithBos: "",
};

const VICUNA: InstructTemplate = {
  id: "vicuna",
  name: "Vicuna 1.1",
  modelHint: "Vicuna, LMSys",
  systemPrefix: "",
  systemSuffix: "\n\n",
  userPrefix: "USER: ",
  userSuffix: "\n",
  assistantPrefix: "ASSISTANT: ",
  assistantSuffix: "</s>\n",
  lastOutputPrefix: "ASSISTANT: ",
  stopSequences: ["USER:", "</s>"],
  wrapWithBos: "",
};

const GEMMA: InstructTemplate = {
  id: "gemma",
  name: "Gemma / Gemma 2",
  modelHint: "Google Gemma",
  systemPrefix: "<start_of_turn>user\n",
  systemSuffix: "<end_of_turn>\n",
  userPrefix: "<start_of_turn>user\n",
  userSuffix: "<end_of_turn>\n",
  assistantPrefix: "<start_of_turn>model\n",
  assistantSuffix: "<end_of_turn>\n",
  lastOutputPrefix: "<start_of_turn>model\n",
  stopSequences: ["<end_of_turn>", "<start_of_turn>"],
  wrapWithBos: "",
};

const PHI: InstructTemplate = {
  id: "phi",
  name: "Phi-3 / Phi-4",
  modelHint: "Microsoft Phi",
  systemPrefix: "<|system|>\n",
  systemSuffix: "<|end|>\n",
  userPrefix: "<|user|>\n",
  userSuffix: "<|end|>\n",
  assistantPrefix: "<|assistant|>\n",
  assistantSuffix: "<|end|>\n",
  lastOutputPrefix: "<|assistant|>\n",
  stopSequences: ["<|end|>", "<|user|>", "<|system|>"],
  wrapWithBos: "",
};

const COMMAND_R: InstructTemplate = {
  id: "command-r",
  name: "Command-R",
  modelHint: "Cohere Command-R",
  systemPrefix: "<|START_OF_TURN_TOKEN|><|SYSTEM_TOKEN|>",
  systemSuffix: "<|END_OF_TURN_TOKEN|>",
  userPrefix: "<|START_OF_TURN_TOKEN|><|USER_TOKEN|>",
  userSuffix: "<|END_OF_TURN_TOKEN|>",
  assistantPrefix: "<|START_OF_TURN_TOKEN|><|CHATBOT_TOKEN|>",
  assistantSuffix: "<|END_OF_TURN_TOKEN|>",
  lastOutputPrefix: "<|START_OF_TURN_TOKEN|><|CHATBOT_TOKEN|>",
  stopSequences: ["<|END_OF_TURN_TOKEN|>"],
  wrapWithBos: "<BOS_TOKEN>",
};

/* ═══════════════════════════════════════════════════════════════════════════
   模板注册表
   ═══════════════════════════════════════════════════════════════════════════ */

const BUILTIN_TEMPLATES: InstructTemplate[] = [
  CHATML,
  LLAMA3,
  LLAMA2,
  MISTRAL,
  ALPACA,
  VICUNA,
  GEMMA,
  PHI,
  COMMAND_R,
];

const templateMap = new Map<string, InstructTemplate>(
  BUILTIN_TEMPLATES.map((t) => [t.id, t]),
);

/** 获取所有内置模板列表 */
export function getBuiltinTemplates(): readonly InstructTemplate[] {
  return BUILTIN_TEMPLATES;
}

/** 按 ID 获取模板 */
export function getTemplateById(id: string): InstructTemplate | undefined {
  return templateMap.get(id);
}
