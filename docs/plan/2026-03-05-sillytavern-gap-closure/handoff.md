# Handoff（2026-03-05）

## 本轮完成

- 已完成上一轮建议第 1 项：会话运维长尾命令簇收敛。
  - 新增命令：`/closechat`、`/count`、`/member-count`、`/countmember`、`/membercount`、`/cut`，并补齐输入别名 `/input`。
  - 语义对齐：
    - `/closechat` 统一收敛到 `closeCurrentChat` 单路径回调（宿主未注入时，浏览器环境回退到 `#option_close_chat` 点击路径）。
    - `/count` 统一统计当前会话的非 system 消息 token 数，优先宿主 `countTokens`，缺失时按本地估算降级。
    - `/member-count|/countmember|/membercount` 统一收敛到 `getGroupMemberCount` 单路径回调。
    - `/cut` 支持闭区间 range 与多段 selector，统一按降序删除，返回被剪切消息文本。
  - 失败策略：宿主回调缺失、索引越界、range 非法、token/member 计数返回值异常均显式 fail-fast。
- 补齐 Slash 上下文透传与能力声明闭环。
  - `ExecutionContext` 新增 `closeCurrentChat`、`getGroupMemberCount` 回调定义。
  - `ApiCallContext` / `adaptSlashExecutionContext` 新增对应透传能力。
  - 更新 `hooks/script-bridge/capability-matrix.ts` 与 `hooks/script-bridge/README.md`。
- 新增契约测试：
  - `lib/slash-command/__tests__/p3-session-maintenance-command-gaps.test.ts`（11 tests），覆盖 `/closechat`、`/count`、`/member-count*`、`/cut`、`/input` 全路径与 fail-fast 场景。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `62.44%`（上一轮 `60.80%`，+`1.64`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
  - Top25 已移除 `closechat`、`count`、`countmember`、`cut`、`input`。
- `pnpm vitest run lib/slash-command/__tests__/p3-session-maintenance-command-gaps.test.ts`：`1 file / 11 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/p2-chat-command-gaps.test.ts lib/slash-command/__tests__/p2-utility-command-gaps.test.ts`：`2 files / 43 tests` 全通过。
- `pnpm vitest run hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`1 file / 3 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p3-session-maintenance-command-gaps.test.ts`：`3 files / 19 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts`：`10 files / 284 tests` 全通过。

## 下一步建议

1. 推进图像命令首批：`/image|/img`、`/imagine`、`/imagine-source`、`/imagine-style`、`/imagine-comfy-workflow`（先打通最小可执行 + 返回值可断言闭环）。
2. 推进 instruct 命令簇：`/instruct`、`/instruct-on`、`/instruct-off`、`/instruct-state`、`/instruct-toggle`，优先复用已有 preset/context 通路。
3. 为 `member-*/addswipe`、`data-bank-search`、`vector-worldinfo-state` 增加 UI/结果可见断言，继续收紧端到端回归面。
