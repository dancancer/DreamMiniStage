# SAC-Phase 2 Diagnostics Taxonomy

## Decision

Diagnostics are deterministic import-time facts. They are not LLM opinions and they do not mutate imported assets.

Implementation:

- `lib/adapters/import/bundle-diagnostics.ts`
- `diagnoseImportedAssetBundle(bundle)`
- `summarizeDiagnostics(diagnostics)`

## Code Table

| Code | Severity | Meaning |
| --- | --- | --- |
| `character.missing_description` | `warning` | Character card has no description text. |
| `character.missing_first_message` | `warning` | Character card has no opening message. |
| `extension.unsupported` | `warning` | Imported extension was preserved but cannot run in the new runtime. |
| `preset.empty_enabled_prompt` | `warning` | Enabled preset prompt has no content. |
| `preset.empty_prompt_set` | `warning` | Preset contains no prompts. |
| `regex.invalid_pattern` | `warning` | Regex pattern does not compile. |
| `regex.ui_html_unsupported` | `warning` | Regex emits HTML/CSS/JS UI and must become `RenderIntent` or unsupported. |
| `worldbook.empty_content` | `warning` | Worldbook entry has no content. |
| `worldbook.missing_primary_keys` | `warning` | Entry has no primary keys and is not constant. |
| `worldbook.selective_missing_secondary_keys` | `warning` | Selective entry has no secondary keys. |
| `worldbook.stateful_activation_required` | `info` | Entry uses `sticky`, `cooldown`, or `delay`; runtime state must carry counters. |

## Invariant

The same `ImportedAssetBundle` must always produce the same diagnostics in stable sort order by severity, code, and target path.

## Verification

```bash
pnpm vitest run lib/adapters/import/__tests__/bundle-diagnostics.test.ts
```

The real asset test covers:

- `test-baseline-assets/character-card/Sgw3.png`
- `test-baseline-assets/worldbook/服装随机化.json`
- `test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json`
- `test-baseline-assets/regex-scripts/sgw3-sample.json`

The synthetic tests cover invalid regex, HTML UI regex, and stateful worldbook activation.
