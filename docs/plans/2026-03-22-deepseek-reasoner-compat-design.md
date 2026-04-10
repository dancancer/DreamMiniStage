# DeepSeek Reasoner 兼容设计

**目标**
- 为 `deepseek-reasoner` 增加发送前消息正规化，满足更严格的 chat-completions 约束，同时不影响其他模型。

**问题本质**
- 当前运行时后处理是通用的，不能保证在 `deepseek-reasoner` 下始终采用最严格的首条 `user` 约束。
- 社区插件 `NoAss` 通过把整段历史压成一条消息绕过约束，但会损失原生多轮消息结构。
- `thinkingContent` / `reasoning_content` 本应属于展示层 side-channel，不应参与历史回传。

**方案**
- 在 `lib/nodeflow/LLMNode/runtime-helpers.ts` 增加 `deepseek-reasoner` 专用正规化：
  - 强制按 `STRICT` 规则做后处理。
  - 发送前剥离历史里的推理相关元数据（容忍运行时脏字段）。
  - 对非首条 `system` 降级后的连续同角色消息再次合并，确保交替结构稳定。
  - 记录一次简洁日志，说明是否发生修正。
- 保持原有 `messages[]` 多轮结构，不采用 `NoAss` 的单消息压缩方案。

**边界**
- 仅对 `llmType === "openai"` 且 `modelName` 命中 `deepseek-reasoner` 的请求生效。
- 其他模型沿用现有行为。
- 不改 UI 展示层 `thinkingContent` 的存储与渲染。

**测试**
- 新增 `normalizeMessages()` 单测，覆盖：
  - 自动切到严格起始 `user`。
  - 中途 `system` 被消化后仍保持交替。
  - 历史里的推理元数据被剥离。
  - 非 DeepSeek 模型不受影响。
