# POC-7.1 Dev Import Flow

## Purpose

Verify that a non-UI path can compile selected ST assets into a blueprint-backed session without touching old runtime stores.

## Inputs

| Asset | Source path | Why this fixture |
| --- | --- | --- |
| character | `test-baseline-assets/character-card/Sgw3.card.json` | real character card with embedded assets |
| preset | `test-baseline-assets/preset/明月秋青v3.94.json` | real preset with prompt ordering data |
| worldbook | `test-baseline-assets/worldbook/服装随机化.json` | external worldbook entries |
| regex | `test-baseline-assets/regex-scripts/sgw3-sample.json` | external regex scripts |

## Commands

```bash
pnpm vitest run lib/story-agent/import/__tests__/flow.test.ts
```

## Pass / Fail Criteria

- Pass: `compileStoryAgentImport()` returns a schema v3 `SessionBlueprint`, non-empty worldbook counts and regex counts.
- Pass: `commitStoryAgentImport()` saves blueprint, creates character shell, saves avatar when present and creates a `StorySession`.
- Fail: the flow writes selected worldbooks, presets or regex scripts into old runtime stores.

## Result

- Status: `pass`
- Date: `2026-05-29`
- Output artifacts: `lib/story-agent/import/__tests__/flow.test.ts`

## Decision

Adopt the dev flow as the product import wizard backend.
