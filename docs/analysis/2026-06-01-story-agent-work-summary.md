# Story Agent work summary

Date: 2026-06-01
Last updated: 2026-06-04

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
- RenderIntent 白名单现在支持安全的 custom status dashboard JSON source，例如
  `<StatusDashboard>{...}</StatusDashboard>`；前提是 replacement 命中安全 `status-panel`
  HTML，且不包含 script/iframe/inline handler/DOM access。
- `StatusPanelView` 支持结构化 `sections` 和 `meters`，custom dashboard 不再需要执行
  上游 HTML 才能展示多段状态和数值条。
- render contract 会按实际 source tag 注入，例如 `<StatusDashboard>`，并明确要求把
  dashboard 字段放入 `sections`、数值条放入 `meters`。
- status fallback 会沿用 custom status tag 合成 JSON，不再强制回退到 `<SFW>`。

价值：

- status/render contract 的失败模式从“用户看到裸 JSON”收敛为“运行时不渲染 raw source，
  导入时给出可审计诊断”。
- 已支持的 `<SFW>` status panel 仍走结构化 `RenderIntent`，不会被误报为 unsupported。
- custom status dashboard 的安全路径从“unsupported 或吞字段”推进到“JSON source -> 结构化
  `RenderIntent` -> sections/meters UI”，仍拒绝不安全 HTML。

### Story Agent render pipeline split

Commit: pending

完成内容：

- `MessageBubble` 新增显式 `renderMode`。
- Story Agent 消息由 `MessageItem` 根据 `character.extensions.storyBlueprintId` 进入 `story`
  render mode。
- `story` render mode 只走本地 narrative parser 和 `RenderIntentView`，不再调用 legacy async
  `RegexProcessor`。
- 普通角色消息继续使用 legacy render mode，保留既有 regex/html 行为边界。
- `ScriptSandbox` segments 仍被消息渲染链忽略，不会重新挂载脚本执行路径。

价值：

- Story Agent 输出现在和 legacy HTML/script processor 有明确运行时边界。
- 结构化 `RenderIntent` 继续承担 UI 语义，unsupported HTML/script assets 仍应留在 import
  diagnostics，而不是进入 runtime 执行。

### MVU static variable convention extraction

Commit: pending

完成内容：

- Import bundle 现在区分 supported / unsupported extension artifacts。
- 静态 extension variable convention 会被提取为 supported `variable-convention` artifact。
- 支持从 MVU replay-style `initial` object 编译初始变量。
- 支持从 TavernHelper pair-list 的 `variables` object 编译初始变量。
- 带 `update` / `insert` 等 replay mutation 字段的 MVU artifact 仍保留 unsupported diagnostic；
  本轮只支持初始静态变量，不执行后续 mutation/replay 语义。

价值：

- 非 `[InitVar]` 的静态变量源现在也能 seed 到 `StorySession.storyState`。
- `status_current_variables` 仍由 DreamMiniStage runtime 注入，不回退到 TavernHelper/MVU 脚本。
- 未支持的 replay/update 语义不会被静默吞掉。

### Static state snapshot tags and state-source diagnostics

Commit: pending

完成内容：

- 支持从 `<status_current_variables>{...}</status_current_variables>` 静态 JSON 快照编译初始变量。
- 支持从 `<StoryState>{...}</StoryState>` 静态 JSON 快照编译初始变量。
- `{{get_message_variable::stat_data}}` 这类动态宏状态源会被识别为
  `story.initial_state.dynamic_source_unsupported`，不会被误当 JSON 解析。
- origin 这类 `<StatusDashboard>` / `<UnitCard>` 状态模板会被识别为
  `story.initial_state.template_only`，明确说明它只包含模板，没有静态初始变量值。
- 这些 state-source diagnostics 已进入导入预览 feature-loss 排序。

价值：

- 有真实 JSON 状态快照时可以导入；只有模板或动态宏时只诊断，不制造假状态。
- theater/origin 的状态源边界更清楚：runtime 仍只注入 DreamMiniStage 自己持有的
  `status_current_variables`。

### Browser state/render E2E evidence

Commit: pending

完成内容：

- 新增 `scripts/story-agent-browser-state-render-e2e.mjs`，覆盖真实浏览器导入、创建
  Story Agent、进入会话、连续三轮发送消息、捕获三次 model gateway request body。
- E2E 使用 Sgw3 card、明月秋青 preset、Sgw baseline regex 和一个安全 custom
  `<StatusDashboard>` regex fixture。
- mock model response 同时返回 narrative marker、`<SFW>`、`<StatusDashboard>` 和
  `<UpdateVariable>`，让浏览器路径验证 prompt contract、state update 和 UI rendering。
- `_.add` 现在支持 `[value, description]` tuple 变量，更新数值时保留描述文本。
- 相关证据沉淀在：
  `docs/analysis/2026-06-04-story-agent-browser-state-render-e2e.md`

价值：

- 长会话 state continuity 不再只停留在 runtime 单测，而是有浏览器级 request body 和
  screenshot 证据。
- `<SFW>`、custom dashboard `sections`、multi-section `meters` 都走 Story Agent
  结构化 renderer 展示。
- raw source tags、legacy `stat_data` echo、provider `apiKey` / `baseUrl` 都没有进入
  最终可见 UI 或浏览器请求体。

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
  - 255 test files
  - 2035 tests
- `build`: pass

本轮新增/定向验证：

- `pnpm vitest run lib/story-agent/render-intent/__tests__/runtime.test.ts components/__tests__/MessageBubble.streaming.test.tsx lib/story-agent/blueprint/__tests__/render-diagnostics.test.ts components/story-agent/import-wizard/__tests__/PreviewDetails.test.tsx`
- `pnpm vitest run lib/story-agent/blueprint/__tests__/compiler.test.ts lib/story-agent/runtime/__tests__/story-session.test.ts lib/story-agent/runtime/render/__tests__/status-fallback.test.ts lib/story-agent/runtime/__tests__/state-update.test.ts`
- `pnpm vitest run components/__tests__/MessageBubble.streaming.test.tsx components/__tests__/CharacterChatPanel.bridge.test.tsx components/__tests__/CharacterChatPanel.streaming.test.tsx components/__tests__/opening-selection.test.ts`
- `pnpm vitest run lib/story-agent/render-intent/__tests__/runtime.test.ts components/story-agent/render-intent/__tests__/RenderIntentView.test.tsx lib/story-agent/runtime/__tests__/story-session.test.ts lib/story-agent/runtime/render/__tests__/status-fallback.test.ts`
- `pnpm vitest run lib/adapters/import/__tests__/bundle-builder.test.ts lib/story-agent/blueprint/__tests__/initial-state.test.ts lib/story-agent/blueprint/__tests__/compiler.test.ts lib/adapters/import/__tests__/bundle-diagnostics.test.ts`
- `pnpm vitest run lib/story-agent/blueprint/__tests__/initial-state.test.ts lib/story-agent/blueprint/__tests__/compiler.test.ts components/story-agent/import-wizard/__tests__/PreviewDetails.test.tsx`
- `pnpm vitest run lib/story-agent/blueprint/__tests__/render-diagnostics.test.ts lib/story-agent/render-intent/__tests__/regex-classifier.test.ts components/story-agent/render-intent/__tests__/RenderIntentView.test.tsx lib/story-agent/render-intent/__tests__/runtime.test.ts lib/story-agent/runtime/render/__tests__/status-fallback.test.ts lib/story-agent/runtime/__tests__/story-session.test.ts`
- `pnpm vitest run lib/story-agent/runtime/__tests__/story-session-state-continuity.test.ts lib/story-agent/runtime/__tests__/story-session.test.ts`
- `pnpm vitest run function/dialogue/__tests__/story-turn-lifecycle.test.ts function/dialogue/__tests__/story-branch-policy.test.ts`
- `pnpm vitest run lib/story-agent/runtime/__tests__/state-update.test.ts`
- `APP_URL=http://localhost:3303 node scripts/story-agent-browser-state-render-e2e.mjs`
- `pnpm typecheck`
- `pnpm lint`

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

长会话 state/render 浏览器 E2E 已补充：

- 三轮真实 request body 中 `status_current_variables` block count 均为 `1`。
- `长崎素世.好感度` 在 request 前置状态中按 `0 -> 3 -> 5` 延续，第三轮响应后最终
  UI state snapshot 显示 `[6, description]`。
- `<SFW>` 和 custom `<StatusDashboard>` render contract 均进入 prompt。
- custom dashboard 的 `sections` / `meters` 在最终截图中可见。
- raw `<SFW>` / `<StatusDashboard>` / `<UpdateVariable>` tags 没有裸露到可见 UI。
- Story State snapshot 中的 tuple 变量以 `长崎素世.好感度` 可读字段展示，不再把
  `{"$meta": ...}` raw JSON 裸露到 UI。

证据：

- `docs/analysis/2026-06-04-story-agent-browser-state-render-e2e.md`
- `docs/analysis/artifacts/2026-06-04-story-agent-browser-state-render-initial.png`
- `docs/analysis/artifacts/2026-06-04-story-agent-browser-state-render-final.png`
- `docs/analysis/artifacts/2026-06-04-story-agent-browser-state-render-summary.json`
- `docs/analysis/artifacts/2026-06-04-story-agent-browser-state-render-request-1.json`
- `docs/analysis/artifacts/2026-06-04-story-agent-browser-state-render-request-2.json`
- `docs/analysis/artifacts/2026-06-04-story-agent-browser-state-render-request-3.json`

## 当前状态

已经关闭的 gap：

- 导入页缺少高信号诊断。
- `origin` 折叠 UI source tags 没有进入结构化 render path。
- Sgw `[InitVar]` 初始变量没有在首轮前 seed 到 `StorySession.storyState`。
- 世界上下文中的旧 `stat_data` 宏会和 runtime state memory 重复表达状态。
- unsupported status-like JSON source tags 会作为 feature-loss diagnostic 暴露。
- status-like source JSON 和 loose status JSON 不再进入 legacy HTML/parser 展示路径。
- Story Agent 助手消息不再调用 legacy async `RegexProcessor` 渲染路径。
- MVU replay-style `initial` object 和 TavernHelper `variables` object 会进入
  `StoryInitialState`。
- 静态 `<status_current_variables>` / `<StoryState>` JSON 快照会进入 `StoryInitialState`。
- 动态状态宏和状态模板现在会给 feature-loss diagnostic，不再静默忽略。
- 安全 custom status dashboard JSON source 能进入结构化 `RenderIntent`，并以 `sections` /
  `meters` 展示。
- 多轮 `<UpdateVariable>` state continuity 已有 runtime contract 覆盖：action-driven 输入、
  连续两轮状态更新、summary/memory 压缩后状态单次注入和最新值保持均已验证。
- 浏览器级长会话 state/render E2E 已覆盖 `<SFW>`、custom status dashboard、
  multi-section meters、三轮真实 prompt state continuity 和最终截图证据。
- regenerate/swipe/branch switch 策略已明确：当前 Story Agent 没有 branch-state replay，
  因此这些分支操作会 fail-fast，不允许在已有 `StorySession` 上静默污染 `StoryState`。

仍然保留的本地工作区状态：

- 分支：`main`
- 已提交到本地，尚未 push。
- 当前分支相对 `origin/main` ahead。
- `.playwright-mcp/` 是既有 untracked 临时目录，本轮没有提交也没有删除。

## 待完成工作

### 1. Broaden MVU state schema extraction

当前 Sgw `[InitVar]` 路径已打通，静态 extension `initial` / `variables`、静态
`<status_current_variables>` / `<StoryState>` JSON snapshot 也已能编译进 runtime state。
但 MVU 生态不止一种变量声明方式。

后续需要：

- 覆盖更多 card-specific variable schema。
- 将 theater/origin 的纯模板状态源继续保留为诊断，除非出现真实静态初始值。
- 保持 `status_current_variables` runtime-owned，不回退到上游宏或插件执行。
- 支持或明确诊断 MVU `update` / `insert` replay mutation 的长期语义。

### 2. Continue status/render contract coverage

现状：

- Sgw `<SFW>` status contract 已验证。
- origin collapsible dashboard 已验证。
- unsupported status-like JSON source tags 已有 import diagnostic 和 runtime strip 兜底。
- custom status dashboard JSON source 已有安全白名单、prompt contract、fallback 和 UI
  sections/meters 覆盖。
- `<SFW>`、custom status dashboard 和 multi-section meters 已有浏览器级 E2E 截图证据。
- theater 的纯 HTML/script dashboard 仍不会进入 runtime 执行路径。

后续需要：

- 继续把不安全 HTML/script dashboard 保留在 import diagnostics。

### 3. Guard Story Agent renderer isolation

现状：

- Story Agent 消息已通过 `story` render mode 和 legacy async parser 分离。
- `RenderIntent` 是结构化且可控的，legacy regex/html 行为保留在普通角色消息路径。

后续需要：

- 新增 Story Agent 展示入口时继续显式传入 `story` render mode。
- unsupported HTML/script assets 留在 import diagnostics，不进入 runtime 执行。
- 为 renderer boundary 保留回归测试，防止后续 UI 复用时重新走 legacy processor。

### 4. Strengthen long-session state behavior

现状：

- first-turn bootstrap 已验证。
- 多轮 `<UpdateVariable>` 应用后的 state continuity 已验证。
- action button 输入和 state update 的组合路径已验证。
- summary/memory 压缩后，`status_current_variables` 仍只注入一次且保持最新值。
- 浏览器级三轮 E2E 已验证真实 prompt 中 state snapshot 的连续性和最终 UI state snapshot。
- regenerate、swipe 和 branch switch 已接入 Story Agent branch policy：没有
  StoryState branch replay 前禁止影响当前 `StorySession`。

后续需要：

- 实现 StoryState branch replay/rebase 后，重新打开 regenerate/swipe/branch switch。

### 5. Clean repository hygiene items

后续可以单独处理：

- `.husky/pre-commit` 当前不是 executable，`git commit` 时被 Git 忽略。
- `.playwright-mcp/` 仍是 untracked 临时目录，需要确认是否保留、加入 ignore，或清理。
- 当前本地 commits 尚未 push，需要在下一次发布/同步阶段处理。

## 建议下一步优先级

1. 处理 MVU `update` / `insert` replay mutation 的长期语义。
2. 实现 StoryState branch replay/rebase，届时才能重新打开 regenerate/swipe/branch switch。
3. 继续把不安全 HTML/script dashboard 保留在 import diagnostics，不进入 runtime 执行。
4. 保持 renderer boundary 的回归测试，防止新增 Story Agent surface 时回流到 legacy processor。

这个顺序的原因很简单：用户可见的输出污染和 renderer coupling 已经封住核心路径，
浏览器级状态 UI 证据也已补齐。下一步应该处理需要真实 replay 语义的长期状态问题。
