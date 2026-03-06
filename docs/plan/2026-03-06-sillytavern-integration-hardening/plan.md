# SillyTavern 集成加固计划（2026-03-06）

> 来源：`docs/analysis/sillytavern-gap-report-latest.md` + `docs/plan/2026-03-05-sillytavern-gap-closure/handoff.md`

## 1. 背景

- slash command coverage 已达到 `426/426 = 100.00%`。
- Script Bridge API matrix 与 TavernHelper facade 均已达到 `100.00%`。
- 当前主要风险已不再是“命令是否存在”，而是“命令是否在真实宿主路径中完整走通”。
- 最新收口命令 `proxy / yt-script / floor-teleport` 已完成 registry + context + unit contract，对应宿主 wiring 与页面级行为仍需验证。

## 2. 本阶段目标

- 将当前“命令面完整”推进到“真实宿主路径可验证”。
- 清除 `registry -> execution context -> useScriptBridge -> host callback -> /session UI` 链路中的注入漂移。
- 建立组件级、页面级、E2E 级三层集成测试守卫，避免后续继续出现“adapter 支持但宿主未接”的回归。

## 3. 范围

### 3.1 In Scope

- `components/CharacterChatPanel.tsx` 的 Script Bridge 宿主注入位补齐。
- `hooks/useScriptBridge.ts` 与 `hooks/script-bridge/slash-context-adapter.ts` 的透传一致性校验。
- `/session` 页面路径的高价值 slash 命令集成测试。
- 现有 Playwright replay 基础设施的扩展与最小落地。

### 3.2 Out of Scope

- 继续新增 slash 命令覆盖率条目。
- 修改 `sillytavern-plugins/*` 外部仓逻辑。
- 为低优先级 UI 细节补兼容兜底。

## 4. 里程碑

### M1：宿主注入闭环

目标：先把 wiring 补齐，再谈更高层集成验证。

- 审计并补齐 `components/CharacterChatPanel.tsx` 透传位：
  - `onOpenTemporaryChat`
  - `onTranslateText`
  - `onGetYouTubeTranscript`
  - `onSelectProxyPreset`
  - `onGetWorldInfoTimedEffect`
  - `onSetWorldInfoTimedEffect`
- 审计 `/session` 页面是否为上述能力提供真实实现；未接通的能力必须显式 fail-fast，不允许静默空转。
- 新增一条“注入位透传完整性”契约测试：覆盖 `UseScriptBridgeOptions -> ApiCallContext -> ExecutionContext` 的关键能力映射。

验收：

- 关键注入位在组件边界可见、在 Hook 边界可见、在 Slash 执行上下文可见。
- 对应契约测试可直接阻止漏传回归。

### M2：组件级 / 页面级集成测试

目标：用最小成本验证真实使用路径，而不是继续堆单元测试。

优先验证场景：

- `/tempchat`
- `/translate`
- `/proxy`
- `/yt-script`
- `/wi-get-timed-effect`
- `/wi-set-timed-effect`
- `/floor-teleport`

测试分层：

- 组件级：`CharacterChatPanel` + `useScriptBridge` + mocked host callbacks。
- 页面级：`/session` 真实页面装配，验证 slash 输入、状态变化、错误回显、消息定位与刷新保持。

验收：

- 关键场景均能在页面路径触发正确宿主回调。
- 缺宿主能力时，页面层能稳定暴露 fail-fast，而不是无响应。

### M3：E2E / Replay 收敛

目标：把已存在的 Playwright 基础设施转成真正的回归门。

- 复用 `scripts/p4-session-replay-e2e.mjs` 与 `scripts/p4-playwright-preflight.sh`。
- 增补至少一轮面向 `/session` 的 replay case，覆盖：
  - slash 直达执行
  - refresh 后状态保持
  - session 隔离
  - 宿主缺失时错误链路
- 将产物写入现有 artifacts 目录，保持与既有 P4 产物结构一致。

验收：

- 至少一条新 replay case 稳定通过并产出 artifact。
- 失败时能直接定位到页面 wiring、bridge 转发或宿主实现层。

## 5. 执行顺序

1. 先做 M1，不跳步。
2. M1 完成后，再做 M2 的组件级集成测试。
3. 页面级测试稳定后，再扩到 M3 的 Playwright replay。
4. 若在 M1/M2 中发现真实宿主能力缺失，可以补实现；但禁止借机扩散到新命令簇。

## 6. 验证门禁

- `pnpm typecheck`
- `pnpm vitest run hooks/script-bridge/__tests__/api-surface-contract.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-api-command-gaps.test.ts lib/slash-command/__tests__/p2-chat-command-gaps.test.ts lib/slash-command/__tests__/p3-extension-command-gaps.test.ts`
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts`
- `pnpm analyze:sillytavern-gap`
- `pnpm p4:preflight`
- `pnpm p4:session-replay`（进入 M3 后启用）

## 7. 完成定义（DoD）

- `CharacterChatPanel` 不再丢失高价值宿主注入位。
- 存在一条专门守护 bridge 注入完整性的契约测试。
- 关键命令在组件级 / 页面级路径都有集成测试覆盖。
- 至少一条 `/session` replay case 进入稳定回归集。
- handoff 与分析文档能明确回答：哪些能力已真实接通，哪些仍是显式 fail-fast。
