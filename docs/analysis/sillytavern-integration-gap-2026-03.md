# DreamMiniStage 对齐审计（SillyTavern + JS-Slash-Runner + MagVarUpdate）

> 审计日期：2026-03-02
>
> 目标基线：
> - SillyTavern `fbf789fa7`
> - JS-Slash-Runner `9779129`
> - MagVarUpdate `2396984`

## 1. 审计范围与方法

本次审计基于以下路径做静态对比与回归验证：

- 当前项目：`lib/`、`hooks/script-bridge/`、`public/iframe-libs/`、`function/dialogue/`
- 目标项目：`sillytavern-plugins/SillyTavern/`、`sillytavern-plugins/JS-Slash-Runner/`、`sillytavern-plugins/MagVarUpdate/`
- 回归验证：`pnpm vitest run`（当前通过）

## 2. 当前状态快照（事实）

### 2.1 稳定性基线

- 当前仓库测试通过：`96` 个测试文件，`1284` 个测试通过，`5` 个跳过。
- 结论：现有实现在当前契约下稳定，但与目标项目“无改动迁移”仍有差距。

### 2.2 已具备能力（可复用）

- Prompt 组装与后处理链路：`lib/core/prompt/manager.ts`、`lib/core/prompt/post-processor.ts`
- WorldBook 级联加载与高级匹配：`lib/core/world-book-cascade-loader.ts`、`lib/core/world-book-advanced.ts`
- Slash 执行内核：`lib/slash-command/core/parser.ts`、`lib/slash-command/core/executor.ts`
- Script Bridge 与 iframe shim：`hooks/script-bridge/index.ts`、`public/iframe-libs/slash-runner-shim.js`
- MVU 主链路：`lib/mvu/core/parser.ts`、`lib/mvu/core/executor.ts`、`lib/mvu/function-call.ts`

### 2.3 近期兼容层清理（开发分支）

- Script Bridge 变量写入已收敛到 `scopedVariables` 单路径，不再回写 legacy store。
- 流式工具调用解析仅保留 `tool_calls` 契约，移除 `function_call` 兼容分支。
- Regex 规范化仅接受当前枚举/结构，不再执行历史格式迁移。
- WorldBook 节点已切到 `messages[]` 单轨处理：
  - 删除 `WorldBookNodeTools.assemblePromptWithWorldBook`；
  - `WorldBookNode` 不再改写 `systemMessage/userMessage`；
  - Prompt Viewer 改为先构建 `messages[]` 再注入世界书。
- ContextNode 已收敛为纯中转节点：
  - 不再替换 `{{chatHistory}}` 字符串占位符；
  - 仅透传 `messages[]`。
- HistoryPreNode 已移除 `chatHistoryText` 输出：
  - 仅保留 `chatHistoryMessages` 与 `conversationContext`。
- LLMNode/LLMNodeTools 已移除字符串回退组装：
  - `messages[]` 为空时直接报错；
  - 不再自动补注入 fallback user 消息。
- RAG 记忆注入链路已切到 `messages[]`：
  - `MemoryRetrievalNode` 不再依赖 `systemMessage` 字符串输入；
  - 记忆命中后直接注入到 `messages[]` 的 system 段。
- PresetNode 已移除 `systemMessage/userMessage` 兼容输出：
  - Workflow 主链路仅保留 `messages[]` 与必要元信息（`presetId`）。
- Slash bridge 已移除 `triggerSlash` 的 options 覆盖分支：
  - 回调统一从 `ApiCallContext` 注入，避免双路径上下文来源。
- iframe shim 已移除 `window.getVariables/window.triggerSlash` 等顶层全局别名：
  - 统一保留 `window.TavernHelper` 与 `window.SillyTavern` 命名空间入口，减少双入口漂移。
- iframe shim 中未实现的群聊接口改为显式失败（fail-fast）：
  - `getGroupMembers` / `isGroupChat` 不再返回静默默认值，避免脚本误判能力可用。

## 3. 关键差距

## 3.1 SillyTavern 核心 Slash 生态

- 命令覆盖量存在明显差距：
  - SillyTavern 可检测命令：`258`
  - 当前项目（注册表 + 控制语法）：约 `74`
  - 交集：约 `30`
- 当前注册表主要覆盖基础命令与少量扩展：`lib/slash-command/registry/index.ts`
  - 最新已补齐的 P2 数学/字符串命令：`mul/div/mod/rand/split/join/replace(re)/pow/max/min`
  - 最新已补齐的变量命令族：`addvar/addglobalvar/setglobalvar/getglobalvar/incglobalvar/decglobalvar/flushglobalvar` 与 `*chatvar` 别名
- 缺失大量命令族（如 db / qr / profile / checkpoint / tools / ui 等），导致脚本直接迁移失败概率高。

## 3.2 JS-Slash-Runner 兼容差距

- 当前已接入 `/event-emit` 与 `audio*` 命令名，但语义尚未完全对齐：
  - 本地实现：`lib/slash-command/registry/handlers/js-slash-runner.ts`
  - 上游实现：`sillytavern-plugins/JS-Slash-Runner/src/slash_command/audio.ts`
- 典型语义差异：
  - 上游 `audioplay` 是对 `bgm|ambient` 播放状态控制；当前实现更偏 URL 播放。
  - 上游 `audiomode` 使用 `repeat/random/single/stop`；当前实现使用 `single/loop/queue`。
- TavernHelper 能力面仍不完整：
  - shim 暴露了大量兼容入口（`public/iframe-libs/slash-runner-shim.js`）
  - 但与上游聚合 API（`src/function/index.ts`）相比，extension 管理、raw import、脚本按钮、版本管理等仍缺。

## 3.3 MagVarUpdate 兼容差距

- 变量 API 参数语义已补齐常见路径：
  - `mvu.getVariable/mvu.getVariables` 支持 `{ type, message_id }`（含 `latest`、负索引、数字字符串）
  - 覆盖测试：`hooks/script-bridge/__tests__/mvu-handlers-option-semantics.test.ts`
- 命令框架已落地，但值解析语义未等价：
  - 当前 `parseCommandValue` 仅覆盖基础 JSON/数字/简算：`lib/mvu/core/parser.ts`
  - 上游包含更完整的 mathjs/YAML 场景：`sillytavern-plugins/MagVarUpdate/src/function.ts`
- Schema 元信息兼容不完整：
  - 当前主链路未完整覆盖 `strictSet`、`strictTemplate`、`concatTemplateArray` 的等价行为
  - 相关代码：`lib/mvu/types.ts`、`lib/mvu/core/schema.ts`
- 函数调用路径可用，但仍偏最小实现：
  - 工具定义/转换存在：`lib/mvu/function-call.ts`
  - 缺少上游那套更细粒度策略开关与治理约束。

## 4. 分阶段改进方案

### Phase A：先打通可迁移最短路径

1. 明确定义兼容等级（L1/L2/L3）和每级验收标准。
2. 补齐高频命令族（优先真实脚本高使用率，而非一次性追满 258）。
3. 对齐 `audio*` 命令参数签名与行为语义。

### Phase B：插件 API 等价层

1. 以 `JS-Slash-Runner/src/function/index.ts` 作为 API 白名单矩阵。
2. 在 `hooks/script-bridge/` 补齐缺失 handler，并统一错误返回契约（避免 timeout 型失败）。
3. 补足 `registerFunctionTool/registerSlashCommand` 的全生命周期测试（注册、调用、卸载、iframe 清理）。
   - 当前已补最小回归：`hooks/script-bridge/__tests__/extension-lifecycle.test.ts`（注册、调用、清理、再注册）。

### Phase C：MagVarUpdate 行为等价

1. 扩展 `parseCommandValue`（mathjs、YAML、日期/数值边界行为）。
2. 将 `strictSet/strictTemplate/concatTemplateArray` 从类型到执行器全链路贯通。
3. 引入上游样例的 golden tests（`example` / `example_src`）。

### Phase D：稳定性与可维护性

1. 建立兼容性快照测试（目标版本变化可追踪）。
2. 合并 shim API、script-bridge handler、slash registry 的能力声明为单一来源。
   - 当前已落地首版：`hooks/script-bridge/capability-matrix.ts` + `api-surface-contract.test.ts` 契约校验。
3. 清理重复入口（尤其 audio/event/variables）以降低回归面。

## 5. 验收指标建议

- M1：代表性脚本无改动迁移成功率 >= 80%（至少 10 个样本）。
- M2：JS-Slash-Runner 关键 API 覆盖 >= 90%（按函数名统计）。
- M3：MagVarUpdate 示例变量链路全通过（文本块 + function-calling）。
- M4：兼容性回归进入 CI，版本升级可量化评估。
