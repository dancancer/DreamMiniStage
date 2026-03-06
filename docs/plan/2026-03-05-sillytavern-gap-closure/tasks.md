# 执行清单（2026-03-05）

## 1. P1（最高优先）

- [x] 补齐 `/message` slash 命令及契约测试。
- [x] 实现 `injectPrompts` 与 `uninjectPrompts` shim/handler 闭环。
- [x] 更新能力矩阵并校验 API facade 差距变化。

## 2. P2（主流程）

- [x] 补齐 world/lore 命令簇第一批（`/world` + `get/set lore*`）。
- [x] 补齐 regex/chat 命令簇第二批（`/regex-*` + `/chat-*`）。
- [x] 补齐 TavernHelper 角色 CRUD 与 `refreshOneMessage`。

## 3. 回归与文档

- [x] 运行 `pnpm analyze:sillytavern-gap` 并更新最新报告。
- [x] 运行 baseline + material replay 定向测试。
- [x] 更新分析文档与计划状态（仅保留当前版本，历史进档案）。

## 4. P2 增量收敛（本轮）

- [x] 补齐 world/lore 语义别名（`/getcharbook` `/getchatbook` `/getglobalbooks` `/getpersonabook`）。
- [x] 补齐消息元数据与 prompt-entry 命令（`/message-name` `/message-role` `/getpromptentry*` `/setpromptentry*`）。
- [x] 更新能力矩阵、契约测试与 handoff 进展记录。

## 5. P2 增量收敛（续）

- [x] 补齐 world-info 字段别名命令（`/getentryfield` `/setentryfield`），统一到 lore field 单路径实现。
- [x] 补齐会话运维命令（`/getchatname` `/setinput`），并接入 Script Bridge/UI 上下文回调。
- [x] 运行定向回归 + gap 分析并更新报告与 handoff。

## 6. P2 增量收敛（会话推理/注入）

- [x] 补齐会话推理命令（`/reasoning-get` `/get-reasoning` `/reasoning-set` `/set-reasoning`），支持默认末条消息与 `at=` 定位。
- [x] 补齐注入运维命令（`/listinjects`），并打通 Slash `/inject` 与 `injectPrompts` 的共享注入存储。
- [x] 运行定向回归 + gap 分析并更新文档与 handoff。

## 7. P2 增量收敛（群聊编辑）

- [x] 补齐群聊编辑命令（`/member-get` `/getmember` `/member-add` `/addmember` `/addswipe`）并统一 fail-fast 语义。
- [x] 扩展 Slash 执行上下文（ExecutionContext / Script Bridge）以支持 `getGroupMember`、`addGroupMember`、`addSwipe` 回调。
- [x] 运行定向回归 + gap 分析并更新文档与 handoff。

## 8. P2 增量收敛（脚本运维）

- [x] 补齐脚本运维命令（`/delay` `/wait` `/sleep` `/generate-stop` `/genraw` `/list-gallery`）。
- [x] 补齐变量别名命令（`/listchatvar`）并同步 Slash capability matrix。
- [x] 运行定向回归 + gap 分析并更新文档与 handoff。

## 9. P3 增量收敛（worldinfo 长尾）

- [x] 补齐 worldinfo 长尾命令簇（`/findentry|/findlore|/findwi`、`/createlore|/createwi`、`/vector-worldinfo-state`）。
- [x] 为 `createWorldBookEntry(file)` 与 vector-worldinfo 状态补齐 Slash 上下文适配，确保命令可在宿主路径执行。
- [x] 运行定向回归 + gap 分析并更新报告与 handoff。

## 10. P3 增量收敛（背景运维）

- [x] 补齐背景运维命令簇（`/lockbg|/bglock`、`/unlockbg|/bgunlock`、`/autobg|/bgauto`），统一 fail-fast 语义。
- [x] 扩展 Slash 执行上下文（ExecutionContext / Script Bridge）以支持背景锁定与自动切换回调透传。
- [x] 运行定向回归 + gap 分析并更新报告、分析文档与 handoff。

## 11. P3 增量收敛（上下文/剪贴板）

- [x] 补齐脚本调试命令簇（`/ask`、`/context`、`/clipboard-get`、`/clipboard-set`），统一宿主回调单路径与 fail-fast 语义。
- [x] 扩展 Slash 执行上下文（ExecutionContext / Script Bridge）透传 `ask/context/clipboard` 回调能力。
- [x] 运行定向回归 + gap 分析并更新报告、分析文档与 handoff。

## 12. P3 增量收敛（Data Bank）

- [x] 补齐 Data Bank 命令簇（`/data-bank`、`/data-bank-list`、`/data-bank-get`、`/data-bank-add`、`/data-bank-update`、`/data-bank-delete`、`/data-bank-disable`、`/data-bank-enable`、`/data-bank-ingest`、`/data-bank-purge`、`/data-bank-search`）并统一 fail-fast 语义。
- [x] 扩展 Slash 执行上下文（ExecutionContext / Script Bridge）透传 Data Bank 运维回调能力。
- [x] 运行定向回归 + gap 分析并更新报告、分析文档与 handoff。

## 13. P3 增量收敛（闭包/Persona Lock）

- [x] 补齐闭包与 Persona Lock 命令簇（`/closure-serialize`、`/closure-deserialize`、`/lock`、`/bind`），统一单路径序列化与 fail-fast 语义。
- [x] 扩展 Slash 执行上下文（ExecutionContext / Script Bridge）透传 `setPersonaLock` 回调能力，确保 `/lock|/bind` 可由宿主接管。
- [x] 运行定向回归 + gap 分析并更新报告、分析文档与 handoff。

## 14. P2 收敛收口（member enable/disable）

- [x] 补齐群聊成员启停命令簇（`/member-disable|/disable|/disablemember`、`/member-enable|/enable|/enablemember`）并统一 fail-fast 语义。
- [x] 扩展 Slash 执行上下文（ExecutionContext / Script Bridge）透传 `setGroupMemberEnabled` 回调能力，确保成员启停命令可由宿主接管。
- [x] 运行定向回归 + gap 分析并更新报告、分析文档与 handoff。

## 15. P3 增量收敛（Expression 命令簇）

- [x] 补齐表情命令簇（`/expression-set|/sprite|/emote`、`/expression-folder-override|/spriteoverride|/costume`、`/expression-last|/lastsprite`、`/expression-list|/expressions`、`/expression-classify|/classify`），统一单路径与 fail-fast 语义。
- [x] 扩展 Slash 执行上下文（ExecutionContext / Script Bridge）透传 expression 相关回调能力，确保命令可由宿主接管。
- [x] 运行定向回归 + gap 分析并更新报告、分析文档与 handoff。

## 16. P3 增量收敛（Extension 命令簇）

- [x] 补齐扩展运维命令簇（`/extension-enable`、`/extension-disable`、`/extension-toggle`、`/extension-state`、`/extension-exists|/extension-installed`），统一单路径与 fail-fast 语义。
- [x] 扩展 Slash 执行上下文（ExecutionContext / Script Bridge）透传 extension 相关回调能力，并为宿主路径补齐 `window.pluginRegistry` 默认适配。
- [x] 运行定向回归 + gap 分析并更新报告、分析文档与 handoff。

## 17. P3 增量收敛（caption/beep）

- [x] 补齐 UI 反馈命令簇（`/caption`、`/beep|/ding`），统一单路径与 fail-fast 语义。
- [x] 扩展 Slash 执行上下文（ExecutionContext / Script Bridge）透传 `generateCaption`、`playNotificationSound` 回调能力。
- [x] 运行定向回归 + gap 分析并更新报告、分析文档与 handoff。

## 18. P3 增量收敛（UI 样式 + 注入清理）

- [x] 补齐 UI 样式/交互命令簇（`/bgcol`、`/bubble|/bubbles`、`/flat|/default`、`/single|/story`、`/buttons`），统一单路径与 fail-fast 语义。
- [x] 补齐注入清理命令（`/flushinject|/flushinjects`），并接入会话作用域注入存储清理闭环。
- [x] 扩展 Slash 执行上下文（ExecutionContext / Script Bridge）透传 `setAverageBackgroundColor/setChatDisplayMode/showButtonsPopup/removePromptInjections`，并补齐宿主默认实现。
- [x] 运行定向回归 + gap 分析并更新报告、分析文档与 handoff。

## 19. P3 增量收敛（会话运维长尾）

- [x] 补齐会话运维命令簇（`/closechat`、`/count`、`/member-count|/countmember|/membercount`、`/cut`），并补齐输入别名 `/input`。
- [x] 扩展 Slash 执行上下文（ExecutionContext / Script Bridge）透传 `closeCurrentChat/getGroupMemberCount` 回调能力，并补齐 `closechat` 宿主默认实现。
- [x] 运行定向回归 + gap 分析并更新报告、分析文档与 handoff。

## 20. P3 增量收敛（图像 + instruct）

- [x] 补齐图像命令簇（`/imagine|/image|/img`、`/imagine-source|/img-source`、`/imagine-style|/img-style`、`/imagine-comfy-workflow|/icw`），统一宿主回调单路径与参数校验 fail-fast。
- [x] 补齐 instruct 命令簇（`/instruct`、`/instruct-on`、`/instruct-off`、`/instruct-state|/instruct-toggle`），统一状态读写单路径与返回值契约校验。
- [x] 扩展 Slash 执行上下文（ExecutionContext / Script Bridge）透传 image/instruct 回调能力，并更新能力矩阵、回归测试与 handoff。

## 21. P3 增量收敛（stop/model + member 编排）

- [x] 补齐 stop/model/narrator 长尾命令（`/stop-strings|/stopping-strings|/custom-stop-strings|/custom-stopping-strings`、`/model`、`/name`、`/nar`、`/narrate`），统一单路径与 fail-fast 语义。
- [x] 补齐群聊成员编排命令（`/member-remove|/removemember|/memberremove`、`/member-up|/upmember|/memberup`、`/member-down|/downmember|/memberdown`、`/member-peek|/peek|/memberpeek|/peekmember`）。
- [x] 扩展 Slash 执行上下文（ExecutionContext / Script Bridge）透传 stop/model/narrate 与成员编排回调，补齐契约测试并更新 gap 分析与 handoff。

## 22. P3 增量收敛（note + persona）

- [x] 补齐 note/persona 长尾命令簇（`/note`、`/note-depth|/depth`、`/note-frequency|/note-freq|/freq`、`/note-position|/note-pos|/pos`、`/note-role`、`/persona-set|/persona`、`/persona-lock`、`/persona-sync|/sync`），统一单路径与 fail-fast 语义。
- [x] 扩展 Slash 执行上下文（ExecutionContext / Script Bridge）透传 `get/setAuthorNoteState`、`get/setPersonaName`、`getPersonaLockState`、`syncPersona`，并在宿主默认路径补齐 localStorage + 注入存储联动。
- [x] 运行定向回归 + gap 分析并更新报告、分析文档与 handoff。

## 23. P3 增量收敛（profile + prompt）

- [x] 补齐 profile/prompt 长尾命令簇（`/profile`、`/profile-create`、`/profile-get`、`/profile-list`、`/profile-update`、`/prompt`、`/prompt-post-processing|/ppp`），统一单路径与 fail-fast 语义。
- [x] 扩展 Slash 执行上下文（ExecutionContext / Script Bridge）透传 profile/prompt-post-processing 回调能力，并在宿主默认路径补齐 localStorage 存储（profiles/selected/ppp）。
- [x] 运行定向回归 + gap 分析并更新报告、分析文档与 handoff。

## 24. P3 增量收敛（工具 + 弹窗导入）

- [x] 补齐低耦合工具命令簇（`/dupe`、`/length`、`/is-mobile`、`/newchat`），统一单路径与 fail-fast 语义。
- [x] 补齐导入/弹窗命令簇（`/import`、`/popup`、`/pick-icon`），并补齐宿主透传位与默认实现（popup/pick-icon/is-mobile）。
- [x] 运行定向回归 + gap 分析并更新报告、分析文档与 handoff。

## 25. P3 增量收敛（推理解析 + Quick Reply 第一批）

- [x] 补齐推理解析命令（`/reasoning-parse|/parse-reasoning`），支持 strict/return/regex 语义与宿主回调覆写。
- [x] 补齐 Quick Reply 第一批命令（`/qr`、`/qr-list`、`/qr-get`、`/qr-create`、`/qr-delete`），统一宿主透传单路径与 fail-fast 校验。
- [x] 运行定向回归 + gap 分析并更新报告、分析文档与 handoff。

## 26. P3 增量收敛（Quick Reply 第二/三批 + set/preset）

- [x] 补齐 Quick Reply 第二/三批命令（`/qr-set`、`/qr-set-on`、`/qr-set-off`、`/qr-chat-set`、`/qr-chat-set-on`、`/qr-chat-set-off`、`/qr-set-list`、`/qr-update`、`/qr-contextadd`、`/qr-contextdel`、`/qr-contextclear`），统一宿主透传与参数 fail-fast。
- [x] 补齐 Quick Reply set/preset 运维命令（`/qr-set-create|/qr-presetadd`、`/qr-set-update|/qr-presetupdate`、`/qr-set-delete|/qr-presetdelete`），并扩展 Slash 执行上下文 / Script Bridge 透传位。
- [x] 运行定向回归 + gap 分析并更新报告、分析文档与 handoff。

## 27. P3 增量收敛（会话配置 + 推理模板）

- [x] 补齐会话配置命令（`/renamechat`、`/forcesave`、`/hide`、`/unhide`），并在 Session 宿主路径接通重命名、隐藏与强制保存能力。
- [x] 补齐角色/推理配置命令（`/rename-char`、`/reasoning-template|/reasoning-preset|/reasoning-formatting`），统一单路径与 fail-fast 语义。
- [x] 运行 typecheck + 定向回归 + gap 分析，并更新报告、tasks 与 handoff。


## 28. P3 增量收敛（Secret Store + Swipe Alias）

- [x] 补齐 Secret 命令簇（`/secret-id|/secret-rotate`、`/secret-delete`、`/secret-write`、`/secret-rename`、`/secret-read|/secret-find|/secret-get`），统一单路径 localStorage secret store 与 fail-fast 语义。
- [x] 将 Secret 激活项同步回 provider API key（`openaiApiKey` / `geminiApiKey` / `apiKey`）与当前激活模型配置，并补齐 `/swipeadd` 到现有 `/addswipe` 单路径实现。
- [x] 运行 typecheck + 定向回归 + gap 分析，并更新报告、分析文档与 handoff。

## 29. P3 增量收敛（Sysprompt + System Narrator）

- [x] 补齐 sysprompt 命令簇（`/sysprompt|/system-prompt`、`/sysprompt-on|/sysprompt-enable`、`/sysprompt-off|/sysprompt-disable`、`/sysprompt-state|/sysprompt-toggle`），统一到 shared localStorage 单路径与 fail-fast 校验。
- [x] 补齐 `sysname/sysgen`，并让 `/sys` 复用系统旁白显示名与消息插入选项（`at/name/compact`）单路径。
- [x] 运行 typecheck + 定向回归 + gap 分析，并更新报告、分析文档与 handoff。

## 30. P3 增量收敛（Tool Registry + Character Tags）

- [x] 补齐工具命令簇（`/tools-list|/tool-list`、`/tools-invoke|/tool-invoke`），统一复用 Script Tool Registry 单路径与 JSON 参数校验。
- [x] 补齐角色标签命令簇（`/tag-add`、`/tag-remove`、`/tag-exists`、`/tag-list`），统一复用角色元数据存储单路径。
- [x] 运行 typecheck + 定向回归 + gap 分析，并更新报告、分析文档与 handoff。


## 31. P3 增量收敛（画廊/工具注册/QR 参数）

- [x] 补齐媒体/画廊命令（`/show-gallery|/sg`、`/expression-upload|/uploadsprite`），统一显式宿主回调与 fail-fast 语义。
- [x] 补齐工具注册运维（`/tools-register|/tool-register`、`/tools-unregister|/tool-unregister`），并复用 Script Tool Registry 单路径执行 action script。
- [x] 补齐 `qr-arg`，打通 `{{arg::...}}` 宏替换与 `*` wildcard 回退。
- [x] 运行 `pnpm typecheck`、定向回归、`pnpm analyze:sillytavern-gap`，并更新报告、分析文档与 handoff。

## 32. P3 增量收敛（utility + vector 状态）

- [x] 补齐低耦合 utility 命令簇（`/random`、`/sort`、`/tokens`、`/trimstart`、`/trimend`），统一单路径与 fail-fast 语义。
- [x] 补齐 vector 状态命令簇（`/vector-chats-state`、`/vector-files-state`、`/vector-max-entries`、`/vector-query`、`/vector-threshold`），复用宿主 runtime settings 单一路径。
- [x] 运行 `pnpm typecheck`、定向回归、baseline 回归与 `pnpm analyze:sillytavern-gap`，并更新报告、分析文档与 handoff。

## 33. P3 增量收敛（媒体别名 + 低耦合长尾）

- [x] 补齐媒体/语义别名命令（`/sd|/sd-source|/sd-style`、`/speak|/tts`、`/qrset`），统一复用既有 `imagine` / `narrate` / `qr-set` 单路径实现。
- [x] 补齐低耦合长尾命令（`/summarize`、`/start-reply-with`、`/reroll-pick`、`/test`），其中 `/summarize` 复用 `generateRaw`，其余命令复用 localStorage/regex 单路径并保持 fail-fast。
- [x] 运行 `pnpm typecheck`、定向回归、baseline 回归与 `pnpm analyze:sillytavern-gap`，并更新报告、分析文档与 handoff。

## 34. P3 增量收敛（临时会话/翻译/Timed Effect）

- [x] 补齐 `tempchat` 与 `translate`，统一宿主回调单路径，Slash 层只负责参数校验与结果串接。
- [x] 补齐 `wi-get-timed-effect` 与 `wi-set-timed-effect`，保持 active chat fail-fast 与 `boolean|number` 输出语义。
- [x] 运行 `pnpm typecheck`、定向回归、baseline 回归与 `pnpm analyze:sillytavern-gap`，并更新报告、分析文档与 handoff。

## 35. P3 收口（proxy / yt-script / floor-teleport）

- [x] 补齐最后 3 个 slash 命令缺口（`/proxy`、`/yt-script`、`/floor-teleport`），统一到宿主显式回调 / 既有别名单路径，保持 fail-fast 语义。
- [x] 扩展 Slash 执行上下文 / Script Bridge 注入位：新增 `selectProxyPreset`、`getYouTubeTranscript`，并修补 `useScriptBridge` 对 `tempchat/translate/wi-get-timed-effect/wi-set-timed-effect` 的透传缺口。
- [x] 运行 `pnpm typecheck`、定向回归、baseline 回归与 `pnpm analyze:sillytavern-gap`，并更新报告、分析文档与 handoff。
