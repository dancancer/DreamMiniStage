# SillyTavern 差距收敛计划（2026-03-05）

> 来源：`docs/analysis/sillytavern-integration-gap-2026-03.md`

## 1. 目标

- 将当前“桥接完整、能力面不足”的状态推进到“主流程可迁移”。
- 重点收敛 Slash 命令与 TavernHelper 的高价值缺口。
- 维持素材回放和 fail-fast 语义，不引入兼容分支。

## 2. 里程碑

### M1：P1 缺口清零（优先）

- Slash：补齐 `/message`。
- TavernHelper：补齐 `injectPrompts` / `uninjectPrompts`。
- 验收：新增契约测试 + 相关素材回放不回退。

### M2：P2 主流程能力补齐

- Slash（第一批）：`/world`、`/getcharlore`、`/getchatlore`、`/getgloballore`、`/getpersonalore`、`/getlorefield`、`/setlorefield`。
- Slash（第二批）：`/regex-preset`、`/regex-toggle`、`/chat-jump`、`/chat-render`、`/chat-scrollto`。
- Slash（第三批）：`/getcharbook`、`/getchatbook`、`/getglobalbooks`、`/getpersonabook`、`/message-role`、`/message-name`、`/getpromptentry*`、`/setpromptentry*`。
- TavernHelper：`createCharacter/createOrReplaceCharacter/deleteCharacter/replaceCharacter/updateCharacterWith/getCurrentCharacterName/refreshOneMessage`。
- 验收：gap report 中对应条目下降，基线测试全绿。

### M3：P3 长尾机会性收敛

- 对真实素材触发失败项按需补齐，不以覆盖率数字盲冲。
- 每次只推进一个命令簇，避免回归面失控。

## 3. 执行约束

- 单路径实现，不引入历史兼容分支。
- 明确错误，不做静默 fallback。
- 每次改动必须绑定测试或素材回放。
- 不修改 `sillytavern-plugins/*` 外部仓逻辑，仅消费其能力作为对齐基线。

## 4. 验证门禁

- `pnpm analyze:sillytavern-gap`
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/material-replay-control-flow.test.ts`
- `pnpm vitest run hooks/script-bridge/__tests__/variable-handlers.test.ts`

## 5. 完成定义（DoD）

- P1 项全部落地并有测试守卫。
- P2 第一批命令可用且无回归。
- 最新 gap report 与计划文档保持同步。
