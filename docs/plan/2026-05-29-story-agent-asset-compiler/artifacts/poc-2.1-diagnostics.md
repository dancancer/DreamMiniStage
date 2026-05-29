# POC-2.1 Deterministic Diagnostics

## Purpose

Verify that real imported assets produce deterministic diagnostics without LLM judgment.

## Inputs

| Asset | Source path | Why this fixture |
| --- | --- | --- |
| PNG character | `test-baseline-assets/character-card/Sgw3.png` | Embedded worldbook, regex and unsupported extensions |
| Worldbook | `test-baseline-assets/worldbook/服装随机化.json` | Real ST worldbook fields |
| Preset | `test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json` | Large prompt set |
| Regex | `test-baseline-assets/regex-scripts/sgw3-sample.json` | Includes HTML UI replacement output |

## Commands

```bash
pnpm vitest run lib/adapters/import/__tests__/bundle-diagnostics.test.ts
```

## Expected Output

The real-asset test asserts these diagnostic codes:

- `character.missing_description`
- `extension.unsupported`
- `preset.empty_enabled_prompt`
- `regex.ui_html_unsupported`
- `worldbook.missing_primary_keys`
- `worldbook.selective_missing_secondary_keys`

The test also asserts that no `error` severity diagnostic is produced for this valid fixture bundle.

## Result

- Status: `pass`
- Date: `2026-05-29`
- Evidence: `lib/adapters/import/bundle-diagnostics.ts`, `lib/adapters/import/__tests__/bundle-diagnostics.test.ts`

## Decision

Use deterministic diagnostics as the input to LLM QA. LLM QA may explain or propose patches, but it does not define diagnostic facts.
