# Story Agent import diagnostics E2E verification

Date: 2026-06-01

## Scope

This pass verifies that the Story Agent import preview exposes actionable diagnostics instead of only showing an aggregate diagnostic count. The theater card is the target because its source opening is instruction-only and the compiler generates a neutral playable opening.

The live E2E imported:

- `test-baseline-assets/character-card/V2.0Beta.png`
- `test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json`

The run also created a session and sent one real request through `/api/model-gateway/chat-completions` to ensure the import UX change did not regress the runtime prompt.

## Evidence

Machine-readable result:

- `docs/analysis/artifacts/2026-06-01-story-agent-import-diagnostics-summary.json`

Screenshots:

- `docs/analysis/artifacts/2026-06-01-story-agent-import-diagnostics-preview.png`
- `docs/analysis/artifacts/2026-06-01-story-agent-import-diagnostics-after-send.png`

## Import Preview Audit

| Check | Result |
| --- | --- |
| First opening preview visible | pass |
| Feature-loss panel visible | pass |
| `character.instruction_only_opening` visible | pass |
| Opening diagnostic appears first | pass |
| Generated neutral opening visible | pass |
| Raw `<开局>` visible | not present |
| Raw `请按下面要求处理` visible | not present |
| Diagnostic target/source path visible | pass |

## Request Audit

| Check | Result |
| --- | --- |
| Gateway response | `200`, `application/json` |
| Request model | `deepseek-v4-pro` |
| Request `stream` | `false` |
| Request `max_tokens` | `8192` |
| Request message count | `3` |
| Role shape | `system`, `assistant`, `user` |
| Raw `<开局>` in prompt | not present |
| Raw instruction text in prompt | not present |
| Generated neutral opening in prompt | present |

## Closed Gap

The import page now shows the actual first opening and high-signal feature-loss diagnostics. For instruction-only openings, users can see both the `character.instruction_only_opening` diagnostic and the neutral opening that will become the first visible scene before they create the agent.
