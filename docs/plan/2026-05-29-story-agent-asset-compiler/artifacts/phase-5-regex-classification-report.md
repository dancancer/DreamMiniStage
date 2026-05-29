# SAC-Phase 5 Regex Classification Report

## Corpus

The POC expands beyond `test-baseline-assets/regex-scripts` by mining embedded regex objects from real archived assets:

| Source | Scripts | Reason |
| --- | ---: | --- |
| `test-baseline-assets/regex-scripts/sgw3-sample.json` | 3 | Baseline text / prompt regex sample. |
| `test-baseline-assets/worldbook/regex-1美化夜空多选追加收起.json` | 1 | Full HTML widget with script/CSS behavior. |
| `test-baseline-assets/preset/明月秋青v3.94.json` | 10 | Real preset with multiple UI-style regex blocks. |

Total corpus size: `14` regex scripts.

## Result

| Metric | Value |
| --- | ---: |
| Total scripts | 14 |
| UI scripts | 7 |
| RenderIntent convertible UI scripts | 4 |
| UI coverage | 57.14% |
| Coverage target | >= 50% for this POC corpus |

Kind counts:

| Kind | Count |
| --- | ---: |
| `prompt_transform` | 7 |
| `render_intent_extractor` | 4 |
| `unsupported` | 3 |

Unsupported reasons:

| Reason | Count | Decision |
| --- | ---: | --- |
| `script tag is not allowed` | 3 | Do not execute. Report fallback. |

## Interpretation

This passes the Phase 5 POC target for a small corpus, but it is still a limited support claim. The product should say `RenderIntent` supports common choice/collapsible/status widgets, not arbitrary SillyTavern HTML widgets.

## Verification

```bash
pnpm vitest run lib/story-agent/render-intent/__tests__/regex-classifier.test.ts
```

