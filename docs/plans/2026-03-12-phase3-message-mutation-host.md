# Phase 3 Message Mutation Host Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 `/session` 页面真实消费脚本桥接层的 message mutation 事件，把消息编辑、创建、删除、刷新从协议层落到产品宿主。

**Architecture:** 继续沿用单路径宿主原则，在 `app/session/page.tsx` 注册页面事件监听，并将事件转换为 `dialogue` 当前真实消息状态更新。`rotateChatMessages` 不另开实现，继续复用现有 `setChatMessages` 翻译结果。

**Tech Stack:** Next.js App Router, React 19, Zustand, Vitest, Testing Library

---

### Task 1: 写 `/session` 的 message mutation 红灯测试

**Files:**
- Modify: `app/session/__tests__/page.slash-integration.test.tsx`

**Step 1: Write the failing tests**

新增最小行为断言：

```tsx
it("applies setChatMessages to the live session dialogue", async () => {
  window.dispatchEvent(new CustomEvent("DreamMiniStage:setChatMessages", { detail: ... }));
  expect(mocks.dialogue.setMessages).toHaveBeenCalled();
});
```

```tsx
it("applies createChatMessages and deleteChatMessages to the live session dialogue", async () => {
  window.dispatchEvent(new CustomEvent("DreamMiniStage:createChatMessages", { detail: ... }));
  window.dispatchEvent(new CustomEvent("DreamMiniStage:deleteChatMessages", { detail: ... }));
  expect(mocks.dialogue.setMessages).toHaveBeenCalledTimes(2);
});
```

```tsx
it("resolves refreshOneMessage against the live session dialogue", async () => {
  window.dispatchEvent(new CustomEvent("DreamMiniStage:refreshOneMessage", { detail: ... }));
  expect(...).toBe(...);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx`
Expected: FAIL，因为页面尚未消费这些事件。

**Step 3: Write minimal implementation**

涉及文件：

- Modify: `app/session/page.tsx`

最小实现：

- 注册四类事件监听
- 校验 `characterId`
- 基于 `dialogue.messages` 构造 next messages
- 调用 `dialogue.setMessages(nextMessages)`

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx`
Expected: PASS

### Task 2: 收紧消息解析与 fail-fast 规则

**Files:**
- Modify: `app/session/page.tsx`
- Test: `app/session/__tests__/page.slash-integration.test.tsx`

**Step 1: Extend tests for failure modes**

新增断言：

- 未命中的 `message_id` 不静默通过
- 非当前 `characterId` 事件不会污染当前页面
- `createChatMessages` 只接受当前支持的 `role/content/id`

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx`
Expected: FAIL with missing host guard behavior

**Step 3: Write minimal implementation**

实现：

- 统一解析 helper
- 统一 `toast.error` / fail-fast 守卫
- 单路径消息 id 定位

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx`
Expected: PASS

### Task 3: 文档与阶段回归

**Files:**
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md`
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md`

**Step 1: Run focused verification**

Run: `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx hooks/script-bridge/__tests__/message-handlers-compat.test.ts app/session/__tests__/session-host-bridge.test.ts`
Expected: PASS

**Step 2: Run stage gate**

Run: `pnpm verify:stage`
Expected: PASS

**Step 3: Update roadmap handoff**

记录本轮 `/session` message mutation 宿主接线、验证范围、剩余 `JSONL` 对齐项。
