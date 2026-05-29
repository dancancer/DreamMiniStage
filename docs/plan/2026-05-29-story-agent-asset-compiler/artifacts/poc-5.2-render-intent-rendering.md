# POC-5.2 RenderIntent Whitelist Rendering

## Purpose

Verify that convertible UI regex can be projected into declarative `RenderIntent` objects and rendered by React whitelist components.

## Inputs

The expanded POC corpus produces four render intents:

| Intent | Kind | Source |
| --- | --- | --- |
| `choice-list` | Input option list | Embedded preset regex. |
| `collapsible-panel` | Expandable narrative block | Embedded preset regex. |
| `collapsible-panel` | Expandable summary block | Embedded preset regex. |
| `collapsible-panel` | Expandable theatre/commentary block | Embedded preset regex. |

## Command

```bash
pnpm vitest run lib/story-agent/render-intent/__tests__/regex-classifier.test.ts components/story-agent/render-intent/__tests__/RenderIntentView.test.tsx
```

## Pass Criteria

- Extracted intents include `choice-list` and `collapsible-panel`.
- Every intent has `schemaVersion = 1`.
- Renderer outputs buttons, disclosure panels and status rows through React components.
- Renderer does not create `<script>` or `<iframe>` nodes.

## Result

- Status: `pass`
- Date: `2026-05-29`
- Evidence: `regex-classifier.test.ts` and `RenderIntentView.test.tsx`

## Decision

Adopt the minimum whitelist renderer for SAC-Phase 5. Additional widget kinds must extend `RenderIntent`, not execute imported HTML.

