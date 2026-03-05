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
