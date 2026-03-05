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
