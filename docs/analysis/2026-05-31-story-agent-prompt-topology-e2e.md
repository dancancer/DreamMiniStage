# Story Agent prompt topology E2E verification

Date: 2026-05-31

## Scope

This pass verifies the prompt topology normalizer added after the SillyTavern plugin gap audit.
The goal is to keep Story Agent debug provenance granular while sending a compact provider-facing request.

The live browser E2E imported:

- `test-baseline-assets/character-card/Sgw3.png`
- `test-baseline-assets/preset/明月秋青v3.94.json`
- `test-baseline-assets/regex-scripts/sgw3-sample.json`

The browser used the local `.env` model configuration for `deepseek-v4-pro`.

## Result

Machine-readable result:

- `docs/analysis/artifacts/2026-05-31-story-agent-topology-e2e-summary.json`

Screenshots:

- `docs/analysis/artifacts/sgw-topology-e2e-initial.png`
- `docs/analysis/artifacts/sgw-topology-e2e-after-send.png`

## Request Audit

| Check | Result |
| --- | --- |
| Provider response | `200`, `application/json` |
| Request `stream` | `false` |
| Request `max_tokens` | `8192` |
| Request message count | `9` |
| Role shape | `3 system`, `4 assistant`, `2 user` |
| First / last role | `system` / `user` |
| Semantic system sections | `Story instructions`, `World context`, `UI render contracts` |
| Runtime placeholders | none |
| Current user input count | `1` |

## UI Audit

| Check | Result |
| --- | --- |
| Opening navigator before send | pass |
| Opening navigator after send | hidden, expected after first user turn locks the opening |
| Status panel after model reply | pass |
| Raw status JSON leak | not present |
| Raw `firstMessage 1/11` key leak | not present |

## Closed Gap

`Sgw` no longer exposes every imported asset fragment as an individual provider message.
The provider request is now a compact semantic topology while `turn.promptMessages` still preserves granular provenance for debugging.

The normalizer also removes non-history echoes of the current user input before the provider call.
That keeps the real user turn as the single source of truth at the tail of the request.

## Remaining Gaps

- Follow-up preset role topology is covered in `docs/analysis/2026-06-01-story-agent-preset-role-topology-e2e.md`.
- Initial status before the first generated reply is still absent when the selected opening does not contain a supported status payload.
- Follow-up model transport hardening is covered in `docs/analysis/2026-06-01-story-agent-model-gateway-e2e.md`.
