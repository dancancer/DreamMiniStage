# POC-0.1 Character Card Baseline

## Purpose

Verify that Phase 0 can read the available character-card fixtures and capture the fields that matter before adapter/schema work starts.

## Inputs

| Asset | Hash | Why this fixture |
| --- | --- | --- |
| `test-baseline-assets/character-card/2.png` | `b03b377a780b37dfb103a402bf7741b37973687be2e13a5a74b526bee5bc3218` | large embedded worldbook |
| `test-baseline-assets/character-card/3.png` | `603f797db1ed4cb40836590812b5346bbb9b1de0eb996de3808e512d47591d82` | small worldbook with helper extension |
| `test-baseline-assets/character-card/Sgw3.png` | `e28a8ae10526dc9e62575fdf059a2e0390c0688599b0e868ad88a126be6fd21d` | primary PNG fixture |
| `test-baseline-assets/character-card/V2.0Beta.png` | `259384735281e45e4fa287211a15d62dfb2c64dfbef45e33c0d74e51747d95d4` | large narrative card |
| `test-baseline-assets/character-card/Sgw3.card.json` | `de056968cd85f485b3bec9fb37957e7a7ce839b4d64168413aacaf63eba4d014` | JSON parity fixture for `Sgw3.png` |

## Semantic Checklist Items

- `2.角色卡`: identity and core narrative fields must remain distinguishable.
- `2.角色卡`: embedded `character_book` goes through worldbook import.
- `2.角色卡`: embedded `regex_scripts` goes through regex import.
- `6.脚本与变量约定`: TavernHelper/MVU extensions are not executable runtime code.

## Command

```bash
node <<'NODE'
// Read PNG tEXt chunks and JSON card payloads, then print name/worldbook/regex/extensions.
NODE
```

The inspection command was read-only and did not write generated files.

## Observed Output

| Asset | Name | Embedded worldbook entries | Embedded regex scripts | Extension keys |
| --- | --- | ---: | ---: | --- |
| `2.png` | `本源计划：废土机娘养成` | 553 | 7 | `talkativeness`, `fav`, `world`, `depth_prompt`, `regex_scripts` |
| `3.png` | `海鸥小岛与天堂` | 16 | 0 | `talkativeness`, `fav`, `world`, `depth_prompt`, `regex_scripts`, `tavern_helper` |
| `Sgw3.png` | `【Sgw】又看一集` | 140 | 44 | `talkativeness`, `fav`, `world`, `depth_prompt`, `regex_scripts`, `TavernHelper_scripts`, `tavern_helper` |
| `V2.0Beta.png` | `诡秘剧场` | 235 | 12 | `talkativeness`, `fav`, `world`, `depth_prompt`, `regex_scripts`, `TavernHelper_scripts`, `tavern_helper` |
| `Sgw3.card.json` | `【Sgw】又看一集` | 140 | 44 | `talkativeness`, `fav`, `world`, `depth_prompt`, `regex_scripts`, `TavernHelper_scripts`, `tavern_helper` |

## Pass / Fail Criteria

- Pass: all five files can be read and counted without executing embedded scripts.
- Pass: PNG/JSON parity fixture exposes matching worldbook and regex counts.
- Fail: any embedded worldbook or regex payload is silently ignored.

## Result

- Status: `pass`
- Date: `2026-05-29`
- Output artifacts: `baseline-assets.md`

## Decision

Use `Sgw3.png` and `Sgw3.card.json` as the Phase 1 parity pair. Treat `TavernHelper_scripts` and `tavern_helper` as extension artifacts until a later POC proves a prompt-convention subset can be compiled safely.
