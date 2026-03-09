# Code Quality Review: `codex/phase-1-model-runtime`

- Review target: `codex/phase-1-model-runtime`
- Base branch: `main`
- Review date: 2026-03-08
- Review scope: 代码质量、架构设计、硬性指标、测试覆盖
- Commits reviewed: `a9a1e17`, `5016035`, `bcd15d6`
- Diff stat: 47 files changed, +2187 / -344

## Executive Summary

前两轮 review 聚焦行为正确性（streaming 优先级、timeout 链路、context window 边界），
本轮 review 聚焦 **代码质量、架构健康度和项目硬性指标**。

核心结论：

1. **3 个文件超过 400 行硬性上限**，需要在合入前拆分。
2. 架构方向正确 — 单一运行时模块收口模型配置、三层优先级解析、Preset 导入适配器都是好的抽象。
3. 存在若干可消除的坏味道（冗余包装、stale 闭包、重复归一化）。
4. 核心路径测试覆盖不完整。

## Findings

---

### [P0] `function/dialogue/chat.ts` — 578 行，严重超限

- Location: `function/dialogue/chat.ts`
- 硬性指标: 每个代码文件不超过 400 行

#### Problem

文件 578 行。`handleStreamingResponse`（L429-577）独立占 150 行，
与主函数 `handleCharacterChatRequest` 职责分离清晰，
但仍然挤在同一个文件里。

#### Recommended Fix

拆分为两个文件：

```
function/dialogue/
├── chat.ts                 # handleCharacterChatRequest + 辅助函数
└── chat-streaming.ts       # handleStreamingResponse + StreamingParams
```

共享类型 `DialogueWorkflowResult` 和 `isDialogueWorkflowResult` 可以留在 `chat.ts`
并 re-export。

---

### [P1] `hooks/useModelSidebarConfig.ts` — 546 行，超限

- Location: `hooks/useModelSidebarConfig.ts`
- 硬性指标: 每个代码文件不超过 400 行

#### Problem

文件 546 行。`handleTestModel`（L382-458）是最大的单函数（77 行），
三种 LLM 类型的测试逻辑高度相似但各自硬编码。

#### Recommended Fix

将模型测试逻辑提取为独立模块：

```
hooks/
├── useModelSidebarConfig.ts         # 主 hook（~400 行）
└── useModelSidebarConfig/
    └── testModel.ts                 # handleTestModel 逻辑
```

或者进一步将 `handleGetModelList` 也一并提取，将 hook 主体压到 400 行以内。

---

### [P1] `lib/nodeflow/LLMNode/model-invokers.ts` — 422 行，超限

- Location: `lib/nodeflow/LLMNode/model-invokers.ts`
- 硬性指标: 每个代码文件不超过 400 行

#### Problem

文件 422 行。`invokeGeminiModel` 中 MVU 工具的 Gemini 格式转换（L314-334）
是一段独立的数据结构映射，可以提取。

#### Recommended Fix

将 Gemini MVU 工具格式转换提取为函数或移入 `lib/mvu/function-call.ts`：

```typescript
// lib/mvu/function-call.ts
export function toGeminiMvuToolDeclaration() { ... }
```

这样 `model-invokers.ts` 可以压到 400 行以内，
同时 MVU 工具定义也实现了"一处定义、多处消费"。

---

### [P1] `resolveModelAdvancedSettings` 存在冗余归一化

- Location: `lib/model-runtime.ts:221-247`

#### Problem

```typescript
export function resolveModelAdvancedSettings(input) {
  const request = normalizeModelAdvancedSettings(input.request);   // 第 1 次
  const session = normalizeModelAdvancedSettings(input.session);   // 第 2 次
  const preset  = normalizeModelAdvancedSettings(input.preset);    // 第 3 次

  return normalizeModelAdvancedSettings({                          // 第 4 次（冗余）
    temperature: pickDefined(request.temperature, ...),
    ...
  });
}
```

内层三次 normalize 已经确保所有值合法，
`pickDefined` 只是从合法值中选第一个非 undefined 的，
外层的第 4 次 normalize 对已经合法的值不会产生任何变化。

#### Recommended Fix

移除外层 normalize，或加注释标明这是防御性设计：

```typescript
// 防御性 normalize：确保即使 pickDefined 逻辑变更，输出仍然合法
return normalizeModelAdvancedSettings({ ... });
```

---

### [P2] `useApiConfig` 中无意义的间接包装

- Location: `hooks/useApiConfig.ts:211-213`

#### Problem

```typescript
function syncConfigToStorage(config: APIConfig): void {
  syncModelConfigToStorage(config);
}
```

一个只调用另一个函数的包装，没有任何额外逻辑。
增加了认知成本但没有实际价值。

#### Recommended Fix

直接使用 `syncModelConfigToStorage`，移除 `syncConfigToStorage`。

---

### [P2] `syncModelConfigToStorage` 双写 key 缺注释

- Location: `lib/model-runtime.ts:266-298`

#### Problem

同时写入通用 key（`modelName`, `modelBaseUrl`, `llmType`）
和 type-specific key（`openaiModel`, `openaiBaseUrl` 等）。

这种双写是为了兼容遗留代码的读取路径，
但没有任何注释说明哪些 key 是遗留兼容、哪些是规范 key、
以及何时可以清理遗留 key。

#### Recommended Fix

在函数头部加注释：

```typescript
/**
 * 同步模型配置到 localStorage
 *
 * 写入两类 key：
 * - 规范 key：llmType, modelName, modelBaseUrl（供新代码读取）
 * - 遗留 key：openaiModel, openaiBaseUrl 等（供尚未迁移的旧代码读取）
 *
 * TODO: 遗留 key 在所有读取方迁移到 model-store 后可移除
 */
```

---

### [P2] `handleConfigSelect` 闭包 stale configs

- Location: `hooks/useApiConfig.ts:94-116`

#### Problem

```typescript
const handleConfigSelect = useCallback(async (configId: string) => {
  // ...
  if (!selectedConfig.availableModels) {
    const models = await fetchAvailableModels(selectedConfig);  // await
    updateConfig(configId, { availableModels: models });
  }

  const configForUse = configs.find((c) => c.id === configId) || selectedConfig;
  // ↑ await 之后，configs 可能已经被新的 render 更新
```

`configs` 是 useCallback 闭包捕获的值。
`await fetchAvailableModels` 之后，组件可能已经 re-render，
闭包中的 `configs` 仍是旧值。

#### Recommended Fix

在 await 之后使用 `useModelStore.getState().configs` 获取最新值：

```typescript
const freshConfigs = useModelStore.getState().configs;
const configForUse = freshConfigs.find((c) => c.id === configId) || selectedConfig;
```

---

### [P2] 测试覆盖不完整

- Location: `lib/__tests__/model-runtime.test.ts`

#### Problem

当前测试覆盖了：
- storage key 分离
- provider 参数支持矩阵
- context window 裁剪的 5 个边界场景

缺失的核心路径测试：
- `syncModelConfigToStorage` — 写入 key 的正确性
- `resolveModelAdvancedSettings` — 三层优先级合并逻辑
- `convertPresetToModelAdvancedSettings` — ST preset 格式转换

`useModelSidebarConfig`（546 行的核心 hook）没有任何测试。
至少 `buildConfigDraft` 的配置构建逻辑应该有单测覆盖。

---

### [P3] 伪流式实现需文档标注

- Location: `function/dialogue/chat.ts:512-528`

#### Problem

流式模式实际上是先完整执行 workflow，再以 20 字符/10ms 的速度模拟分块输出：

```typescript
const chunkSize = 20;
// ...
await new Promise(resolve => setTimeout(resolve, 10));
```

用户会经历完整的 workflow 等待时间后才看到输出开始"流式"出现。
这不是真正的流式，而是 buffered chunked delivery。

#### Recommended Fix

在 `handleStreamingResponse` 头部或 README 中标注：

```
当前流式模式为 buffered chunked delivery：
先完整执行 workflow 获取响应，再分块通过 SSE 发送以模拟流式效果。
真正的逐 token 流式输出将在后续阶段实现。
```

同时建议将 `chunkSize = 20` 和 `delay = 10` 提取为命名常量。

---

## Architecture Assessment

### 好的设计

| 模块 | 评价 |
|------|------|
| `lib/model-runtime.ts` 类型系统 | `LLMType`, `ModelAdvancedSettings`, `APIConfig` 统一定义，`model-store` 和 `model-sidebar/types` 都从这里 re-export，单一真相源 |
| `resolveModelAdvancedSettings` 三层优先级 | request > session > preset 的 `pickDefined` 策略简洁、可测试 |
| `applyContextWindowToMessages` | 二分裁剪 + 必须保留最新用户消息的策略，在测试补充后能成为可靠的保护层 |
| Preset 导入适配器 | `prompt_order → group_id/position` 转换干净，`ImportAdapter` 接口可扩展 |
| `model-store.ts` Zustand 设计 | `persist` + `partialize` 组合正确，查询方法（`getActiveConfig`）避免了选择器重复 |
| `verify-stage-quality.mjs` | 简洁实用，串行执行 + 汇总报告，fail 后 exit 1 |

### 需要注意的趋势

| 趋势 | 风险 |
|------|------|
| `useModelSidebarConfig` 膨胀 | 当前 546 行且仍在增长，需要拆分策略 |
| localStorage 双写 | `syncModelConfigToStorage` 写入通用 key + type-specific key，遗留债务需要计划清理 |
| Hook 闭包 + 异步操作 | `useApiConfig.handleConfigSelect` 的 stale 问题可能在其他类似模式中复现 |

---

## Summary Table

| 优先级 | 类别 | 问题 | 文件 |
|--------|------|------|------|
| **P0** | 硬性指标 | 578 行，超过 400 行上限 | `function/dialogue/chat.ts` |
| **P1** | 硬性指标 | 546 行，超过 400 行上限 | `hooks/useModelSidebarConfig.ts` |
| **P1** | 硬性指标 | 422 行，超过 400 行上限 | `lib/nodeflow/LLMNode/model-invokers.ts` |
| **P1** | 冗余 | `resolveModelAdvancedSettings` 外层 normalize 冗余 | `lib/model-runtime.ts` |
| **P2** | 坏味道 | 无意义的 `syncConfigToStorage` 包装 | `hooks/useApiConfig.ts` |
| **P2** | 数据一致性 | 双写 key 缺注释，遗留清理无计划 | `lib/model-runtime.ts` |
| **P2** | 正确性 | `handleConfigSelect` 闭包 stale configs | `hooks/useApiConfig.ts` |
| **P2** | 测试覆盖 | 核心路径缺单测 | `lib/__tests__/model-runtime.test.ts` |
| **P3** | UX/文档 | 伪流式实现未标注 | `function/dialogue/chat.ts` |

## Verdict

架构方向正确，收口策略合理。**3 个文件超过 400 行硬性指标是合入前的阻塞项。**

建议修复顺序：

1. 拆分 `chat.ts` → `chat.ts` + `chat-streaming.ts`
2. 拆分 `useModelSidebarConfig.ts` → 提取 `testModel` 逻辑
3. 压缩 `model-invokers.ts` → 提取 Gemini MVU 工具转换
4. 补充 `resolveModelAdvancedSettings` / `syncModelConfigToStorage` 单测
5. 清理 P2 坏味道（间接包装、stale 闭包、冗余注释）

## Resolution Update（2026-03-09）

> 本文上半部分记录的是 review 时的代码质量状态；本节记录当前分支在修复后的落地结果。

- review 中确认成立的 code quality 项均已处理：
  - `function/dialogue/chat.ts` 已拆分为 `chat.ts`、`chat-shared.ts`、`chat-streaming.ts`
  - `hooks/useModelSidebarConfig.ts` 已拆出 `helpers.ts`、`model-list.ts`、`test-model.ts`
  - `lib/nodeflow/LLMNode/model-invokers.ts` 已把 Gemini MVU 工具声明提取到 `lib/mvu/function-call.ts`
  - `resolveModelAdvancedSettings` 已移除冗余外层 normalize
  - `useApiConfig` 已移除 `syncConfigToStorage` 空包装，并修复 `handleConfigSelect` 的 stale closure
  - `syncModelConfigToStorage` 已补充双写 key 注释
  - 伪流式实现已在 `chat-streaming.ts` 中明确标注为 buffered chunked delivery，并将 chunk size / delay 提取为命名常量
- 当前关键文件行数：
  - `function/dialogue/chat.ts`：251 行
  - `hooks/useModelSidebarConfig.ts`：384 行
  - `lib/nodeflow/LLMNode/model-invokers.ts`：400 行
  - `lib/model-runtime.ts`：397 行
- 已补充测试覆盖：
  - `lib/__tests__/model-runtime.test.ts`：新增 storage 同步、三层优先级合并、preset 映射断言
  - `hooks/__tests__/useModelSidebarConfig.helpers.test.ts`：新增 `buildConfigDraft` 与 `toFormAdvancedSettings` 断言
- 最新验证（2026-03-09）：
  - `pnpm vitest run lib/__tests__/model-runtime.test.ts hooks/__tests__/useModelSidebarConfig.helpers.test.ts hooks/character-dialogue/__tests__/useDialoguePreferences.test.ts function/dialogue/__tests__/chat-first-message.test.ts components/__tests__/CharacterChatPanel.bridge.test.tsx lib/workflow/__tests__/dialogue-workflow-validation.test.ts`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm verify:stage`
- 当前结论：本轮 review 指出的 code quality 阻塞项在本地已完成闭环修复，阶段分支可继续进入 PR 准备。
