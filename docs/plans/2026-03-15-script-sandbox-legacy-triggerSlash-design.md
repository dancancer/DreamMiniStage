# ScriptSandbox Legacy triggerSlash Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让进入 `ScriptSandbox` 的旧 HTML 脚本在不恢复全局兼容别名的前提下，自动改写到当前 `window.TavernHelper` / `window.SillyTavern` API。

**Architecture:** 修复放在 `components/ScriptSandbox.tsx` 的内容边界。`buildSrcdoc()` 在注入 shim 与透明背景样式前，先做一次极窄范围的旧接口规范化，只覆盖已确认失效的全局 `triggerSlash` 调用与 `typeof triggerSlash === "function"` 检查。这样可以消除历史内容中的旧写法，同时不污染宿主全局 API，也不触碰现有 slash/bridge 执行路径。

**Tech Stack:** React 19, Next 15 App Router, TypeScript, Vitest, jsdom.

---

### Task 1: Lock the regression with a failing test

**Files:**
- Modify: `components/__tests__/ScriptSandbox.lifecycle.test.tsx`

**Step 1: Write the failing test**
- Render `ScriptSandbox` with an HTML snippet containing `typeof triggerSlash === "function"` and `triggerSlash('/send hi')`.
- Assert generated `srcdoc` no longer contains the legacy global check/call.
- Assert `srcdoc` contains `window.TavernHelper`-based trigger path.

**Step 2: Run test to verify it fails**
- Run: `pnpm vitest run components/__tests__/ScriptSandbox.lifecycle.test.tsx`
- Expected: FAIL because current `srcdoc` still contains raw `triggerSlash`.

### Task 2: Implement the narrow normalization

**Files:**
- Modify: `components/ScriptSandbox.tsx`

**Step 1: Add a small normalization helper**
- Normalize only two patterns:
  - `typeof triggerSlash === 'function'` / `"function"`
  - direct bare `triggerSlash(` calls
- Rewrite them to the current namespace API without reintroducing `window.triggerSlash`.

**Step 2: Wire helper into `buildSrcdoc()`**
- Keep flow single-path: normalize legacy API usage, inject transparent background, prepend slash-runner shim.

**Step 3: Run targeted tests**
- Run: `pnpm vitest run components/__tests__/ScriptSandbox.lifecycle.test.tsx`
- Expected: PASS.

### Task 3: Full verification

**Files:**
- No code changes expected

**Step 1: Run stage verification**
- Run: `pnpm verify:stage`
- Expected: lint, typecheck, vitest, build all PASS.
