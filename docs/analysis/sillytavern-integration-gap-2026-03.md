# DreamMiniStage 对齐审计（最新）

> 更新日期：2026-03-05  
> 数据来源：`docs/analysis/sillytavern-gap-report-latest.json` + `docs/analysis/sillytavern-gap-report-latest.md`

## 1. 结论摘要

- 基础桥接能力已经形成稳定底座：Script Bridge API matrix 达到 `100%` 覆盖。
- Slash 命令覆盖面继续提升：`316/426 = 74.18%`（较上一轮 `70.66%` 提升 `+3.52`pp）。
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
   - world/lore 语义别名：`/getcharbook`、`/getchatbook`、`/getglobalbooks`、`/getpersonabook`、`/getentryfield`、`/setentryfield`
   - regex/chat：`/regex-preset`、`/regex-toggle`、`/chat-jump`、`/chat-render`、`/chat-scrollto`
   - 会话运维：`/getchatname`、`/setinput`
   - 会话运维长尾：`/closechat`、`/count`、`/input`、`/member-count`、`/countmember`、`/membercount`、`/cut`
   - 群聊编辑：`/member-get`、`/getmember`、`/member-add`、`/addmember`、`/member-disable`、`/disable`、`/member-enable`、`/enable`、`/addswipe`
   - 会话推理/注入运维：`/reasoning-get`、`/get-reasoning`、`/reasoning-set`、`/set-reasoning`、`/listinjects`
   - prompt/message 元数据：`/message-name`、`/message-role`、`/getpromptentry`、`/getpromptentries`、`/setpromptentry`、`/setpromptentries`
   - 脚本运维：`/delay`、`/wait`、`/sleep`、`/generate-stop`、`/genraw`、`/list-gallery`、`/listchatvar`
   - worldinfo 长尾首簇：`/findentry`、`/findlore`、`/findwi`、`/createlore`、`/createwi`、`/vector-worldinfo-state`
   - UI 背景运维：`/lockbg`、`/bglock`、`/unlockbg`、`/bgunlock`、`/autobg`、`/bgauto`
   - P3 脚本调试簇：`/ask`、`/context`、`/clipboard-get`、`/clipboard-set`
   - P3 Data Bank 运维簇：`/data-bank`、`/data-bank-list`、`/data-bank-get`、`/data-bank-add`、`/data-bank-update`、`/data-bank-delete`、`/data-bank-disable`、`/data-bank-enable`、`/data-bank-ingest`、`/data-bank-purge`、`/data-bank-search`
   - P3 闭包/Persona Lock 簇：`/closure-serialize`、`/closure-deserialize`、`/lock`、`/bind`
   - P3 expression 簇：`/expression-set`、`/sprite`、`/emote`、`/expression-folder-override`、`/spriteoverride`、`/costume`、`/expression-last`、`/lastsprite`、`/expression-list`、`/expressions`、`/expression-classify`、`/classify`
   - P3 extension 运维簇：`/extension-enable`、`/extension-disable`、`/extension-toggle`、`/extension-state`、`/extension-exists`、`/extension-installed`
   - P3 UI 反馈簇：`/caption`、`/beep`、`/ding`
   - P3 UI 样式/交互簇：`/bgcol`、`/bubble`、`/bubbles`、`/flat`、`/default`、`/single`、`/story`、`/buttons`
   - P3 注入清理簇：`/flushinject`、`/flushinjects`
   - P3 图像生成簇：`/imagine`、`/image`、`/img`、`/imagine-source`、`/img-source`、`/imagine-style`、`/img-style`、`/imagine-comfy-workflow`、`/icw`
   - P3 instruct 模式簇：`/instruct`、`/instruct-on`、`/instruct-off`、`/instruct-state`、`/instruct-toggle`
   - P3 stop/model + narrator 长尾：`/stop-strings`、`/stopping-strings`、`/custom-stopping-strings`、`/custom-stop-strings`、`/model`、`/name`、`/nar`、`/narrate`
   - P3 note + persona 长尾：`/note`、`/note-depth|/depth`、`/note-frequency|/note-freq|/freq`、`/note-position|/note-pos|/pos`、`/note-role`、`/persona-set|/persona`、`/persona-lock`、`/persona-sync|/sync`
2. 聊天编辑命令簇已完成本轮收敛：
   - `/delchat` `/delete` `/delmode` `/delname` `/delswipe`
   - 并补齐别名 `/cancel` `/swipedel`
3. 群聊成员编排长尾已收敛：
   - `/member-remove`、`/removemember`、`/memberremove`
   - `/member-up`、`/upmember`、`/memberup`
   - `/member-down`、`/downmember`、`/memberdown`
   - `/member-peek`、`/peek`、`/memberpeek`、`/peekmember`
4. Top25 优先命令缺口已不再包含 P1/P2 项，当前主战场切换为 P3 长尾命令可用性。

### 3.3 P3（机会性补齐）

- 低频 slash 命令长尾（以真实素材触发失败为准，不按“总数”盲目推进）。
- Top25 已进一步移除 `note*`、`depth/freq/pos`、`persona*`；当前主要剩余转为 profile/prompt 与低频工具命令（`dupe`、`length`、`import`、`popup` 等）。

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

1. 推进 profile 命令簇（`/profile`、`/profile-create`、`/profile-get`、`/profile-list`、`/profile-update`、`/ppp`），优先复用现有本地状态存储路径并补齐严格返回值契约。
2. 推进 prompt 长尾命令（`/prompt`、`/prompt-post-processing`），复用 prompt entry 通道，避免新增并行状态源。
3. 为 `member-*/addswipe`、`data-bank-search` 与 `vector-worldinfo-state` 增加端到端 UI/结果可见断言，继续收紧回归面。
