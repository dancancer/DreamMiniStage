# Review Result: `codex/phase-3-session-quickreply`

- Review target: `codex/phase-3-session-quickreply`
- Base branch: `main`
- Merge base: `f66bf5353c60284b6f359842e085ce64e0d76f13`
- Review date: `2026-03-12`
- Review verdict: **Phase 3 功能闭环完成，阶段流程未收口**

## Executive Summary

这轮 Phase 3 的方向是对的：它没有继续沉迷 “slash 覆盖率”，而是把 `Quick Reply / group members / checkpoint / branch / message mutation / JSONL` 逐步收口到真实 `/session` 宿主。

从产品语义看，这一阶段最重要的事情已经成立：

1. 高价值聊天编排能力不再只停留在 bridge/slash 层。
2. `/session` 页面已经是这些能力的真实宿主，而不是空回调集线器。
3. `JSONL` round-trip 也补上了 metadata / message extra 的稳定保留，不再是“能导入、但导出继续丢语义”的假闭环。

因此，**Phase 3 的功能目标已经完成**。  
当前没有看到新的功能阻塞项，阶段门也已经通过。

但从工程流程看，这个阶段还没有真正结束：

1. 当前工作区仍然有未提交改动，分支尚未整理成可直接送审的状态。
2. 本地没有 `gh`，无法直接核实 PR 是否已创建。
3. 仓库规则要求“阶段完成 -> review -> PR -> 合入主干 -> 再开下一阶段”，目前这条流程只完成到了 `review + verify:stage`。

所以当前最准确的结论不是“Phase 3 没做完”，而是：

> **功能已完成，流程尚未收口。**

## Validation Performed

本次 review 以当前工作区文档、git 状态与新鲜验证结果为事实源，重点核对：

- `docs/plan/2026-03-08-sillytavern-product-roadmap/plan.md`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md`
- `docs/CHAT_JSONL_IMPORT_EXPORT.md`
- 当前分支与工作区状态

已执行验证：

- `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx components/__tests__/QuickReplyPanel.test.tsx components/__tests__/GroupMemberPanel.test.tsx lib/quick-reply/__tests__/store.test.ts lib/group-chat/__tests__/store.test.ts lib/dialogue/__tests__/swipe-jsonl.test.ts app/session/__tests__/session-host-bridge.test.ts hooks/script-bridge/__tests__/message-handlers-compat.test.ts`
- `pnpm verify:stage`

验证结果：

- 定向 Phase 3 测试：`8` 个测试文件、`49` 个测试全部通过。
- 阶段门：`lint / typecheck / vitest run / build` 全部通过。

## What Is Complete

### 1. `/session` 宿主已经接住高价值 Phase 3 能力

Phase 3 原始目标是把会话、消息、群聊与 Quick Reply 从“脚本层可调”推进到“产品面可见、可用、可验证”。

当前已完成的闭环包括：

- Quick Reply：集合定义、作用域启用、context 绑定、`nosend / inject / slash / plain message` 执行链路。
- group members：查看、加入、移除、启停、顺序调整，以及名称/id 解析的歧义收紧。
- checkpoint / branch：真实页面状态持久化与 slash 宿主打通。
- message mutation：`set/create/delete/refresh` 事件会命中当前 `/session` 的真实 `dialogue` 状态。
- JSONL：导入保留的 header / message extra 会在导出时按原位回填，round-trip 语义闭环成立。

### 2. 文档口径已经基本统一

当前文档之间的口径已经对齐到同一结论：

- `tasks.md` 中 Phase 3 四项功能任务均为完成。
- `handoff.md` 已记录到 Batch 6，并明确 `JSONL` 收口完成。
- `CHAT_JSONL_IMPORT_EXPORT.md` 已改成“导入保留字段会在导出时回填”的说法，不再与 handoff 冲突。

### 3. 阶段门通过，当前没有新的功能回归证据

这很关键。  
Phase 3 现在的主要剩余工作不是修 bug，而是把已经通过验证的工作整理成可审、可合并的变更集。

## Findings

### [P1] 阶段流程还没有走到 PR/merge 收口

#### Problem

仓库规则明确要求：

- 阶段完成后必须做 review
- 必须基于阶段分支提交 PR
- PR 未合入前不得进入下一阶段开发

当前这几个条件里：

- `review` 现在补齐了
- `verify:stage` 已通过
- 但 `PR 是否已创建 / 是否已合入` 仍无法在当前环境中核实

同时，当前工作区仍有未提交改动，说明分支尚未整理完毕。

#### Impact

如果现在直接口头宣布 “Phase 3 完成，进入 Phase 4/5”，就会违背当前 roadmap 的阶段纪律，重新回到“功能写完就算结束”的旧路径。

#### Why This Should Be Fixed

真正的阶段边界不只是代码能跑，还包括：

- review 有结论
- 提交边界清楚
- PR 可审
- 主干有可追溯的阶段落点

否则阶段就只是“本地做完”，不是“工程上完成”。

---

### [P2] 当前变更集仍然混合了功能、测试、文档与计划草稿

#### Problem

当前工作区包含：

- 功能代码
- 测试更新
- roadmap 文档
- 新增 plan/design 草稿

这些内容本身并不冲突，但如果不先整理提交边界，PR 会同时承载“功能实现”和“过程文档草稿”，审阅噪音会偏大。

#### Impact

- reviewer 难以快速判断哪些文件属于最终交付
- 阶段 review 文档与实现草稿容易混在一起
- 后续 cherry-pick / 回滚 / 追责会更痛苦

#### Why This Should Be Fixed

好品味不只是代码少分支，提交也要少分叉。  
一个阶段应该尽量形成清晰的审阅单元：功能、验证、交接、review 结论，各自边界明确。

## Direction Calibration

Phase 3 最值得肯定的地方，是它纠正了前期一个根本误区：

> 不能再用 “命令能调用” 伪装成 “产品能力已完成”。

这一阶段的真实进展，不是又多了几个 slash handler，而是让 `/session` 成为了会话编排能力的真正宿主。这个方向应该在后续阶段继续坚持，尤其是 Phase 5 的宿主能力矩阵，不要再回退成命令面对账。

## Remaining Priorities

当前剩余优先级应该这样排：

1. 整理当前 Phase 3 变更集，形成可提交的边界。
2. 基于当前阶段分支提交 PR，并补齐 PR 描述里的功能范围、验证证据、剩余风险。
3. PR 合入 `main` 后，再从最新主干切下一阶段分支。
4. 下一阶段优先进入 Phase 5，而不是继续给 Phase 3 横向加能力。

## Next Stage Recommendation

下一阶段建议优先做 `Phase 5：JS-Slash-Runner 宿主完成度`。

原因很直接：

1. Phase 3 已经证明“真实宿主闭环”这条路是对的。
2. Phase 5 恰好就是把大量已有 bridge 能力重新按宿主责任边界梳理一遍。
3. 如果现在跳去做更多迁移细节或新功能，容易再次把注意力从“产品宿主完成度”拉回“命令覆盖率”。

建议的阶段入口是：

- 先整理并合入当前 Phase 3 PR
- 从最新 `main` 切新 `codex/` 分支
- 先写宿主能力矩阵与 fail-fast 矩阵，再决定具体实现顺序

## Final Verdict

**Phase 3 功能目标已经完成，可以停止继续扩展这一阶段的功能面。**

但按当前仓库纪律，阶段还差最后一段流程：

- 整理提交
- 提交 PR
- 合入主干
- 从主干重开下一阶段分支

所以最终结论是：

> **Phase 3 已完成实现，不应再继续加功能；但在 PR 合入前，还不能宣称整个阶段已经工程化收口。**
