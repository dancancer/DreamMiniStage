# POC-4.3 Prompt Budget Trimming

## Purpose

Verify that long-context trimming keeps higher-value context before dropping lower-value context.

## Command

```bash
pnpm vitest run lib/story-agent/runtime/__tests__/phase4-runtime.test.ts
```

## Retention Order

The offline harness keeps context in this order:

1. `prompt-stack`
2. `world`
3. `memory`
4. `history`

When the budget is too small, history is omitted before memory, world hits and prompt-stack messages.

## Expected Output

With a synthetic small budget:

- retained sources are `prompt-stack`, `world`, `memory`
- omitted sources are `history`, `history`

## Result

- Status: `pass`
- Date: `2026-05-29`
- Evidence: `assemblePromptContext()` and `phase4-runtime.test.ts`
