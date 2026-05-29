# POC-0.2 Preset Baseline

## Purpose

Verify that two real SillyTavern preset fixtures can be read deterministically and that `prompt_order` can be converted into stable prompt ordering evidence before runtime compilation exists.

## Inputs

| Asset | Hash | Why this fixture |
| --- | --- | --- |
| `test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json` | `6dc7fe35df191afcae7d5e181b4ecdfb30cb455cd211db0b0a39716af0e822d4` | large preset with 124 prompts and two prompt_order groups |
| `test-baseline-assets/preset/明月秋青v3.94.json` | `5822f866b5ef082e951b200367f1af4a58e7cf07420152f6cbc63a0666360f34` | system-heavy preset with 111 prompts and one prompt_order group |

## Semantic Checklist Items

- `3.预设`: prompt identity, role, content and enabled state must be preserved.
- `3.预设`: order must be recoverable from import-time `prompt_order` or normalized `group_id` / `position`.
- `3.预设`: injection position/depth must be recorded as prompt metadata.
- `3.预设`: `prompt_order` must not enter runtime configuration.

## Commands

```bash
node <<'NODE'
// Read preset JSON, count prompt roles/enabled state, inspect injection/depth fields,
// and apply the same prompt_order -> group_id/position shape used by the import adapter.
NODE
```

```bash
shasum -a 256 \
  'test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json' \
  'test-baseline-assets/preset/明月秋青v3.94.json'
```

## Observed Output

| Asset | Prompts | prompt_order groups | prompt_order entries | Enabled | Disabled | Role distribution | Injection/depth fields |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `夏瑾 Pro - Beta 0.70.json` | 124 | 2 | 61 | 12 | 112 | user 107, system 10, assistant 5, unset 2 | 122 prompts have injection/depth fields |
| `明月秋青v3.94.json` | 111 | 1 | 102 | 56 | 55 | system 106, user 2, assistant 3 | 105 prompts have injection/depth fields |

Deterministic ordering simulation:

| Asset | Normalized prompts | Missing prompt stubs | Fallback group prompts | Unique group/position pairs | First group id |
| --- | ---: | ---: | ---: | ---: | --- |
| `夏瑾 Pro - Beta 0.70.json` | 124 | 0 | 74 | 124 | `100000` |
| `明月秋青v3.94.json` | 111 | 0 | 9 | 111 | `100001` |

Observed prompt keys:

- `夏瑾`: `content`, `enabled`, `forbid_overrides`, `identifier`, `injection_depth`, `injection_position`, `marker`, `name`, `role`, `system_prompt`.
- `明月秋青`: same core set plus `injection_order` and `injection_trigger`.

## Pass / Fail Criteria

- Pass: prompt count and role distribution are stable across reads.
- Pass: all prompts receive a unique `group_id` / `position` pair after import-time conversion.
- Pass: no missing prompt stubs are required.
- Fail: `prompt_order` must remain available at runtime to assemble prompts.

## Result

- Status: `pass`
- Date: `2026-05-29`
- Output artifacts: this file and `baseline-assets.md`

## Decision

`prompt_order` is a removable import concern for these fixtures. Phase 1 should reuse or tighten the existing `convertPromptOrder` path, then make `PromptStack` consume only normalized ordering metadata.

## Remaining Gaps

- This POC does not validate model parameter normalization.
- This POC does not prove final prompt assembly parity; that belongs to `SAC-Phase 4`.
