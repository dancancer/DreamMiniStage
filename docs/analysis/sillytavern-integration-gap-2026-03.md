# DreamMiniStage 对齐审计（最新）

> 更新日期：2026-03-05  
> 数据来源：`docs/analysis/sillytavern-gap-report-latest.json` + `docs/analysis/sillytavern-gap-report-latest.md`

## 1. 结论摘要

- 基础桥接能力已经形成稳定底座：Script Bridge API matrix 达到 `100%` 覆盖。
- Slash 命令覆盖面继续提升：`143/426 = 33.57%`（较上一轮 `31.22%` 提升 `+2.35`pp）。
- TavernHelper facade 已完成收敛：`141/141 = 100.00%`。
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

- P1 项已清零：`/message` 与 `injectPrompts/uninjectPrompts` 均已完成并进入回归守卫。

### 3.2 P2（主流程体验缺口）

1. 已完成本轮高价值命令簇收敛：
   - world/lore：`/world`、`/getcharlore`、`/getchatlore`、`/getgloballore`、`/getpersonalore`、`/getlorefield`、`/setlorefield`
   - world/lore 语义别名：`/getcharbook`、`/getchatbook`、`/getglobalbooks`、`/getpersonabook`
   - regex/chat：`/regex-preset`、`/regex-toggle`、`/chat-jump`、`/chat-render`、`/chat-scrollto`
   - prompt/message 元数据：`/message-name`、`/message-role`、`/getpromptentry`、`/getpromptentries`、`/setpromptentry`、`/setpromptentries`
2. 仍待推进的 P2 长尾以高频编辑/会话运维命令为主：
   - `/getchatname`
   - `/getentryfield` `/setentryfield`（与 lore field 别名体系对齐）
   - `/setinput`、`/set-reasoning`、`/get-reasoning` 等会话运维命令
3. 聊天编辑命令簇已完成本轮收敛：
   - `/delchat` `/delete` `/delmode` `/delname` `/delswipe`
   - 并补齐别名 `/cancel` `/swipedel`
4. API 层 P2 缺口已基本清空，后续以 Slash 命令可用性为主战场。

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

1. 补齐 world-info 字段别名命令：`/getentryfield`、`/setentryfield`，与 `get/setlorefield` 统一语义。
2. 推进会话态命令缺口：`/getchatname`、`/setinput`，补强脚本运维链路。
3. 把 `delchat/delswipe/message-*` 接入宿主真实 UI 回调，确保“命令可执行”与“界面可见效果”一致。
