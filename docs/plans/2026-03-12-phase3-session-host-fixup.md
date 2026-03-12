# Phase 3 Session Host Fix-up Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 收口 `/session` 已接入的 Quick Reply 与群聊宿主能力，消除注入路径、集合可见性、成员引用三处真实语义偏差。

**Architecture:** 继续沿用单状态源策略，把 Quick Reply 执行与可见性解析收口到 store/页面宿主单路径；把群成员查找拆成名称优先、id 兜底的显式规则。验证先看定向测试，再跑阶段质检门。

**Tech Stack:** Next.js App Router, React 19, Zustand, Vitest, Testing Library

---

### Task 1: 验证 Quick Reply 注入与集合去重

**Files:**
- Modify: `app/session/__tests__/page.slash-integration.test.tsx`
- Modify: `components/__tests__/QuickReplyPanel.test.tsx`
- Modify: `lib/quick-reply/__tests__/store.test.ts`

**Step 1: Run the targeted tests**

Run: `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx components/__tests__/QuickReplyPanel.test.tsx lib/quick-reply/__tests__/store.test.ts`
Expected: 如果实现未收口，至少会出现 inject 或重复按钮相关失败。

**Step 2: Keep the failing expectations**

保留以下行为断言：

- `/qr 0` 命中 `inject` 集合时，不调用 `addUserMessage`
- prompt injection store 收到 `before` 或 `in_chat`
- 同名集合在 `global/chat` 双激活时，按钮只展示一次

**Step 3: Fix the production path minimally**

涉及文件：

- Modify: `app/session/page.tsx`
- Modify: `components/quick-reply/QuickReplyPanel.tsx`
- Modify: `lib/quick-reply/store.ts`

最小实现：

- 页面宿主在 `nosend` 后优先判断 `inject`
- store 提供单点可见集合解析
- 面板复用 store 结果，不再自行拼接双作用域集合

**Step 4: Re-run the targeted tests**

Run: `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx components/__tests__/QuickReplyPanel.test.tsx lib/quick-reply/__tests__/store.test.ts`
Expected: PASS

### Task 2: 验证群成员名称/id 冲突

**Files:**
- Modify: `components/__tests__/GroupMemberPanel.test.tsx`
- Modify: `lib/group-chat/__tests__/store.test.ts`

**Step 1: Run the targeted tests**

Run: `pnpm vitest run components/__tests__/GroupMemberPanel.test.tsx lib/group-chat/__tests__/store.test.ts`
Expected: 如果查找规则仍混用 name/id，会在 remove 目标上失败。

**Step 2: Keep the failing expectations**

保留以下行为断言：

- 成员名称允许与另一个成员的内部 id 文本相同
- 删除时优先删除名称匹配者

**Step 3: Fix the production path minimally**

涉及文件：

- Modify: `lib/group-chat/store.ts`

最小实现：

- 拆出 `name` / `id` 独立查找函数
- 公共解析函数先按 `name`，再按 `id`
- 新增成员唯一性只检查 `name`

**Step 4: Re-run the targeted tests**

Run: `pnpm vitest run components/__tests__/GroupMemberPanel.test.tsx lib/group-chat/__tests__/store.test.ts`
Expected: PASS

### Task 3: 回归与阶段记录

**Files:**
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md`
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md`

**Step 1: Run focused verification**

Run: `pnpm vitest run lib/quick-reply/__tests__/store.test.ts components/__tests__/QuickReplyPanel.test.tsx lib/group-chat/__tests__/store.test.ts components/__tests__/GroupMemberPanel.test.tsx app/session/__tests__/page.slash-integration.test.tsx`
Expected: PASS

**Step 2: Run stage gate**

Run: `pnpm verify:stage`
Expected: PASS

**Step 3: Update roadmap handoff**

记录本轮 fix-up 的行为收口、测试范围、剩余未完成项。
