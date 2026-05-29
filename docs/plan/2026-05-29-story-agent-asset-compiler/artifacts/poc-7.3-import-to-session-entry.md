# POC-7.3 Import To Session Entry

## Purpose

Verify that imported agents create sessions that `/session` can resolve through `StorySession` binding.

## Commands

```bash
pnpm vitest run lib/story-agent/session/__tests__/create.test.ts lib/story-agent/import/__tests__/flow.test.ts
```

## Pass / Fail Criteria

- Pass: `createStorySessionForCharacter()` loads `storyBlueprintId`, creates a session and saves `StorySession`.
- Pass: characters without `storyBlueprintId` fail fast before session creation.
- Pass: `commitStoryAgentImport()` returns `sessionId`, `characterId` and `blueprintId`.
- Pass: the imported blueprint can prepare the first user turn through `prepareStoryTurn()`.
- Fail: a non-blueprint character can create a session through the product path.

## Result

- Status: `pass`
- Date: `2026-05-29`
- Output artifacts:
  - `lib/story-agent/session/__tests__/create.test.ts`
  - `lib/story-agent/import/__tests__/flow.test.ts`

## Decision

Use `StorySession` creation as part of the import commit. Do not let `/session` initialize story runtime from raw SillyTavern assets.
