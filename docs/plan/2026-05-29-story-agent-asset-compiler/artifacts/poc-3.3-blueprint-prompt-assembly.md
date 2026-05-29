# POC-3.3 Blueprint-Only Prompt Assembly

## Purpose

Verify that prompt assembly can operate on serialized `SessionBlueprint` JSON only.

## Implementation

- `assemblePromptMessages(blueprint)`
- Input type: `Pick<SessionBlueprint, "promptStack">`
- Output type: ordered role/content messages with provenance source path.

## Commands

```bash
pnpm vitest run lib/story-agent/blueprint/__tests__/compiler.test.ts
```

## Expected Output

The test serializes and parses a compiled blueprint before assembly:

```ts
const serialized = JSON.stringify(blueprint);
const messages = assemblePromptMessages(JSON.parse(serialized));
```

Required assertions:

- assembled messages are non-empty
- messages include `role`
- serialized executable fields do not include `"prompt_order":`, `"keysecondary":`, or `"placement":`

## Result

- Status: `pass`
- Date: `2026-05-29`
- Evidence: `lib/story-agent/blueprint/assembler.ts`, `lib/story-agent/blueprint/__tests__/compiler.test.ts`

## Decision

Phase 4 should build `PromptStack` and `WorldModule` runtime POCs against `SessionBlueprint`, not raw ST assets.
