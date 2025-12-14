# 消息拼装实现对比与改进建议

## 范围与参考
- SillyTavern 后端消息处理：`sillytavern-plugins/SillyTavern/src/prompt-converters.js:41`、`:77`、`:190`、`:792`；调用点：`sillytavern-plugins/SillyTavern/src/endpoints/backends/chat-completions.js:919`、`:1752`、`:1887`、`:2309`。
- 当前项目消息组装：`lib/core/prompt/manager.ts:164`、`:186`、`:329`、`:386`；消息类型定义：`lib/core/st-preset-types.ts:368`。

## SillyTavern 的实现特征（现象层）
- 统一的后处理入口 `postProcessPrompt`，支持 merge/semi/strict/single 等模式，将同角色消息合并、补齐占位、控制 system 位置，并可选择保留/剔除工具调用（`:77`）。
- 名称与群聊处理：`getPromptNames` 收集角色/用户/群成员名，`mergeMessages` 在合并前自动为示例/assistant/user 内容补前缀并移除 `name` 字段，避免重复或丢失说话人（`:41`、`:798`、`:820`、`:830`）。
- 多模态与工具：合并时先把 `content` 数组扁平化并用随机 token 保护图片/音视频，再在末尾还原（`:798-899`）；可将 `tool` 角色降级为 `user` 或保留工具调用（`:834-855`）。
- 严格模式与兜底：当消息为空或缺少 user 起始时填充占位符，强制第二条为 user，避免 API 报错或上下文错位（`:867-916`）；`addAssistantPrefix`/prefill 支持给最后一条 assistant 标记前缀，便于模型流式对齐（`:59`、`chat-completions.js:919`）。
- 模型定制化转换：如 `convertClaudeMessages` 将前置 system 拆出为独立数组、把中途 system 降级为 user、把工具调用转成 Claude 的 tool_use/tool_result 结构并重新合并角色轮次（`:190-347`）。

## 当前实现概览（现象层）
- 以 preset 顺序生成消息，支持 marker 展开、宏替换、按 depth/priority 注入 world-info（`lib/core/prompt/manager.ts:164-209`、`:329-372`）。
- 合并逻辑仅针对连续的 system 消息，且忽略 user/assistant，带 `name` 或在排除列表的 system 不参与合并（`:386-435`）。
- Sysprompt 通过直接拼接到首个 system 或插入 post_history system 消息实现（`:441-464`）。
- 消息类型仅支持纯文本 `content: string`，没有工具、多模态或 prefix/prefill 相关字段（`lib/core/st-preset-types.ts:368`）。

## 差异与问题（本质层）
- 缺少统一的后处理/规整阶段：当前 build 后直接返回，只有 system squash，未做角色合并、system 位置修正或占位补齐。对需要首条 user、拒绝中途 system 的模型（Perplexity/Claude 等）可能不兼容，也浪费 token（`manager.ts:164` 对应输出 vs SillyTavern `postProcessPrompt`/`mergeMessages:77/792`）。
- 工具/多模态缺席：`ChatMessage` 不支持 `tool_calls` 或数组内容，也无对应规整，无法安全透传或降级工具调用；多模态消息会在合并时丢失结构（`st-preset-types.ts:368` 对比 SillyTavern `prompt-converters.js:798-899`、`convertClaudeMessages:225-325`）。
- 说话人信息不稳：当前仅透传 `name`，未在内容层补前缀；若目标模型忽略 `name`（Claude/OpenRouter 部分路线），群聊示例会失去角色标识。SillyTavern 会在合并时写入前缀再移除 `name`（`prompt-converters.js:820-833`），我们缺少等价处理。
- 空提示缺少兜底：当 preset/macro 产出为空或仅 system 时，当前实现可能返回空数组，导致下游请求失败；SillyTavern 会插入占位 user 消息确保可用（`prompt-converters.js:867-873`）。
- Prefill/assistant 前缀未接线：虽暴露了 `getAssistantPrefill`，但消息构建未提供类似 `prefix` 标记，导致需要 prefill 的模型（DeepSeek 等）要在调用层额外拼接，缺乏一致入口（对比 `prompt-converters.js:59-68`、`chat-completions.js:919`）。
- Claude 等模型的 system 拆分/工具重排缺失：当前 sysprompt 仅拼接文本，没有将 system 独立数组或把 mid-system 降级为 user；Claude 消息 API 可能因此拒绝或解析错误。SillyTavern 在 `convertClaudeMessages:190-262` 做了拆分和降级处理。

## 改进建议（行动层）
1. 增加可配置的后处理管线（merge/strict/single），默认在 `buildMessages` 末尾调用，提供开关以适配不同模型；实现时复用简单的角色合并和占位补齐，避免过度分支。
2. 扩展 `ChatMessage` 类型为联合类型以支持 `content: string | Array<{type: 'text' | 'image_url' | ...}>` 与可选 `tool_calls`/`tool_call_id`，并在后处理阶段提供“保留/降级/剔除”策略。
3. 补充名称前缀规范化：在发送前将需要的 `name` 前缀写入 `content` 并移除 `name` 字段，至少为示例/群聊消息提供可选开关，保障忽略 `name` 的模型仍能辨别说话人。
4. 兜底保护：如果最终消息为空或首条非 user，插入占位 user 消息，确保兼容要求“用户开头”的 API。
5. Prefill/assistant 前缀统一入口：在构建结果上为最后一条 assistant 增加 `prefix/prefill` 属性（或追加一条空 assistant），由调用层根据模型决定是否发送，避免每个后端重复实现。
6. 为 Claude/OpenRouter 等模型新增轻量转换器：至少拆分前置 system 与后续 user/assistant，必要时将 mid-system 降级为 user，并处理工具调用到模型期望的格式。
7. 补齐测试：为 merge/strict/placeholder/名前缀等场景添加 Vitest 用例，确保字符串与多模态路径都覆盖（遵循 `pnpm vitest run <file>`）。

## 设计基调（哲学层）
- 优先用“消除特殊情况”的数据结构：通过统一后处理消除多分支，再按模型开关启用/禁用特性。
- 函数保持单一职责：后处理拆分为“角色合并”“名称规范化”“工具/多模态策略”“占位兜底”四个小函数，组合形成管线，便于测试与裁剪。
- 面向真实需求演进：先补足占位/合并/前缀等最易出错的基础，再按需要添加 Claude/工具/多模态转换，避免一次性大改。
