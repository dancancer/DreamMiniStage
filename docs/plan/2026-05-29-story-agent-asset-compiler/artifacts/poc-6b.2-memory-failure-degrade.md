# POC-6b.2 Memory Failure Degrade

## Goal

Verify that memory extraction failure does not block a story turn.

## Fixture

`lib/story-agent/runtime/__tests__/story-session.test.ts`

The test passes a `memoryExtractor` that throws `extractor unavailable`.

## Assertions

- `finalizeStoryTurn()` resolves normally.
- `screenContent` is still returned.
- recent transcript is committed.
- `StorySession.memory.lastError` stores the extraction error.

## Command

```bash
pnpm vitest run lib/story-agent/runtime/__tests__/story-session.test.ts
```

## Result

Passed in targeted Phase 6b verification.
