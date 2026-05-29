# POC-6b.3 Long Session Replay

## Goal

Verify that long-session replay preserves character identity, key facts and relationship state using the new memory state.

## Fixture

The replay fixture is the long-turn test in `lib/story-agent/runtime/__tests__/story-session.test.ts`.

It combines:

- base prompt identity from `PromptStack`
- world hits from `WorldModule`
- memory facts
- relationship state
- summarized older episodes

## Assertions

- the base prompt remains present through `prepareStoryTurn()`
- old facts survive as memory messages
- relationship state survives as memory messages
- older episodes are summarized instead of mutating static world entries

## Command

```bash
pnpm vitest run lib/story-agent/runtime/__tests__/story-session.test.ts
```

## Result

Passed in targeted Phase 6b verification.
