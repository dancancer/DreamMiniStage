# POC-5.1 Regex Classification Coverage

## Purpose

Verify that real regex scripts can be classified into transform, render-intent and unsupported buckets with measurable coverage.

## Inputs

| Asset | Source path | Why this fixture |
| --- | --- | --- |
| Sgw3 sample regex | `test-baseline-assets/regex-scripts/sgw3-sample.json` | Existing text / prompt regex baseline. |
| Night-sky UI widget | `test-baseline-assets/worldbook/regex-1美化夜空多选追加收起.json` | Real full HTML widget with unsafe script path. |
| Mingyue preset | `test-baseline-assets/preset/明月秋青v3.94.json` | Embedded real preset regex corpus with UI widgets. |

## Command

```bash
pnpm vitest run lib/story-agent/render-intent/__tests__/regex-classifier.test.ts
```

## Pass Criteria

- Total corpus is at least `14` scripts.
- UI scripts are counted separately from text/prompt transforms.
- RenderIntent UI coverage is at least `50%` for this POC corpus.
- Unsupported UI rules list deterministic reasons.

## Result

- Status: `pass`
- Date: `2026-05-29`
- Total scripts: `14`
- UI scripts: `7`
- Convertible UI scripts: `4`
- Coverage: `57.14%`
- Unsupported reason: `script tag is not allowed`

## Decision

Adopt the classifier for SAC-Phase 5, but keep the product claim scoped to limited UI widget support.

