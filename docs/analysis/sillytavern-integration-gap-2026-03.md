# DreamMiniStage 对齐审计（最新）

> 更新日期：2026-03-06  
> 数据来源：`docs/analysis/sillytavern-gap-report-latest.json` + `docs/analysis/sillytavern-gap-report-latest.md`

## 1. 结论摘要

- 基础桥接能力已经形成稳定底座：Script Bridge API matrix 达到 `100%` 覆盖。
- Slash 命令覆盖已完成收口：`426/426 = 100.00%`（较上一轮 `99.30%` 提升 `+0.70`pp）。
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
   - 群聊编辑：`/member-get`、`/getmember`、`/member-add`、`/addmember`、`/member-disable`、`/disable`、`/member-enable`、`/enable`、`/addswipe`、`/swipeadd`
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
   - P3 临时会话/翻译/Timed Effect：`/tempchat`、`/translate`、`/wi-get-timed-effect`、`/wi-set-timed-effect`
   - P3 收口命令：`/proxy`、`/yt-script`、`/floor-teleport`
   - P3 UI 反馈簇：`/caption`、`/beep`、`/ding`
   - P3 UI 样式/交互簇：`/bgcol`、`/bubble`、`/bubbles`、`/flat`、`/default`、`/single`、`/story`、`/buttons`
   - P3 注入清理簇：`/flushinject`、`/flushinjects`
   - P3 图像生成簇：`/imagine`、`/image`、`/img`、`/sd`、`/imagine-source`、`/img-source`、`/sd-source`、`/imagine-style`、`/img-style`、`/sd-style`、`/imagine-comfy-workflow`、`/icw`
   - P3 instruct 模式簇：`/instruct`、`/instruct-on`、`/instruct-off`、`/instruct-state`、`/instruct-toggle`
   - P3 stop/model + narrator 长尾：`/stop-strings`、`/stopping-strings`、`/custom-stopping-strings`、`/custom-stop-strings`、`/model`、`/start-reply-with`、`/name`、`/nar`、`/narrate`、`/speak`、`/tts`
   - P3 note + persona 长尾：`/note`、`/note-depth|/depth`、`/note-frequency|/note-freq|/freq`、`/note-position|/note-pos|/pos`、`/note-role`、`/persona-set|/persona`、`/persona-lock`、`/persona-sync|/sync`
   - P3 profile + prompt 长尾：`/profile`、`/profile-create`、`/profile-get`、`/profile-list`、`/profile-update`、`/prompt`、`/prompt-post-processing`、`/ppp`
   - P3 低耦合工具簇：`/dupe`、`/length`、`/is-mobile`、`/newchat`、`/random`、`/sort`、`/tokens`、`/trimstart`、`/trimend`、`/test`
   - P3 导入/弹窗簇：`/import`、`/popup`、`/pick-icon`
   - P3 工具/标签簇：`/tools-list|/tool-list`、`/tools-invoke|/tool-invoke`、`/tag-add`、`/tag-remove`、`/tag-exists`、`/tag-list`
   - P3 推理解析 + Quick Reply 第一批：`/reasoning-parse|/parse-reasoning`、`/qr`、`/qr-list`、`/qr-get`、`/qr-create`、`/qr-delete`
   - P3 Quick Reply 第二/三批 + set/preset：`/qr-set`、`/qrset`、`/qr-set-on`、`/qr-set-off`、`/qr-chat-set`、`/qr-chat-set-on`、`/qr-chat-set-off`、`/qr-set-list`、`/qr-update`、`/qr-contextadd`、`/qr-contextdel`、`/qr-contextclear`、`/qr-set-create|/qr-presetadd`、`/qr-set-update|/qr-presetupdate`、`/qr-set-delete|/qr-presetdelete`
   - P3 Secret Store 簇：`/secret-id|/secret-rotate`、`/secret-delete`、`/secret-write`、`/secret-rename`、`/secret-read|/secret-find|/secret-get`
   - P3 画廊/工具注册/QR 参数簇：`/show-gallery|/sg`、`/expression-upload|/uploadsprite`、`/tools-register|/tool-register`、`/tools-unregister|/tool-unregister`、`/qr-arg`
   - P3 vector 状态簇：`/vector-chats-state`、`/vector-files-state`、`/vector-max-entries`、`/vector-query`、`/vector-threshold`
2. 聊天编辑命令簇已完成本轮收敛：
   - `/delchat` `/delete` `/delmode` `/delname` `/delswipe`
   - 并补齐别名 `/cancel` `/swipedel`
3. 群聊成员编排长尾已收敛：
   - `/member-remove`、`/removemember`、`/memberremove`
   - `/member-up`、`/upmember`、`/memberup`
   - `/member-down`、`/downmember`、`/memberdown`
   - `/member-peek`、`/peek`、`/memberpeek`、`/peekmember`
4. Top25 优先命令缺口现已清零，slash 命令面对齐阶段可以从“补命令”切换到“守回归 + 补宿主落地”。
5. 本轮新增的收口策略继续保持单路径：`/proxy` 与 `/yt-script` 走显式宿主回调，`/floor-teleport` 复用 `/chat-jump` 现有实现，不为长尾命令再复制状态机。
6. 顺手修补了 Script Bridge Hook 注入漂移：`useScriptBridge` 现在会实际透传 `tempchat/translate/timed-effect` 相关回调，以及新增的 `proxy/yt-script` 注入位。
7. `/session` 宿主接通继续推进：
   - 已接通：`/tempchat`、`/floor-teleport`、`/proxy`（接 `model-store` 读取/切换 preset，并同步 LLM storage）。
   - Provider 模式接通：`/translate`、`/yt-script`（走 `window.__DREAMMINISTAGE_SESSION_HOST__`，宿主注入可成功；未注入保持显式 fail-fast）。
   - 继续 fail-fast：`/wi-get-timed-effect`、`/wi-set-timed-effect`。
8. 新增 bridge 注入完整性契约测试，直接守护 `CharacterChatPanel -> useScriptBridge -> ApiCallContext -> ExecutionContext` 的高价值注入位，避免再出现组件边界漏传。
9. `/session` 页面级最小集成用例已补齐：新增 refresh-remount 场景，验证同一会话在刷新后仍可稳定执行 `/floor-teleport` 并命中消息锚点。
10. 缺失宿主能力已按策略分组：
   - 待提供真实 provider：`/translate`（`onTranslateText`）、`/yt-script`（`onGetYouTubeTranscript`）。
   - 已接通并可回归：`/proxy`（`onSelectProxyPreset` 走页面 `model-store`）。
   - 故意 fail-fast：`/wi-get-timed-effect`、`/wi-set-timed-effect`（缺少稳定的 chat timed effect metadata 设计，暂不引入兼容分支）。
11. M3 回放已落地并进入可复验状态：`p4-session-replay-e2e.mjs` round9 目前仍覆盖 `/proxy` fail-fast 分支；下一轮应补 provider/配置注入后的成功分支，避免守卫陈旧预期。
12. 回放稳定性修补：`app/session/page.tsx` 将 `currentCharacter` 改为 `useMemo`，消除 header effect 的高频触发，避免 replay 中 `Maximum update depth exceeded` 噪声漂移。

### 3.3 P3（机会性补齐）

- 低频 slash 命令长尾（以真实素材触发失败为准，不按“总数”盲目推进）。
- Top25 priority command gaps 已清零；slash command 覆盖缺口已全部收口。

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

1. 为 `/translate` 与 `/yt-script` 选定并落地默认 provider（或正式宿主注入协议），将当前“可注入成功”推进为“默认可用成功”。
2. 将 P4 round9 从 `/proxy` fail-fast 断言升级为 `/proxy` 成功切换断言，并补充 `/yt-script` provider 成功回放。
3. `wi-* timed effect` 继续保持显式 fail-fast，直到 chat metadata 设计冻结后再接通，避免回退到多分支兼容路径。
