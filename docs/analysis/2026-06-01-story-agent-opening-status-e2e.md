# Story Agent opening status E2E verification

Date: 2026-06-01

## Scope

This pass verifies that an imported Sgw session renders a status panel before the first generated model reply, while keeping the synthetic UI status fallback out of the provider-facing prompt.

The live E2E imported:

- `test-baseline-assets/character-card/Sgw3.png`
- `test-baseline-assets/preset/明月秋青v3.94.json`
- `test-baseline-assets/regex-scripts/sgw3-sample.json`

The run used the local `.env` model gateway configuration and sent one real request to `deepseek-v4-pro`.

## Evidence

Machine-readable result:

- `docs/analysis/artifacts/2026-06-01-story-agent-opening-status-summary.json`

Screenshots:

- `docs/analysis/artifacts/2026-06-01-story-agent-opening-status-initial.png`
- `docs/analysis/artifacts/2026-06-01-story-agent-opening-status-after-send.png`

## Request Audit

| Check | Result |
| --- | --- |
| Provider response | `200`, `application/json` |
| Request model | `deepseek-v4-pro` |
| Request `stream` | `false` |
| Request `max_tokens` | `8192` |
| Request message count | `3` |
| Role shape | `system`, `assistant`, `user` |
| Runtime placeholders | none |
| UI-only opening status leak into assistant prompt | none |

## UI Audit

| Check | Result |
| --- | --- |
| Initial opening status panel | pass |
| Initial raw `<SFW>` source visible | not present |
| Initial raw JSON `characters` visible | not present |
| Status panel after model reply | pass |
| Console warnings/errors | none captured |

## Closed Gap

The selected Sgw opening now receives a display-only status source when it has no matching status payload. `OpeningPayload.content` is used for UI rendering, while `OpeningPayload.fullContent` remains the raw opening and is the only opening text seeded into the first model prompt and StorySession transcript.
