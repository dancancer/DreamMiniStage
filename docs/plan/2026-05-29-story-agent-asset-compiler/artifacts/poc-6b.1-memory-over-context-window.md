# POC-6b.1 Memory Over Context Window

## Goal

Verify that summary, facts and relationship state remain available after older transcript turns are trimmed or omitted by a small context window.

## Fixture

`lib/story-agent/runtime/__tests__/story-session.test.ts`

The test advances 12 turns through one `SessionBlueprint`. Each turn includes:

```text
[fact:Alice keeps a silver key]
[relationship:trust=warm]
```

Then it prepares another turn with `maxTokens: 80`.

## Assertions

- `StorySession.memory.runningSummary.content` contains early turns.
- prompt memory messages contain `Alice keeps a silver key`.
- prompt memory messages contain `trust: warm`.

## Command

```bash
pnpm vitest run lib/story-agent/runtime/__tests__/story-session.test.ts
```

## Result

Passed in targeted Phase 6b verification.
