# SAC-Phase 5 RenderIntent Contract

## Decision

`renderRules` graduates from the Phase 3 deferred contract into a stable `SessionBlueprint` field in SAC-Phase 5.

Implementation:

- `lib/story-agent/render-intent/types.ts`
- `lib/story-agent/render-intent/classifier.ts`
- `lib/story-agent/render-intent/extractor.ts`
- `components/story-agent/render-intent/RenderIntentView.tsx`
- `lib/story-agent/blueprint/compiler.ts`

`SESSION_BLUEPRINT_SCHEMA_VERSION` is bumped to `2`. `memoryPolicy` remains deferred until `SAC-Phase 6b`.

## Schema

`RenderIntent` is versioned independently from `SessionBlueprint`.

| Intent kind | Purpose | Data source | Renderer |
| --- | --- | --- | --- |
| `choice-list` | Convert regex-generated choices into appendable input buttons. | Regex capture templates. | `Button` list. |
| `collapsible-panel` | Convert hidden or expandable narrative blocks into a controlled disclosure. | Regex capture template `$1`. | Native `details` / `summary`. |
| `status-panel` | Convert structured status fields into label/value rows. | `data-field` markers and capture templates. | Definition list. |

Unsupported or unsafe HTML never enters this schema. It produces an `UnsupportedRegexFallback` instead.

## Runtime Rule

The renderer accepts only structured `RenderIntent` objects. It does not accept raw HTML, CSS or JavaScript. Captured values are interpolated as React text nodes, so strings such as `<script>bad()</script>` render as text instead of executable DOM.

## Blueprint Hash Rule

`renderRules` is included in the stable hash input starting with schema version `2`. Any later change to the `RenderIntent` schema or extractor output must bump the blueprint schema version again.

## Verification

```bash
pnpm vitest run lib/story-agent/render-intent/__tests__/regex-classifier.test.ts components/story-agent/render-intent/__tests__/RenderIntentView.test.tsx lib/story-agent/blueprint/__tests__/compiler.test.ts
```

