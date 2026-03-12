# Phase 3 Closeout Docs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 Phase 3 补齐正式 review 产物与 PR 收尾清单，并把 roadmap 文档状态同步到“功能完成、流程待收口”。

**Architecture:** 以现有 `tasks.md`、`handoff.md`、`CHAT_JSONL_IMPORT_EXPORT.md` 和 git 工作区状态为事实源，新增单独的 Phase 3 review 文档与 PR closeout 文档，再回写 roadmap 清单中的 review 状态，避免状态分散和口径冲突。

**Tech Stack:** Markdown, git metadata, pnpm verification commands

---

### Task 1: 写 Phase 3 review 文档

**Files:**
- Create: `docs/plan/2026-03-08-sillytavern-product-roadmap/phase3-review-result.md`
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md`
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md`

**Step 1: 收敛 review 结构**

从已有 `phase1-review-result.md` 与 Phase 3 handoff 提炼固定段落：方向校准、已完成闭环、验证证据、问题清单、剩余优先级重排、下一阶段目标。

**Step 2: 写最小但完整的 review**

落地一份面向当前阶段分支的结论文档，明确：Phase 3 功能闭环已完成，但 PR/merge 级流程尚未完成。

**Step 3: 回写 roadmap 状态**

把“阶段 review 已完成”“review 结论已同步”在 `tasks.md` 中打勾，并在 `handoff.md` 增加 review 摘要和后续流程提醒。

### Task 2: 写 PR 收尾清单

**Files:**
- Create: `docs/plan/2026-03-08-sillytavern-product-roadmap/phase3-pr-closeout.md`

**Step 1: 记录当前分支事实**

写入当前分支、未提交文件类别、已通过验证、缺失的 PR 状态信息（如本地无 `gh`）。

**Step 2: 输出可执行收尾路径**

给出提交分组、验证要求、PR 描述要点、合并前阻塞项与合并后切下一阶段的前置条件。

### Task 3: 验证并汇总

**Files:**
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md`

**Step 1: 运行阶段门**

Run: `pnpm verify:stage`
Expected: PASS

**Step 2: 汇总剩余工作**

在 handoff 中明确剩余不是功能，而是工程流程：整理提交、提 PR、合主干后切新分支。
