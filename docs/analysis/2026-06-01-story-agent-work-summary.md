# Story Agent work summary

Date: 2026-06-01

## 背景

本轮工作围绕 Story Agent 的 SillyTavern 语义迁移继续推进，重点不是复刻
SillyTavern 插件运行时，而是把用户实际依赖的语义编译进 DreamMiniStage 自己的
`SessionBlueprint` 和 runtime。

主要目标：

- 让导入页暴露更清楚的语义损失与自动适配信息。
- 让 imported render intent 的来源与长内容展示更可审计。
- 让 MVU-style 初始变量在首轮用户输入前进入 Story Agent runtime。
- 用浏览器 E2E 验证真实请求体，而不是只验证单元逻辑。

## 已完成工作

### Import diagnostics

Commit: `fee115a feat: surface story import diagnostics`

完成内容：

- `/story-agent-import` 现在会显示更高信号的导入诊断。
- 导入预览能展示生成的首条 opening，并解释哪些原始 opening 被判定为
  instruction-only。
- 相关证据沉淀在：
  `docs/analysis/2026-06-01-story-agent-import-diagnostics-e2e.md`

价值：

- 导入失败或语义损失不再只藏在内部结构里。
- 用户可以在创建 Agent 前看到实际 playable opening 和诊断来源。

### Collapsible render intents

Commit: `bbafe96 fix: attach collapsible render intents`

完成内容：

- `origin` card 的 collapsible UI source tags 能编译成结构化 `RenderIntent`。
- Opening 中的 `StatusDashboard`、`UnitCard`、`MissionProtocol` 类折叠面板可以通过
  DreamMiniStage 自己的 renderer 展示。
- 相关证据沉淀在：
  `docs/analysis/2026-06-01-story-agent-origin-collapsible-render-e2e.md`

价值：

- 原本会作为原始标签或混乱文本泄漏的 UI 语义，现在进入结构化展示路径。
- 这继续验证了“导入为本地结构，而不是执行上游插件代码”的方向。

### MVU initial state bootstrap

Commit: `9696e8c feat: seed story initial state`

完成内容：

- 新增 `lib/story-agent/blueprint/initial-state.ts`。
  - 从 world book `[InitVar]` 条目提取初始变量。
  - 支持 `<initvar>...</initvar>` 和 fenced JSON code block。
  - 只解析 JSON object，不执行第三方脚本。
  - disabled `[InitVar]` 条目也会被识别，因为上游 MVU 变量定义常以 disabled world
    entry 的形式存在。
- 新增 `lib/story-agent/runtime/state/initial.ts`。
  - 创建会话时把 `SessionBlueprint.initialState.variables` clone 到
    `StorySession.storyState.variables`。
  - 保留最近的 initial-state parse errors，便于后续审计。
- `SESSION_BLUEPRINT_SCHEMA_VERSION` 升级到 `6`。
- `createStorySession` 现在要求 blueprint 带 `initialState`。
- 编译 world entry 时移除旧的状态回显：
  `{{get_message_variable::stat_data}}`
- 保留 `好感度变量更新规则` 和 `<UpdateVariable>` policy 文本。

价值：

- 首轮用户输入前，Sgw 这类卡的好感度初始变量已经进入 runtime。
- 模型请求中只有 runtime-owned `[Session memory]` 提供真实状态快照。
- world context 不再重复携带旧宏状态源，降低双状态源导致的漂移风险。

### Status/render contract hardening

Commit: pending

完成内容：

- `stripRenderIntentSources` 现在会清理未匹配到 `RenderIntent` 的 status-like JSON
  source tags，例如 `<CurrentState>{...}</CurrentState>`、裸 `<status>{...}</status>`、
  `<SFW>{...}</SFW>` / `<NSFW>{...}</NSFW>`。
- 对模型直接吐出的 loose status JSON payload 增加兜底清理，避免 status JSON 作为故事正文裸露。
- `MessageBubble` 的 streaming / transition preview 改为展示已清洗文本，不再短暂暴露 source
  tag JSON。
- Blueprint 编译期新增 `render.status_contract_unsupported` 诊断：当导入内容声明
  status-like JSON source tag 但没有对应的 compiled `RenderIntent` 时，导入预览会把它当作
  feature-loss 展示。

价值：

- status/render contract 的失败模式从“用户看到裸 JSON”收敛为“运行时不渲染 raw source，
  导入时给出可审计诊断”。
- 已支持的 `<SFW>` status panel 仍走结构化 `RenderIntent`，不会被误报为 unsupported。

## 验证结果

### Automated gate

最后一次完整阶段门禁：

```bash
pnpm verify:stage
```

结果：

- `lint`: pass
- `typecheck`: pass
- `test`: pass
  - 246 test files
  - 1997 tests
- `build`: pass

本轮新增/定向验证：

- `pnpm vitest run lib/story-agent/render-intent/__tests__/runtime.test.ts components/__tests__/MessageBubble.streaming.test.tsx lib/story-agent/blueprint/__tests__/render-diagnostics.test.ts components/story-agent/import-wizard/__tests__/PreviewDetails.test.tsx`
- `pnpm vitest run lib/story-agent/blueprint/__tests__/compiler.test.ts lib/story-agent/runtime/__tests__/story-session.test.ts lib/story-agent/runtime/render/__tests__/status-fallback.test.ts lib/story-agent/runtime/__tests__/state-update.test.ts`

### Browser E2E

E2E 目标：

- 从 `/story-agent-import` 真实上传 `test-baseline-assets/character-card/Sgw3.png`。
- 创建 Story Agent。
- 进入会话。
- 使用 OpenAI-compatible `deepseek-v4-pro` config。
- mock `**/api/model-gateway/chat-completions` 响应，避免外部模型随机性。
- 捕获 DreamMiniStage 实际发出的首轮 request body。

核心断言：

```json
{
  "containsInitialRelationshipState": true,
  "containsFirstTurnSessionMemory": true,
  "containsUpdateVariableRule": true,
  "containsUnresolvedHandlebarMacros": false,
  "containsLegacyStatDataEcho": false,
  "actualStateSnapshotBlockCount": 1,
  "worldContextContainsActualStateSnapshot": false,
  "worldContextContainsLegacyEcho": false,
  "sessionMemoryContainsStateSnapshot": true
}
```

证据：

- `docs/analysis/2026-06-01-story-agent-initial-state-e2e.md`
- `docs/analysis/artifacts/2026-06-01-story-agent-initial-state-e2e.png`
- `docs/analysis/artifacts/2026-06-01-story-agent-initial-state-request-body.json`
- `docs/analysis/artifacts/2026-06-01-story-agent-initial-state-e2e-summary.json`

## 当前状态

已经关闭的 gap：

- 导入页缺少高信号诊断。
- `origin` 折叠 UI source tags 没有进入结构化 render path。
- Sgw `[InitVar]` 初始变量没有在首轮前 seed 到 `StorySession.storyState`。
- 世界上下文中的旧 `stat_data` 宏会和 runtime state memory 重复表达状态。
- unsupported status-like JSON source tags 会作为 feature-loss diagnostic 暴露。
- status-like source JSON 和 loose status JSON 不再进入 legacy HTML/parser 展示路径。

仍然保留的本地工作区状态：

- 分支：`main`
- 已提交到本地，尚未 push。
- 当前分支相对 `origin/main` ahead。
- `.playwright-mcp/` 是既有 untracked 临时目录，本轮没有提交也没有删除。

## 待完成工作

### 1. Broaden MVU state schema extraction

当前 Sgw `[InitVar]` 路径已打通，但 MVU 生态不止一种变量声明方式。

后续需要：

- 覆盖更多 card-specific variable schema。
- 识别 theater/origin 等卡族是否有非 `[InitVar]` 的变量定义模式。
- 保持 `status_current_variables` runtime-owned，不回退到上游宏或插件执行。
- 对无法解析的变量定义给 import diagnostics，而不是静默忽略。

### 2. Continue status/render contract coverage

现状：

- Sgw `<SFW>` status contract 已验证。
- origin collapsible dashboard 已验证。
- unsupported status-like JSON source tags 已有 import diagnostic 和 runtime strip 兜底。
- theater 有 state/action UI，但 custom status contract 仍不完整。

后续需要：

- 扩展 RenderIntent whitelist，但保持安全边界清楚。
- 为 `<SFW>`、custom status dashboard、multi-section meters 增加更系统的 E2E。

### 3. Split Story Agent renderer from legacy HTML/script rendering

现状：

- Story Agent 消息仍会经过 `MessageBubble` 的 legacy render pipeline。
- `RenderIntent` 是结构化且可控的，但旧 HTML/tag/script 路径仍在同一条渲染链附近。

后续需要：

- Story Agent 输出只进入 narrative + `RenderIntent` renderer。
- legacy HTML/script 行为保持在非 Story Agent 路径。
- unsupported HTML/script assets 留在 import diagnostics，不进入 runtime 执行。

### 4. Strengthen long-session state behavior

本轮验证的是 first-turn bootstrap。

后续需要：

- 多轮验证 `<UpdateVariable>` 应用后的 state continuity。
- 验证 regenerated/swiped message 对 story state 的影响策略。
- 验证 summary/memory 压缩后状态不丢失、不重复。
- 验证 action button 输入和 state update 的组合路径。

### 5. Clean repository hygiene items

后续可以单独处理：

- `.husky/pre-commit` 当前不是 executable，`git commit` 时被 Git 忽略。
- `.playwright-mcp/` 仍是 untracked 临时目录，需要确认是否保留、加入 ignore，或清理。
- 当前本地 commits 尚未 push，需要在下一次发布/同步阶段处理。

## 建议下一步优先级

1. 先做 unmatched status/render contract 的 hardening，避免裸 JSON 或 unsupported UI
   混入故事正文。
2. 再扩展 MVU schema extraction，覆盖非 Sgw 卡族。
3. 然后拆 Story Agent renderer 和 legacy HTML/script renderer。
4. 最后补多轮 state continuity E2E，把 first-turn bootstrap 扩展成长会话稳定性验证。

这个顺序的原因很简单：先封住用户可见的输出污染，再扩大语义覆盖，最后降低架构层面的长期耦合。
