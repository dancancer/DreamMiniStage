# Story Agent E2E fix verification

Date: 2026-05-31

## Scope

This follow-up verifies the highest-priority gaps from `2026-05-31-sillytavern-plugin-e2e-gap-audit.md` after the current fixes:

- Sgw alternate-opening lifecycle is visible and no longer leaks the raw `firstMessage` i18n key.
- Documentation-style Sgw first greeting is no longer selected as the default playable opening.
- Unsupported leftover `<SFW>/<NSFW>` JSON blocks are removed before the legacy HTML parser can expose naked JSON.
- Runtime prompt placeholders that should be resolved before the model call are replaced.
- The Streaming toggle affects the actual OpenAI-compatible request body, not only the frontend display path.

## Evidence

Live browser E2E used the real `/story-agent-import` page, imported these assets, created sessions, and sent a real message to `deepseek-v4-pro` through the local browser:

- `test-baseline-assets/character-card/Sgw3.png`
- `test-baseline-assets/preset/明月秋青v3.94.json`
- `test-baseline-assets/regex-scripts/sgw3-sample.json`

Machine-readable result:

- `docs/analysis/artifacts/2026-05-31-story-agent-e2e-summary.json`

Screenshots:

- `docs/analysis/artifacts/sgw-initial-buffered.png`
- `docs/analysis/artifacts/sgw-after-send-buffered.png`
- `docs/analysis/artifacts/sgw-initial-stream.png`
- `docs/analysis/artifacts/sgw-after-send-stream.png`

## Request audit

| Mode | Response content type | Request `stream` | `stream_options` | `max_tokens` | Runtime placeholders | Status contract |
| --- | --- | --- | --- | ---: | --- | --- |
| Buffered | `application/json` | `false` | `null` | 8192 | none | present |
| Streaming | `text/event-stream; charset=utf-8` | `true` | `{ include_usage: true }` | 8192 | none | present |

Runtime placeholders checked:

- `{{char}}`
- `{{user}}`
- `{{lastUserMessage}}`
- `{{random::...}}`
- `{{trim}}`
- `<char>`
- `<user>`

## UI audit

| Check | Buffered | Streaming |
| --- | --- | --- |
| Opening navigator shows `开场白 1/11` | pass | pass |
| Raw `firstMessage 1/11` key leak | pass, not present | pass, not present |
| Default opening looks like docs/plugin instructions | pass, not present | pass, not present |
| Raw status JSON visible before send | pass, not present | pass, not present |
| Status panel visible after model reply | pass | pass |
| Raw status JSON visible after model reply | pass, not present | pass, not present |

## Tests

Targeted regression checks:

```bash
pnpm vitest run lib/story-agent/runtime/__tests__/story-session.test.ts lib/story-agent/render-intent/__tests__/runtime.test.ts lib/story-agent/runtime/__tests__/state-update.test.ts
pnpm vitest run function/dialogue/__tests__/opening-baseline.test.ts
```

## Remaining gaps

These are still real product gaps, but they are no longer blocking the current high-priority fixes:

- Prompt topology is still fragmented. Sgw sends 44 messages; a future prompt normalizer should compact adjacent same-role fragments into named semantic blocks.
- Initial Sgw opening does not show a status panel until the first generated reply, because the opening itself does not carry a matching status payload.
- Cards with a single instruction-only opener still need a product decision: hidden trigger plus generated playable opener, or explicit unsupported diagnostic.
- MagVarUpdate is still only covered for emitted `<UpdateVariable>` commands. Initial variable seeding and richer update semantics remain separate work.
- UI regex coverage still depends on whether the import compiler can convert the source into a whitelisted RenderIntent.
