# SAC-Phase 0 Baseline Assets

> 本文件记录 `test-baseline-assets` 的实测清单。它是后续 POC 的 fixture 索引，不是产品运行时契约。

## 1. 资产总览

| Path | Type | Observed facts | Phase 0 use |
| --- | --- | --- | --- |
| `test-baseline-assets/character-card/2.png` | PNG character card | `chara_card_v3` / `3.0`; name `本源计划：废土机娘养成`; embedded worldbook 553 entries; regex 7 scripts | large embedded worldbook + regex import stress case |
| `test-baseline-assets/character-card/3.png` | PNG character card | name `海鸥小岛与天堂`; embedded worldbook 16 entries; no regex; has `tavern_helper` extension | extension diagnostics and small worldbook case |
| `test-baseline-assets/character-card/Sgw3.png` | PNG character card | name `【Sgw】又看一集`; embedded worldbook 140 entries; regex 44 scripts; has TavernHelper extensions | primary full bundle POC fixture |
| `test-baseline-assets/character-card/V2.0Beta.png` | PNG character card | name `诡秘剧场`; embedded worldbook 235 entries; regex 12 scripts; has TavernHelper extensions | large narrative card fixture |
| `test-baseline-assets/character-card/Sgw3.card.json` | JSON character card | size 923493 bytes; name `【Sgw】又看一集`; embedded worldbook 140; regex 44 | PNG/JSON parity fixture |
| `test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json` | ST preset | size 87363 bytes; prompts 124; prompt_order 2; roles: user 107, system 10, assistant 5, unset 2 | large prompt ordering fixture |
| `test-baseline-assets/preset/明月秋青v3.94.json` | ST preset | size 222649 bytes; prompts 111; prompt_order 1; roles: system 106, user 2, assistant 3 | system-heavy preset fixture |
| `test-baseline-assets/preset/1.txt` | text preset note | plain text fixture | diagnostic edge case |
| `test-baseline-assets/regex-scripts/sgw3-sample.json` | regex wrapper | 3 scripts; text/prompt oriented; no HTML widget | transform/filter fixture |
| `test-baseline-assets/worldbook/regex-1美化夜空多选追加收起.json` | regex-like worldbook file | one UI regex script; replacement is full HTML/CSS document using custom captured tags | RenderIntent feasibility fixture |
| `test-baseline-assets/worldbook/服装随机化.json` | worldbook | 3 entries; uses `keysecondary`, `selectiveLogic`, `probability`, `depth`, `sticky`, `cooldown`, `delay` fields | worldbook legacy field fixture |
| `test-baseline-assets/mvu-examples/variable-chain.json` | MVU example | variable chain sample with `initial` / `update` / `insert` / `expect` | prompt/variable convention inventory |
| `test-baseline-assets/slash-scripts/control-flow-replay.json` | slash script example | script + expected replay fixture | script-bridge unsupported/control-flow fixture |

## 2. Character Card POC Notes

`Sgw3.png` and `Sgw3.card.json` are the primary parity pair. Both describe `【Sgw】又看一集`, both expose 140 embedded worldbook entries and 44 regex scripts. Phase 1 must prove that PNG and JSON import create explainable bundle diffs rather than unrelated shape drift.

Observed extension keys across cards include:

- `talkativeness`
- `fav`
- `world`
- `depth_prompt`
- `regex_scripts`
- `TavernHelper_scripts`
- `tavern_helper`

Runtime handling rule: extension content is import-time evidence only unless it is compiled into a typed DreamMiniStage contract. No extension script executes in `/session`.

## 3. Preset POC Notes

The two JSON presets are enough to validate prompt count, role distribution and ordering migration:

- `夏瑾 Pro - Beta 0.70.json`: 124 prompts, 2 prompt_order groups.
- `明月秋青v3.94.json`: 111 prompts, 1 prompt_order group.

Important storage fact: current preset storage already uses `group_id` / `position`; `prompt_order` is synthesized only in the `PresetNodeTools -> STPromptManager` bridge. Phase 0 should not estimate storage migration work for `prompt_order`.

## 4. Worldbook POC Notes

`服装随机化.json` is a compact external worldbook fixture. It includes the legacy field set needed to test import normalization:

- `key`
- `keysecondary`
- `selectiveLogic`
- `order`
- `position`
- `disable`
- `probability`
- `depth`
- `sticky`
- `cooldown`
- `delay`

`Sgw3.card.json` embedded worldbook is larger and exercises regex key matching:

- total entries: 140
- constant entries: 20
- selective entries: 140
- regex key usage: 140
- observed positions: after char 61, before char 79

Phase 4 must separately validate sticky, cooldown, delay, recursion, depth and insertion order because they are runtime state semantics, not just static fields.

## 5. Regex POC Notes

The current repo corpus is not enough to prove UI regex coverage:

- `regex-scripts/sgw3-sample.json` has only 3 text/prompt-oriented scripts.
- `worldbook/regex-1美化夜空多选追加收起.json` is the only confirmed HTML widget style fixture in this corpus.

Phase 5 must expand UI regex samples before claiming RenderIntent coverage. Until then, Phase 0 can only prove classification and unsupported reporting mechanics.

## 6. Phase 0 Fixture Decisions

- Primary bundle fixture: `Sgw3.png` + `夏瑾 Pro - Beta 0.70.json` + `服装随机化.json` + `sgw3-sample.json`.
- PNG/JSON parity fixture: `Sgw3.png` vs `Sgw3.card.json`.
- UI regex fixture: `regex-1美化夜空多选追加收起.json`.
- Script unsupported fixture: `control-flow-replay.json`.
- Variable convention fixture: `variable-chain.json`.

## 7. Open Coverage Gaps

- More HTML-widget regex samples are required before Phase 5.
- More worldbooks with non-zero sticky/cooldown/delay counters are required before Phase 4/6a parity claims.
- TavernHelper/MVU fixtures need prompt-convention extraction only; execution remains out of scope.
