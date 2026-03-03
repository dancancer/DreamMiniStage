# Handoff（2026-03-03 / P3 二轮）

## 本轮完成（P3 - extension 管理最小集）

- 已在 `hooks/script-bridge/compat-handlers.ts` 补齐 extension 管理兼容 API：
  - `isAdmin`
  - `getTavernHelperExtensionId`
  - `getExtensionType`
  - `getExtensionStatus`
  - `isInstalledExtension`
  - `installExtension` / `uninstallExtension` / `reinstallExtension` / `updateExtension`（宿主模式显式 fail-fast）
- 已完成能力面单源同步：
  - `public/iframe-libs/slash-runner-shim.js` 新增 extension API 暴露。
  - `hooks/script-bridge/capability-matrix.ts` 同步新增 extension API 声明。
  - `hooks/script-bridge/README.md` 同步更新兼容面说明。
- `api-surface-contract` 持续全绿，shim/handler/matrix 无漂移。

## 新增/更新测试

- 更新：`hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts`
  - 新增 extension 读接口行为断言（installed/type/status/id/admin）
  - 新增 extension 写接口 fail-fast 断言（install/uninstall/reinstall/update）
- 回归复跑：
  - `hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts`
  - `hooks/script-bridge/__tests__/api-surface-contract.test.ts`
  - `hooks/script-bridge/__tests__/extension-lifecycle.test.ts`
  - `hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`
  - `lib/script-runner/__tests__/slash-runner-shim-contract.test.ts`

## 本轮回归结果

```bash
pnpm vitest run \
  hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts \
  hooks/script-bridge/__tests__/api-surface-contract.test.ts \
  hooks/script-bridge/__tests__/extension-lifecycle.test.ts \
  hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts \
  lib/script-runner/__tests__/slash-runner-shim-contract.test.ts
```

- 结果：`5` files passed，`21` tests passed。

## 指标快照（本轮更新）

- Slash 覆盖率：`21.71%`（本轮未改 Slash 命令族）
- TavernHelper API 覆盖率：`60.77%`
  - 上游：`130`
  - 当前 shim 顶层：`117`
  - 交集：`79`

## 下一步建议（切到 P2）

1. **优先推进 P2 高频 Slash 命令族（建议 checkpoint）**  
   先补 `checkpoint-create/get/list/go/exit/parent`，按“参数签名 + 失败路径 + 回归”一轮收敛，直接拉动 `21.71% -> 30%` gate。
2. **做一轮命令频次采样并固定 Top N backlog**  
   用 `test-baseline-assets` + 现有脚本样本产出可追踪频次表，避免命令补齐顺序拍脑袋。
3. **保持每轮固定动作**  
   每次命令族补齐后同步更新 `docs/analysis/sillytavern-integration-gap-2026-03.md` 与本 handoff，记录覆盖率和 gate 状态。
