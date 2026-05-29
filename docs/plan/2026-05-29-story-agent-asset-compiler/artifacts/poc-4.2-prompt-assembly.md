# POC-4.2 PromptStack Assembly Slice

## Purpose

Verify that two real presets can be compiled into blueprint prompt stacks and assembled without ST `prompt_order` runtime logic.

## Inputs

| Preset | Source path |
| --- | --- |
| Xiajin Pro | `test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json` |
| Mingyue Qiuqing | `test-baseline-assets/preset/明月秋青v3.94.json` |

## Command

```bash
pnpm vitest run lib/story-agent/runtime/__tests__/phase4-runtime.test.ts
```

## Expected Output

For both presets:

- `compileSessionBlueprint(bundle)` succeeds
- `assemblePromptContext({ blueprint })` returns non-empty messages
- first assembled message source is `prompt-stack`

## Result

- Status: `partial pass`
- Date: `2026-05-29`
- Evidence: `lib/story-agent/runtime/prompt-context.ts`, `phase4-runtime.test.ts`

## Baseline Difference

This POC proves blueprint-only assembly, not ST byte-for-byte parity. The dedicated baseline diff report remains open in Phase 4.
