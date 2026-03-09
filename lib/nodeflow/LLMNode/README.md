**一旦我所属的文件夹有所变化，请更新我**

# LLMNode/

LLM 调用节点。核心节点，负责调用各类 LLM API。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `LLMNode.ts` | 节点实现 | LLM 节点主逻辑 |
| `LLMNodeTools.ts` | 工具函数 | LLM 调用工具 |
| `model-invokers.ts` | 核心 | 各模型调用器实现 |

## 最新变更（2026-03-09）

- `model-invokers.ts` 中 Gemini 的 MVU 工具声明已提取到 `lib/mvu/function-call.ts`，模型调用器文件重新压回 400 行以内，同时保留同一份工具定义给 OpenAI/Gemini 复用。

## 之前变更（2026-03-08）

- `LLMNode.ts` 与 `LLMNodeTools.ts` 现已接收并执行上下文窗口、最大输出、top_p/top_k、penalty、timeout、max retries 等高级参数。
