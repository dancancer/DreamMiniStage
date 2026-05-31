# Story Agent theater opening E2E verification

Date: 2026-06-01

## Scope

This pass verifies that an imported `theater` card no longer exposes the instruction-only opening:

```text
<开局>
请按下面要求处理
</开局>
```

The compiler now emits a deterministic neutral playable opening when every source opening is instruction-only. The original instruction wrapper must not appear in the session UI or provider-facing prompt.

The live E2E imported:

- `test-baseline-assets/character-card/V2.0Beta.png`
- `test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json`

The run used a browser-local model config for `deepseek-v4-pro` and sent one real request through `/api/model-gateway/chat-completions`.

## Evidence

Machine-readable result:

- `docs/analysis/artifacts/2026-06-01-story-agent-theater-opening-summary.json`

Screenshots:

- `docs/analysis/artifacts/2026-06-01-story-agent-theater-opening-initial.png`
- `docs/analysis/artifacts/2026-06-01-story-agent-theater-opening-after-send.png`

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
| `请按下面要求处理` in prompt | not present |
| Neutral opening in prompt | present |

## UI Audit

| Check | Result |
| --- | --- |
| Initial raw `<开局>` visible | not present |
| Initial instruction text visible | not present |
| Neutral playable opening visible | pass |
| Raw `<开局>` after send | not present |
| Console warnings/errors | none captured |

## Closed Gap

Cards with only an instruction-shaped opening no longer show that trigger as the playable first message. The `SessionBlueprint` compiler now normalizes this at import time, records `character.instruction_only_opening`, and stores the neutral opening as `profile.firstMessage` / `profile.openings[0]`.
