# SAC-Phase 6b Memory Contract

## Decision

`memoryPolicy` graduates from the deferred contract into `SessionBlueprint` schema v3.

The runtime memory model is deterministic and blueprint-native:

- no vector-memory runtime dependency
- no MVU/script runtime dependency
- no hidden fallback to NodeFlow memory nodes
- extractor failure degrades into `StoryMemoryState.lastError` without blocking the turn

## SessionBlueprint MemoryPolicy

```ts
interface MemoryPolicy {
  status: "active";
  summary: { maxChars: number; preserveRecentEpisodes: number };
  episodic: { maxEntries: number };
  facts: { maxEntries: number };
  relationships: { maxEntries: number };
  failureMode: "degrade";
}
```

Default policy:

| Field | Value |
| --- | --- |
| `summary.maxChars` | `1200` |
| `summary.preserveRecentEpisodes` | `8` |
| `episodic.maxEntries` | `24` |
| `facts.maxEntries` | `32` |
| `relationships.maxEntries` | `16` |
| `failureMode` | `degrade` |

## StorySession Memory State

```ts
interface StoryMemoryState {
  runningSummary: StoryRunningSummary;
  episodes: StoryEpisodeMemory[];
  facts: StoryFactMemory[];
  relationships: StoryRelationshipMemory[];
  lastError?: string;
  updatedAt: string;
}
```

Memory is updated during `finalizeStoryTurn()`, after output transforms and before the next `StorySession` is committed.

## Extraction Strategy

Phase 6b uses a deterministic extractor for POC stability:

- `[fact:...]` becomes a fact memory.
- `[relationship:key=value]` becomes relationship state.
- each turn becomes an episode.
- overflowing old episodes roll into `runningSummary`.

Future LLM extraction can replace the extractor function, but it must preserve the same `StoryMemoryState` contract and failure behavior.

## Verification

Commands:

- `pnpm vitest run lib/story-agent/runtime/__tests__/story-session.test.ts lib/story-agent/blueprint/__tests__/compiler.test.ts lib/generation-runtime/__tests__/prepare-dialogue-execution.test.ts function/dialogue/__tests__/chat-streaming.test.ts function/dialogue/__tests__/opening-baseline.test.ts function/dialogue/__tests__/init-workflow.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm verify:stage`

Result:

- targeted POC tests passed: 6 files / 17 tests
- `verify:stage` passed: lint, typecheck, 235 test files / 1935 tests, build
