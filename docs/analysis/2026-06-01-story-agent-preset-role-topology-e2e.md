# Story Agent preset role topology E2E verification

Date: 2026-06-01

## Scope

This pass verifies that imported preset `user` / `assistant` prompt entries are treated as Story Agent instruction context, not as real conversation turns in the provider-facing request.

Assets:

- `test-baseline-assets/character-card/Sgw3.png`
- `test-baseline-assets/preset/明月秋青v3.94.json`
- `test-baseline-assets/regex-scripts/sgw3-sample.json`

## Result

Machine-readable result:

- `docs/analysis/artifacts/2026-06-01-story-agent-preset-role-topology-summary.json`

Screenshots:

- `docs/analysis/artifacts/2026-06-01-story-agent-preset-role-topology-initial.png`
- `docs/analysis/artifacts/2026-06-01-story-agent-preset-role-topology-after-send.png`

## Request Audit

| Check | Result |
| --- | --- |
| Browser model endpoint | `/api/model-gateway/chat-completions` |
| Browser provider requests | `0` |
| Browser `Authorization` header | none |
| Browser request body provider config | no `apiKey`, no `baseUrl` |
| Gateway response | `200`, `application/json` |
| Request `stream` | `false` |
| Request `max_tokens` | `8192` |
| Request message count | `3` |
| Role shape | `1 system`, `1 assistant`, `1 user` |
| First / last role | `system` / `user` |
| Semantic system sections | `Story instructions`, `World context`, `UI render contracts` |
| Preset `user` exemplar as provider `user` | no |
| Preset `assistant` exemplar as provider `assistant` | no |
| Preset exemplars preserved in system context | yes |
| Runtime `{{...}}` placeholders | none |
| Current user input count | `1` |

## UI Audit

| Check | Result |
| --- | --- |
| Opening navigator before send | pass |
| Status panel after model reply | pass |
| Raw status JSON leak | not present |
| Raw `firstMessage 1/11` key leak | not present |

## Closed Gap

Preset prompts are no longer allowed to create synthetic provider conversation turns. The only provider `user` turn is the current player input, and the only provider `assistant` turn in this first-turn request is the selected opening.

The preset examples remain available to the model as instruction context inside the compact system block, so import semantics are preserved without corrupting conversation chronology.

