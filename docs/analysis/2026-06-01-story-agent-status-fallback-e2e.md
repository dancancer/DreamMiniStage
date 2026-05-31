# Story Agent status fallback E2E verification

Date: 2026-06-01

## Scope

This pass verifies the Sgw status panel behavior after improving the runtime fallback that creates a renderable status source when the model omits `<SFW>` / `<NSFW>` JSON.

Assets:

- `test-baseline-assets/character-card/Sgw3.png`
- `test-baseline-assets/preset/明月秋青v3.94.json`
- `test-baseline-assets/regex-scripts/sgw3-sample.json`

## Live Gateway Pass

Machine-readable result:

- `docs/analysis/artifacts/2026-06-01-story-agent-status-fallback-e2e-summary.json`

Screenshots:

- `docs/analysis/artifacts/2026-06-01-story-agent-status-fallback-initial.png`
- `docs/analysis/artifacts/2026-06-01-story-agent-status-fallback-after-send.png`

| Check | Result |
| --- | --- |
| Browser model endpoint | `/api/model-gateway/chat-completions` |
| Browser provider requests | `0` |
| Browser `Authorization` header | none |
| Browser request body provider config | no `apiKey`, no `baseUrl` |
| Gateway response | `200`, `application/json` |
| Request `stream` | `false` |
| Request `max_tokens` | `8192` |
| Request message count | `9` |
| Runtime `{{...}}` placeholders | none |
| Current user input count | `1` |
| Status panel | visible |
| Raw status JSON leak | not present |

The live model emitted a structured status panel in this run, so the fallback branch was not needed. The rendered panel included the model-provided date/time and character state.

## Forced Fallback Pass

Machine-readable result:

- `docs/analysis/artifacts/2026-06-01-story-agent-status-fallback-forced-summary.json`

Screenshot:

- `docs/analysis/artifacts/2026-06-01-story-agent-status-fallback-forced-after-send.png`

This controlled browser pass fulfilled the local gateway route with assistant text that contained a timeline line but no `<SFW>` / `<NSFW>` source tag:

- `赤羽｜2020年3月28日｜星期六｜17:05`

| Check | Result |
| --- | --- |
| Gateway request count | `1` |
| Request `stream` | `false` |
| Request `max_tokens` | `8192` |
| Current user input count | `1` |
| Status panel | visible |
| Fallback status | visible |
| Extracted date | visible |
| Extracted time | visible |
| Extracted location | visible |
| Raw status source leak | not present |

## Conclusion

The status panel now has two working paths:

- Native path: model emits structured status data and the UI renders it directly.
- Fallback path: model emits timeline/prose only, the runtime synthesizes a status source, and the UI renders it without leaking raw JSON.

