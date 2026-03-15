# Review Result: `codex/phase-5-js-slash-runner-host`

- Review target: `codex/phase-5-js-slash-runner-host`
- Base branch: `main`
- Merge base: `c9812a1b5cdd583d5023cab3fc8d03a5e18dfe47`
- Review date: `2026-03-13`
- Review verdict: **Phase 5 目标已完成，剩余仅为 PR 流程收口**

## Executive Summary

Phase 5 最重要的方向校准已经成立：

> 不再用“命令存在”冒充“产品宿主已完成”，而是用宿主能力矩阵、真实产品路径和可解释调试面来定义完成度。

这一阶段现在已经完成了三件关键事情：

1. 建立了 `JS-Slash-Runner` 宿主能力矩阵与 fail-fast 语义单源。
2. 把高价值宿主能力逐批拉通到 `/session` 页面真实宿主或共享默认宿主。
3. 让 Script Debugger 可以解释默认支持、条件支持、bridge-only 默认路径与 fail-fast 结果。

从产品语义看，Phase 5 已经收口。

当前没有新的功能阻塞项；阶段门也已经通过。剩余工作不再是继续补宿主骨架，而是：

- 整理提交边界
- 准备 PR 描述
- 完成分支到主干的流程收口

因此本轮最准确的结论是：

> **Phase 5 已完成实现目标，不应继续横向补命令覆盖；下一步应进入 PR 收口。**

## Validation Performed

本次 review 以当前文档、宿主矩阵实现和 fresh 阶段门结果为事实源，重点核对：

- `hooks/script-bridge/host-capability-matrix.ts`
- `hooks/script-bridge/host-debug-resolver.ts`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/phase5-host-capability-matrix.md`

已执行验证：

- `pnpm verify:stage`

验证结果：

- `lint` 通过
- `typecheck` 通过
- `vitest run` 通过
- `build` 通过
- 最终输出：`[verify:stage] Gate passed`

## What Is Complete

### 1. 宿主能力矩阵已经成为单一事实源

当前 `hooks/script-bridge/host-capability-matrix.ts` + `hooks/script-bridge/host-debug-resolver.ts` 已经明确描述：

- 默认支持
- 条件支持
- bridge-only 默认支持
- fail-fast 语义

同时，阶段总矩阵说明书已写入：

- `docs/plan/2026-03-08-sillytavern-product-roadmap/phase5-host-capability-matrix.md`

这意味着 Phase 5 最核心的定义问题已经解决：

> 用户和开发者都可以明确知道“什么支持、为什么支持、从哪条宿主路径支持”。

### 2. 高价值宿主路径已经真实落地

当前已经完成真实产品路径或共享默认宿主路径的能力包括：

- `tool-registration`
- `audio`
- `clipboard`
- `extension-state` 读路径
- `gallery`
- `navigation`
- `proxy`
- `quick-reply`
- `checkpoint`
- `group-member`
- `translation`
- `youtube-transcript`
- `timed-world-info`
- `ui-style`
- `popup`
- `device`
- `chat-control`
- `panel-layout`
- `background`

其中 `/session` 页面直输 slash 与 iframe script bridge 的默认 UI host 已经统一，不再一边能跑、一边缺骨架。

### 3. Script Debugger 已具备可解释性

当前调试面不再只是“列出一些 API 调用”，而是可以围绕矩阵解释：

- capability id
- area
- host source
- support level
- product entry
- recent API calls 的 resolved path

这直接完成了 Phase 5 的第二个核心目标：

> 从“命令面 100%”转成“宿主能力矩阵 100% 可解释”。

## Findings

### [P1] Phase 5 功能目标已完成，不应继续横向扩命令覆盖

#### Problem

如果下一步还继续把 Phase 5 理解成“再补更多命令”，就会重新回到早期的错误方向：

- 命令覆盖率看起来继续增长
- 但真实产品宿主边界会再次失焦
- 文档和 debugger 会重新被迫追着补说明

#### Impact

这会把已经建立起来的宿主矩阵方法论重新冲散，Phase 5 的收口价值会被稀释。

#### Recommendation

把 Phase 5 视为**功能已完成**，只做 PR 收口，不再继续横向加宿主能力域。

---

### [P2] 当前剩余工作已经纯粹是流程问题，不是产品问题

#### Problem

当前环境中：

- 分支仍有未提交改动
- `gh` 不可用，PR 状态无法本地核实

#### Impact

如果现在继续做 Phase 6 或回头做 Phase 4，会违反仓库自己的阶段纪律：

- 阶段完成
- review 完成
- PR 创建并合入
- 再进入下一阶段

#### Recommendation

直接进入 PR closeout：

- 固化提交边界
- 起草 PR 标题/描述
- Push 并开 PR
- 合入后再切下一阶段分支

## Direction Calibration

Phase 5 最值得肯定的，不是“支持了更多 slash”，而是把“宿主支持状态”从隐含知识变成了显式系统。

这会直接影响后续阶段的做法：

- Phase 4 / Phase 6 也应该尽量先定义真实产品语义边界，再补功能
- 不要回到“API 有了所以算完成”的旧思路

## Remaining Priorities

当前剩余优先级应当是：

1. 整理 Phase 5 最终提交边界。
2. 准备并提交 PR。
3. 等 PR 合入 `main`。
4. 从最新主干重新切下一阶段分支。

## Next Stage Recommendation

下一阶段不建议继续留在 Phase 5。Phase 5 的功能目标已经达成。

建议后续只在两者里选一个：

1. `Phase 4：世界书、正则、Persona 与迁移体验`
2. `Phase 6：MagVarUpdate 产品化`

但无论选哪个，都应在 Phase 5 PR 合入主干之后再开始。

## Final Verdict

**Phase 5 已完成。**

当前不再缺功能实现，不再缺宿主矩阵，不再缺调试解释层。剩余仅为 PR 流程收口。
