# Phase 4 Unified Runtime Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current split streaming/buffered/slash-render timing paths with one unified generation runtime so token streaming, tool calls, post-processing, slash ST macros, and message rendering all follow explicit and testable phase semantics.

**Architecture:** Introduce a small `lib/generation-runtime` layer that owns prepare -> model execution -> postprocess -> sink emission, then make both `/function/dialogue/chat.ts` and `/function/dialogue/chat-streaming.ts` thin adapters over that runtime. Move ST env macro expansion from the trigger handler into the slash executor, and replace `MessageBubble`'s boolean streaming mode with an explicit render pipeline (`preview`, `transition`, `parsed`) so the UI never drops content while parsing catches up.

**Tech Stack:** TypeScript, React 19, Next.js 15 App Router, Vitest, existing nodeflow/dialogue/slash-command runtime modules

**Convergence note (2026-03-17):**
- `lib/generation-runtime/result.ts` 已在收口阶段移除，类型直接由 `lib/generation-runtime/types.ts` 提供
- `ModelExecutionMode` / `execution-mode.ts` 已移除；最终实现改为单一路径运行时，不再保留未参与执行决策的伪语义

---

### Task 1: Freeze the new runtime contracts with failing tests

**Files:**
- Create: `lib/generation-runtime/__tests__/dialogue-runtime.contract.test.ts`
- Modify: `lib/nodeflow/__tests__/llm-node-streaming.test.ts`
- Modify: `function/dialogue/__tests__/chat-streaming.test.ts`
- Modify: `hooks/script-bridge/__tests__/slash-handlers.integration.test.ts`
- Modify: `components/__tests__/MessageBubble.streaming.test.tsx`

**Step 1: Write the failing generation-runtime contract test**

```ts
import { describe, expect, it } from "vitest";
import { collectGenerationEvents } from "@/lib/generation-runtime/__tests__/helpers";

it("streams text deltas even when script tools are registered but unused", async () => {
  const result = await collectGenerationEvents({
    llmType: "openai",
    scriptTools: [{ type: "function", function: { name: "tool_echo", description: "echo", parameters: { type: "object", properties: {} } } }],
    mockChunks: ["He", "llo"],
  });

  expect(result.events.filter((event) => event.type === "content-delta")).toHaveLength(2);
});
```

**Step 2: Write failing slash timing and render-transition assertions**

- Add `/send first|/echo now-{{lastMessage}}` -> `now-first`
- Add `/send first|/send second|/echo count={{messageCount}}` -> `count=2`
- Add a `MessageBubble` assertion that raw content remains visible while `parseContentAsync()` is still pending after streaming ends.

**Step 3: Run the targeted tests to verify RED**

Run:
```bash
pnpm vitest run \
  lib/generation-runtime/__tests__/dialogue-runtime.contract.test.ts \
  lib/nodeflow/__tests__/llm-node-streaming.test.ts \
  function/dialogue/__tests__/chat-streaming.test.ts \
  hooks/script-bridge/__tests__/slash-handlers.integration.test.ts \
  components/__tests__/MessageBubble.streaming.test.tsx
```

Expected: FAIL because the unified runtime does not exist yet, slash macros still expand too early, and render transition still blanks out.

**Step 4: Commit the test-only contract freeze**

```bash
git add \
  lib/generation-runtime/__tests__/dialogue-runtime.contract.test.ts \
  lib/nodeflow/__tests__/llm-node-streaming.test.ts \
  function/dialogue/__tests__/chat-streaming.test.ts \
  hooks/script-bridge/__tests__/slash-handlers.integration.test.ts \
  components/__tests__/MessageBubble.streaming.test.tsx
git commit -m "test: freeze unified runtime contracts"
```

### Task 2: Introduce the generation-runtime core types and event model

**Files:**
- Create: `lib/generation-runtime/types.ts`
- Create: `lib/generation-runtime/events.ts`
- Create: `lib/generation-runtime/__tests__/helpers.ts`

**Step 1: Write the failing type-focused test**

```ts
it("normalizes model execution into explicit generation events", () => {
  const event = createContentDeltaEvent("He", "He");
  expect(event).toEqual({
    type: "content-delta",
    delta: "He",
    accumulated: "He",
  });
});
```

**Step 2: Run the test to confirm the module is missing**

Run:
```bash
pnpm vitest run lib/generation-runtime/__tests__/dialogue-runtime.contract.test.ts
```

Expected: FAIL with missing imports/symbols.

**Step 3: Add the minimal domain model**

Required exports:
- `PreparedDialogueExecution`
- `GenerationEvent`
- `GenerationEventType`
- `FinalizedDialogueResult`
- event factory helpers for content/reasoning/tool/postprocess/complete/error

```ts
export type GenerationEvent =
  | { type: "content-delta"; delta: string; accumulated: string }
  | { type: "reasoning-delta"; delta: string; accumulated: string }
  | { type: "tool-call-start"; toolName: string }
  | { type: "tool-call-result"; toolName: string; output: string }
  | { type: "postprocess-start" }
  | { type: "complete"; result: FinalizedDialogueResult }
  | { type: "error"; message: string };
```

**Step 4: Re-run the type-focused contract tests**

Run:
```bash
pnpm vitest run lib/generation-runtime/__tests__/dialogue-runtime.contract.test.ts
```

Expected: tests compile further, with downstream failures still present for missing runtime wiring.

**Step 5: Commit the runtime core types**

```bash
git add lib/generation-runtime
git commit -m "feat: add generation runtime core event model"
```

### Task 3: Unify workflow preparation and finalization into a reusable execution plan

**Files:**
- Create: `lib/generation-runtime/prepare/prepare-dialogue-execution.ts`
- Create: `lib/generation-runtime/postprocess/finalize-dialogue-result.ts`
- Modify: `lib/workflow/examples/DialogueWorkflow.ts`
- Modify: `lib/nodeflow/WorkflowEngine.ts`
- Modify: `lib/nodeflow/NodeBase.ts`
- Modify: `lib/workflow/__tests__/dialogue-workflow-validation.test.ts`

**Step 1: Write the failing workflow-plan test**

```ts
it("returns a reusable prepared execution plan before model invocation", async () => {
  const prepared = await prepareDialogueExecution({
    characterId: "char-1",
    userInput: "hello",
    modelName: "gpt-test",
    apiKey: "key",
  });

  expect(prepared.llmConfig.messages.length).toBeGreaterThan(0);
  expect(prepared.context).toBeDefined();
  expect(prepared.postprocessNodeId).toBe("regex-1");
});
```

**Step 2: Run the workflow validation tests to verify RED**

Run:
```bash
pnpm vitest run lib/workflow/__tests__/dialogue-workflow-validation.test.ts
```

Expected: FAIL because the new preparation/finalization helpers do not exist.

**Step 3: Implement the minimal plan extraction**

- `DialogueWorkflow` becomes a provider of:
  - `prepareDialogueExecution(params)`
  - `finalizeDialogueExecution(context, llmResponse)`
- `WorkflowEngine.executeUntil()` and `executeFrom()` stay, but stop being streaming-specific API surface.

**Step 4: Re-run workflow tests**

Run:
```bash
pnpm vitest run lib/workflow/__tests__/dialogue-workflow-validation.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add \
  lib/generation-runtime/prepare/prepare-dialogue-execution.ts \
  lib/generation-runtime/postprocess/finalize-dialogue-result.ts \
  lib/workflow/examples/DialogueWorkflow.ts \
  lib/nodeflow/WorkflowEngine.ts \
  lib/nodeflow/NodeBase.ts \
  lib/workflow/__tests__/dialogue-workflow-validation.test.ts
git commit -m "refactor: extract reusable dialogue execution plan"
```

### Task 4: Replace split LLM streaming/buffered branches with one model execution runtime

**Files:**
- Create: `lib/generation-runtime/model/run-model-execution.ts`
- Modify: `lib/nodeflow/LLMNode/LLMNodeTools.ts`
- Modify: `lib/nodeflow/LLMNode/model-invokers.ts`
- Modify: `lib/nodeflow/LLMNode/LLMNode.ts`
- Modify: `lib/nodeflow/__tests__/llm-node-streaming.test.ts`

**Step 1: Write the failing runtime-mode tests**

Add cases for:
- script tools 已注册但未触发时，仍保持 token 流输出
- 仅在 provider/runtime 真实需要 buffered tool path 时走 buffered 工具执行
- token usage 通过统一事件适配上抛

**Step 2: Run the LLM runtime tests to verify RED**

Run:
```bash
pnpm vitest run lib/nodeflow/__tests__/llm-node-streaming.test.ts
```

Expected: FAIL because `invokeLLMStream()` still falls back to `invokeLLM()` on broad tool presence.

**Step 3: Implement a single execution loop**

Requirements:
- Introduce `runModelExecution(config, sink)`
- Move provider capability policy out of `invokeLLMStream()` branch spaghetti
- Distinguish:
  - tool availability
n  - tool protocol requirement
  - provider capability
- Make `invokeLLM()` and `invokeLLMStream()` thin wrappers over the same runtime

```ts
return runModelExecution(config, sink.emit);
```

**Step 4: Re-run the targeted tests**

Run:
```bash
pnpm vitest run \
  lib/nodeflow/__tests__/llm-node-streaming.test.ts \
  function/dialogue/__tests__/chat-streaming.test.ts
```

Expected: PASS for streaming/tool-call contracts.

**Step 5: Commit**

```bash
git add \
  lib/generation-runtime/model/run-model-execution.ts \
  lib/nodeflow/LLMNode/LLMNodeTools.ts \
  lib/nodeflow/LLMNode/model-invokers.ts \
  lib/nodeflow/LLMNode/LLMNode.ts \
  lib/nodeflow/__tests__/llm-node-streaming.test.ts \
  function/dialogue/__tests__/chat-streaming.test.ts
git commit -m "refactor: unify model execution runtime"
```

### Task 5: Make chat.ts and chat-streaming.ts thin adapters over the unified runtime

**Files:**
- Create: `lib/generation-runtime/sinks/create-sse-sink.ts`
- Create: `lib/generation-runtime/sinks/create-buffered-sink.ts`
- Create: `lib/generation-runtime/run-dialogue-generation.ts`
- Modify: `function/dialogue/chat.ts`
- Modify: `function/dialogue/chat-streaming.ts`
- Modify: `lib/streaming/sse-handler.ts`
- Modify: `function/dialogue/__tests__/chat-streaming.test.ts`

**Step 1: Write failing transport-adapter tests**

```ts
it("emits ordered SSE events from the unified generation runtime", async () => {
  const response = await handleStreamingResponse(/* ... */);
  const payload = await response.text();
  expect(payload).toContain('"type":"content-delta"');
  expect(payload).toContain('"type":"complete"');
});
```

**Step 2: Run the transport tests to verify RED**

Run:
```bash
pnpm vitest run function/dialogue/__tests__/chat-streaming.test.ts
```

Expected: FAIL because the current handlers still manage flow manually.

**Step 3: Implement the runtime runner and sinks**

- `runDialogueGeneration(preparedExecution, sink)` owns the whole lifecycle
- `createSseSink()` serializes `GenerationEvent` to SSE frames
- `createBufferedSink()` accumulates events into the existing JSON response shape
- `chat.ts` and `chat-streaming.ts` only map request payloads to runtime invocation

**Step 4: Re-run transport tests**

Run:
```bash
pnpm vitest run function/dialogue/__tests__/chat-streaming.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add \
  lib/generation-runtime/sinks/create-sse-sink.ts \
  lib/generation-runtime/sinks/create-buffered-sink.ts \
  lib/generation-runtime/run-dialogue-generation.ts \
  function/dialogue/chat.ts \
  function/dialogue/chat-streaming.ts \
  lib/streaming/sse-handler.ts \
  function/dialogue/__tests__/chat-streaming.test.ts
git commit -m "refactor: make dialogue handlers thin runtime adapters"
```

### Task 6: Move ST env macro expansion into the slash executor timing boundary

**Files:**
- Create: `lib/slash-command/core/st-env-macros.ts`
- Create: `lib/slash-command/__tests__/st-env-macros.test.ts`
- Modify: `hooks/script-bridge/slash-handlers.ts`
- Modify: `lib/slash-command/core/executor.ts`
- Modify: `hooks/script-bridge/__tests__/slash-handlers.integration.test.ts`

**Step 1: Write the failing slash timing unit test**

```ts
it("evaluates ST env macros against the latest execution context per command", async () => {
  const result = await runHostSlash("/send first|/echo now-{{lastMessage}}");
  expect(result.pipe).toBe("now-first");
});
```

**Step 2: Run the slash tests to verify RED**

Run:
```bash
pnpm vitest run \
  lib/slash-command/__tests__/st-env-macros.test.ts \
  hooks/script-bridge/__tests__/slash-handlers.integration.test.ts
```

Expected: FAIL because `triggerSlash` still preprocesses the entire command string before execution.

**Step 3: Implement executor-level ST macro expansion**

- Extract pure helpers from `slash-handlers.ts`
- Expand ST env macros inside `executeCommand()` for pipe/args/namedArgs only
- Preserve slash command macros (`arg`, `var`, `globalvar`) as a separate layer
- Remove whole-command pre-expansion from `triggerSlash`

**Step 4: Re-run slash timing tests**

Run:
```bash
pnpm vitest run \
  lib/slash-command/__tests__/st-env-macros.test.ts \
  hooks/script-bridge/__tests__/slash-handlers.integration.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add \
  lib/slash-command/core/st-env-macros.ts \
  lib/slash-command/__tests__/st-env-macros.test.ts \
  hooks/script-bridge/slash-handlers.ts \
  lib/slash-command/core/executor.ts \
  hooks/script-bridge/__tests__/slash-handlers.integration.test.ts
git commit -m "refactor: evaluate ST macros at slash execution time"
```

### Task 7: Replace boolean streaming UI with an explicit message render pipeline

**Files:**
- Create: `components/message-bubble/render-types.ts`
- Create: `components/message-bubble/useMessageRenderPipeline.ts`
- Modify: `components/MessageBubble.tsx`
- Modify: `components/character-chat/MessageItem.tsx`
- Modify: `components/CharacterChatPanel.tsx`
- Modify: `components/__tests__/MessageBubble.streaming.test.tsx`
- Modify: `components/__tests__/CharacterChatPanel.streaming.test.tsx`

**Step 1: Write the failing render-pipeline tests**

Add explicit assertions for:
- `preview` during token streaming
- `transition` after streaming stops and before parsing resolves
- `parsed` after parse completion

**Step 2: Run the message render tests to verify RED**

Run:
```bash
pnpm vitest run \
  components/__tests__/MessageBubble.streaming.test.tsx \
  components/__tests__/CharacterChatPanel.streaming.test.tsx
```

Expected: FAIL because the current component still toggles directly from preview to parsed mode and blanks out in between.

**Step 3: Implement the pipeline hook and phase-driven render**

Requirements:
- `useMessageRenderPipeline()` returns `{ phase, displayHtml, segments, isParsing }`
- `MessageBubble` renders by phase, not by `enableStreaming` boolean alone
- `CharacterChatPanel` and `MessageItem` pass intent (`isStreamingCandidate`, `isActivelyStreaming`) rather than raw target math only

**Step 4: Re-run render tests**

Run:
```bash
pnpm vitest run \
  components/__tests__/MessageBubble.streaming.test.tsx \
  components/__tests__/CharacterChatPanel.streaming.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add \
  components/message-bubble/render-types.ts \
  components/message-bubble/useMessageRenderPipeline.ts \
  components/MessageBubble.tsx \
  components/character-chat/MessageItem.tsx \
  components/CharacterChatPanel.tsx \
  components/__tests__/MessageBubble.streaming.test.tsx \
  components/__tests__/CharacterChatPanel.streaming.test.tsx
git commit -m "refactor: add message render pipeline phases"
```

### Task 8: Delete obsolete split-path logic and run full verification

**Files:**
- Modify: `lib/nodeflow/LLMNode/LLMNodeTools.ts`
- Modify: `function/dialogue/chat.ts`
- Modify: `function/dialogue/chat-streaming.ts`
- Modify: `hooks/script-bridge/slash-handlers.ts`
- Modify: `components/MessageBubble.tsx`
- Modify: `docs/plans/2026-03-16-phase4-unified-runtime-refactor.md`

**Step 1: Remove dead compatibility branches**

Delete or inline old paths that are superseded by the unified runtime:
- whole-command ST macro preprocessing
- broad `hasFunctionCalling(config)` streaming fallback
- duplicated prompt-capture / token-usage / finalize branches
- render branches that can no longer be reached under the phase-based pipeline

**Step 2: Run the focused regression suite**

Run:
```bash
pnpm vitest run \
  lib/generation-runtime/__tests__/dialogue-runtime.contract.test.ts \
  lib/nodeflow/__tests__/llm-node-streaming.test.ts \
  function/dialogue/__tests__/chat-streaming.test.ts \
  hooks/script-bridge/__tests__/slash-handlers.integration.test.ts \
  components/__tests__/MessageBubble.streaming.test.tsx \
  components/__tests__/CharacterChatPanel.streaming.test.tsx \
  lib/workflow/__tests__/dialogue-workflow-validation.test.ts
```

Expected: PASS.

**Step 3: Run stage verification**

Run:
```bash
pnpm verify:stage
```

Expected: PASS (`lint` + `typecheck` + `vitest run` + `build`).

**Step 4: Commit the cleanup pass**

```bash
git add -A
git commit -m "refactor: remove split timing paths from phase4 runtime"
```
