# POC-0.3 Worldbook And Regex Baseline

## Purpose

Inspect real worldbook and regex fixtures for legacy field coverage, UI regex evidence and normalized-schema gaps before Phase 1 import contract work.

## Inputs

| Asset | Hash | Why this fixture |
| --- | --- | --- |
| `test-baseline-assets/worldbook/服装随机化.json` | `bc70f58efdd12ea5249002752afa19e5bc708ffec2b2793c1ff6812d1fbf0232` | compact worldbook with legacy fields |
| `test-baseline-assets/regex-scripts/sgw3-sample.json` | `7ecc4bc81495cc02be519f7665a262571b6606bfe1f78c91f09e862a9a35783c` | real text/prompt regex wrapper |
| `test-baseline-assets/worldbook/regex-1美化夜空多选追加收起.json` | `d8af618df73523e2e28e9c687cbb0401b259c16d0f452f30d01c9fe632630050` | single UI HTML-widget regex |

## Semantic Checklist Items

- `4.世界书`: legacy `keysecondary`, `order`, `disable`, probability, depth and stateful fields must be visible to import.
- `4.世界书`: `selectiveLogic`, group and recursion fields must not be silently erased.
- `5.正则与内容渲染`: regex placement is import/classification evidence only.
- `5.正则与内容渲染`: HTML/CSS output cannot enter raw runtime rendering.

## Commands

```bash
node <<'NODE'
// Read worldbook entries and regex scripts, then print field counts,
// placement arrays, HTML-like replacement detection and sample legacy fields.
NODE
```

```bash
shasum -a 256 \
  'test-baseline-assets/worldbook/服装随机化.json' \
  'test-baseline-assets/regex-scripts/sgw3-sample.json' \
  'test-baseline-assets/worldbook/regex-1美化夜空多选追加收起.json'
```

## Observed Worldbook Output

`服装随机化.json` has 3 entries. Every entry exposes this legacy field set:

- `key`
- `keysecondary`
- `constant`
- `selective`
- `selectiveLogic`
- `order`
- `position`
- `disable`
- `probability`
- `useProbability`
- `depth`
- `group`
- `groupOverride`
- `groupWeight`
- `scanDepth`
- `caseSensitive`
- `matchWholeWords`
- `useGroupScoring`
- `sticky`
- `cooldown`
- `delay`

Observed values:

- `position`: only `4`.
- `selectiveLogic`: numeric `0`.
- `sticky`, `cooldown`, `delay`: present on all entries, value `0` in this fixture.
- first entry is `constant: true`, `selective: true`, `probability: 100`, `depth: 4`, `disable: false`.

Implementation result: `normalizeSelectiveLogic()` now maps ST numeric values into the local `SecondaryKeyLogic` enum at the import boundary. The fixture value `0` becomes `AND_ANY`.

## Observed Regex Output

| Asset | Scripts | Names | Placement | Flags | HTML-like replacement |
| --- | ---: | --- | --- | --- | --- |
| `sgw3-sample.json` | 3 | `歌曲隐藏`, `春日影 (MyGO!!!!! ver.)`, `春日影` | each `[1, 2]` | one `promptOnly`, two `markdownOnly`; all enabled; all `runOnEdit` | two scripts contain HTML-like replacement text |
| `regex-1美化夜空多选追加收起.json` | 1 | `1美化夜空多选追加收起` | `[2]` | disabled, `markdownOnly`, `runOnEdit` | full HTML/CSS document |

The UI fixture captures model output tags `<①>` through `<⑥>` and replaces them with a full HTML document. This validates the Phase 5 risk: RenderIntent conversion cannot be treated as a trivial regex mapping.

## Pass / Fail Criteria

- Pass: fixture fields are visible and can be counted deterministically.
- Pass: existing normalized worldbook contract handles numeric `selectiveLogic` through deterministic import-time mapping.
- Pass: wrapper regex scripts and single-script UI regex both enter `RegexScript[]`.
- Fail: any legacy field above is silently discarded by Phase 1 bundle schema.

## Result

- Status: `pass`
- Date: `2026-05-29`
- Output artifacts: this file, `baseline-assets.md`, `lib/adapters/import/__tests__/worldbook-import.test.ts`, `lib/adapters/import/__tests__/regex-import.test.ts`

## Decision

The following Phase 0 blocker has been closed:

- numeric-to-canonical `selectiveLogic` mapping: `0 -> AND_ANY`, `1 -> NOT_ALL`, `2 -> NOT_ANY`, `3 -> AND_ALL`.
- regex wrapper and single-script forms are both accepted by the existing regex adapter and locked by fixture tests.

## Remaining Gaps

- Need additional UI regex corpus before Phase 5 coverage claims.
- Need worldbook fixtures with non-zero sticky/cooldown/delay before Phase 4/6a state parity claims.
- Book-level provenance for flat entries remains a Phase 1 bundle schema task.
- Unsupported handling for group/recursion/scoring fields remains a Phase 1 diagnostics task.
