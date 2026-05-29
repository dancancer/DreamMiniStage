# SAC-Phase 7 Product Import Flow

## Decision

The product entry for new story sessions is `/story-agent-import`.

The flow is single-path:

1. read selected character, preset, worldbook and regex files
2. compile an `ImportedAssetBundle`
3. compile a `SessionBlueprint`
4. persist the blueprint
5. create a minimal character shell with `storyBlueprintId`
6. create a `Session` plus `StorySession`
7. open `/session?id={sessionId}`

The flow does not write selected worldbooks, presets or regex scripts into the old runtime stores. They exist only as import inputs before the blueprint is created.

## Runtime Boundary

`useSessionStore.createSession()` now calls `createStorySessionForCharacter()`.

Characters without a `storyBlueprintId` fail fast and do not produce a session. This prevents old character-card-only records from creating sessions that cannot run under the hard-replaced StorySession runtime.

## Product Surface

| Surface | Result |
| --- | --- |
| `/story-agent-import` | Minimal import wizard with asset selection, preview, confirmation and create actions |
| left navigation | Adds `Agent 导入` |
| home empty state | Points users to `Agent 导入` |
| empty `/session` state | Points users to `Agent 导入` |
| `/session?id=...` | Requires an existing `StorySession` binding |

## Implementation Files

- `function/story-agent/import.ts`
- `lib/story-agent/import/*`
- `lib/story-agent/session/create.ts`
- `components/story-agent/import-wizard/StoryAgentImportWizard.tsx`
- `app/story-agent-import/page.tsx`

## Script Bridge Decision

No script-bridge execution is reintroduced in the product import flow. Unsupported script-like assets remain import-time diagnostics or extension artifacts only.

## Verification

Targeted commands:

```bash
pnpm vitest run lib/story-agent/import/__tests__/flow.test.ts lib/story-agent/session/__tests__/create.test.ts
pnpm typecheck
pnpm lint
```

Result:

- targeted tests passed: 2 files / 5 tests
- typecheck passed
- lint passed

Full stage gate:

```bash
pnpm verify:stage
```

Result:

- lint passed
- typecheck passed
- test passed: 237 files / 1940 tests
- build passed
