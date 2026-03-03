# Handoff（2026-03-03 / P3 首轮）

## 本轮完成（P3 - import_raw / script buttons / version）

- 已新增 `hooks/script-bridge/compat-handlers.ts`，补齐 JS-Slash-Runner 高频迁移 API：
  - `importRawPreset`
  - `importRawWorldbook`
  - `importRawTavernRegex`
  - `importRawChat`
  - `importRawCharacter`（宿主不支持二进制上传，显式 fail-fast）
  - `getAllEnabledScriptButtons`
  - `getTavernHelperVersion` / `getFrontendVersion` / `getTavernVersion`
  - `updateTavernHelper` / `updateFrontendVersion`（宿主模式显式 fail-fast）
- 已完成能力面单源同步：
  - `public/iframe-libs/slash-runner-shim.js` 增加上述 API 暴露。
  - `hooks/script-bridge/capability-matrix.ts` 同步新增能力声明。
  - `hooks/script-bridge/index.ts` 注入 `compatHandlers`，统一纳入 `handleApiCall` 调度。
- API 合同校验已保持一致：
  - `hooks/script-bridge/__tests__/api-surface-contract.test.ts` 已纳入 `compatHandlers` 注册面。
  - `hooks/script-bridge/README.md` 文件清单和约束说明已更新。

## 新增/更新测试

- 新增：`hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts`
  - 覆盖 `import_raw` 参数语义、fail-fast 路径、按钮聚合、version API。
- 回归复跑：
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

- 结果：`5` files passed，`20` tests passed。

## 指标快照（本轮更新）

- Slash 覆盖率：`21.71%`（本轮未改 Slash 命令族）
- TavernHelper API 覆盖率：`53.85%`
  - 上游：`130`
  - 当前 shim 顶层：`108`
  - 交集：`70`

## 下一步建议（继续 P3 + 进入 P2）

1. **先完成 P3 收口（冲线 55%）**  
   优先补 extension 管理最小集（`isInstalledExtension/getExtensionType/getExtensionStatus`），宿主不支持路径保持 fail-fast，可将 API 覆盖率从 `53.85%` 推到 `>=55%`。
2. **并行推进 P2 一族命令（建议 checkpoint）**  
   从 `checkpoint-create/get/list/go/exit/parent` 这一族入手，按“参数签名 + 失败路径 + 回归”一次性补齐，减少迁移脚本硬阻塞。
3. **每轮固定动作保持不变**  
   每次补齐后都更新 `docs/analysis/sillytavern-integration-gap-2026-03.md` 与本 handoff，持续记录覆盖率快照与 gate 状态。

