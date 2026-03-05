# DreamMiniStage 对齐审计（最新）

> 更新日期：2026-03-05  
> 数据来源：`docs/analysis/sillytavern-gap-report-latest.json` + `docs/analysis/sillytavern-gap-report-latest.md`

## 1. 结论摘要

- 基础桥接能力已经形成稳定底座：Script Bridge API matrix 达到 `100%` 覆盖。
- 当前主缺口不在“接口联通”，而在“Slash 命令覆盖面”：`107/426 = 25.12%`。
- TavernHelper facade 仍有少量关键缺口：`134/141 = 95.04%`，当前缺口以 `injectPrompts/uninjectPrompts` 为 P1。
- 基线素材体系已可用于持续回归：`test-baseline-assets` 覆盖 `12/12`，未覆盖资产为 `0`。

## 2. 上游同步状态（本地快照）

- `sillytavern-plugins/SillyTavern`: `e41bcf0cc`
- `sillytavern-plugins/JS-Slash-Runner`: `360ce466`
- `sillytavern-plugins/MagVarUpdate`: `28c4b81`
- `sillytavern-plugins/SillyTavern-EdgeTTS-Plugin`: `d8d1507`
- `sillytavern-plugins/SillyTavern-Fandom-Scraper`: `84483e5`
- `sillytavern-plugins/SillyTavern-Office-Parser`: `44ce12e`

## 3. 差距分层

### 3.1 P1（必须优先处理）

1. Slash `/message` 命令缺失（在差距评分中唯一 P1 命令项）。
2. TavernHelper 缺失：
   - `injectPrompts`
   - `uninjectPrompts`

### 3.2 P2（主流程体验缺口）

1. World/Lore 相关命令簇：
   - `/world`
   - `/getcharlore` `/getchatlore` `/getgloballore` `/getpersonalore`
   - `/getlorefield` `/setlorefield`
2. Regex 运维命令：
   - `/regex-preset`
   - `/regex-toggle`
3. 消息/聊天操作长尾：
   - `/chat-jump` `/chat-render` `/chat-scrollto`
   - `/delchat` `/delete` `/delmode` `/delname` `/delswipe` 等
4. TavernHelper 角色/消息相关缺口：
   - `createCharacter`
   - `createOrReplaceCharacter`
   - `deleteCharacter`
   - `replaceCharacter`
   - `updateCharacterWith`
   - `getCurrentCharacterName`
   - `refreshOneMessage`

### 3.3 P3（机会性补齐）

- 低频 slash 命令长尾（以真实素材触发失败为准，不按“总数”盲目推进）。

## 4. 基线素材与回归状态

- 资产覆盖：`12/12 covered`
- 目录健康：`character-card/preset/worldbook/regex-scripts/slash-scripts/mvu-examples` 全部 `ready`
- 新接入真实回放素材：
  - `test-baseline-assets/regex-scripts/sgw3-sample.json`
  - `test-baseline-assets/slash-scripts/control-flow-replay.json`
  - `test-baseline-assets/mvu-examples/variable-chain.json`
  - `test-baseline-assets/worldbook/regex-1美化夜空多选追加收起.json`

## 5. 当前策略

- 单路径：同一能力仅保留一个主实现路径。
- fail-fast：未支持能力显式报错，不加静默兜底。
- 素材驱动：优先根据 `test-baseline-assets` 的真实触发路径推进修复。
- 指标驱动：每轮都更新 gap report + 定向回归。

## 6. 下一阶段目标（短周期）

1. 先补 `/message` + world/lore/regex 命令簇，优先提升可用主流程。
2. 落地 `injectPrompts/uninjectPrompts`，补齐脚本提示词注入能力。
3. 补齐 TavernHelper 角色 CRUD 与 `refreshOneMessage`，收敛 JS-Slash-Runner 兼容断点。
