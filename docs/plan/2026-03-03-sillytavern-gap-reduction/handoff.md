# Handoff（2026-03-03 / P2 六轮）

## 本轮完成（P2 - branch / ui 最小子集）

- 已在 `lib/slash-command/registry/index.ts` 补齐并注册：
  - `branch-create`
  - `panels`（别名：`togglepanels`）
  - `bg`（别名：`background`）
  - `theme`
  - `movingui`
  - `css-var`
  - `vn`
  - `resetpanels`（别名：`resetui`）
  - `?`（别名：`help`）
- `branch-create` 命令语义（最小可运行）：
  - 支持 `mesId/mes` 与位置参数读取目标消息索引；缺省时默认最后一条消息。
  - 创建分支名（`branch-N`）并自动进入分支会话（复用 checkpoint 会话状态）。
  - 非法 `mesId` 显式 fail-fast（例如 `invalid message index`）。
- `ui` 命令语义（最小子集）：
  - `panels/resetpanels/vn`：仅触发宿主回调，返回空字符串。
  - `bg/theme`：支持无参读取和有参设置，回调返回当前值/设置值。
  - `movingui`：要求 preset name；缺参显式 fail-fast。
  - `css-var`：要求 `varname=--*` 和 value，参数错误显式 fail-fast。
  - 所有 UI 命令在宿主未注入回调时统一 fail-fast，避免静默 no-op。

## Script Bridge 同步收敛

- `hooks/script-bridge/types.ts`：新增 UI 注入位：
  - `onTogglePanels`
  - `onResetPanels`
  - `onToggleVisualNovelMode`
  - `onSetBackground`
  - `onSetTheme`
  - `onSetMovingUiPreset`
  - `onSetCssVariable`
- `hooks/script-bridge/slash-handlers.ts`：将上述 UI 注入位透传到 Slash `ExecutionContext`（单路径映射）。
- `hooks/script-bridge/capability-matrix.ts`：补齐本轮新增 slash 命令声明。
- `hooks/script-bridge/README.md`：补充 UI 注入位约束说明。

## 新增/更新测试

- 新增：`lib/slash-command/__tests__/p2-branch-ui-command-gaps.test.ts`
  - 覆盖 `branch-create` 主路径 + 缺省索引路径 + 参数错误路径。
  - 覆盖 `panels/bg/theme/movingui/css-var/vn/resetpanels/?` 主路径与 fail-fast 路径。
- 回归补跑：`lib/slash-command/__tests__/p2-checkpoint-command-gaps.test.ts`（确保 branch-create 与 checkpoint 状态链路不回归）。

## 本轮回归结果

```bash
pnpm vitest run \
  lib/slash-command/__tests__/p2-branch-ui-command-gaps.test.ts \
  lib/slash-command/__tests__/p2-checkpoint-command-gaps.test.ts \
  lib/core/__tests__/st-baseline-slash-command.test.ts \
  hooks/script-bridge/__tests__/api-surface-contract.test.ts
```

- 结果：`4` files passed，`69` tests passed。

## 指标快照（本轮更新）

- Slash 覆盖率：`30.23%`
  - 上游：`258`
  - 当前命令总量：`150`
  - 交集：`78`
- TavernHelper API 覆盖率：`60.77%`（本轮未改 API 面）
  - 上游：`130`
  - 当前 shim 顶层：`117`
  - 交集：`79`

## Gate 状态

- P4（Playwright MCP E2E）触发条件已满足：
  - ✅ TavernHelper API 覆盖率 `>= 55%`（当前 `60.77%`）
  - ✅ Slash 覆盖率 `>= 30%`（当前 `30.23%`）
  - ✅ 宏条件流 skip 收敛完成
  - ✅ P0/P1 核心回归全绿

## 下一步建议（P4 启动）

1. **先落四条 E2E 主场景映射**
   - 脚本注册与调用
   - Slash 控制流
   - MVU 变量更新链路
   - 音频/事件命令链路
2. **每条场景固定采集失败资产**
   - Playwright 截图
   - 控制台日志
   - 最小复现脚本
3. **按 E2E 失败单驱动回填缺口**
   - 仅修真实阻塞路径，继续保持“单路径 + fail-fast + 快速回归”。

---

## 历史记录（上一轮摘要）

- P2 五轮已完成 `run / trimtokens / reload-page`。
- P2 四轮已完成 `chat-manager / chat-history / manage-chats / chat-reload`。
- P2 三轮已完成 `fuzzy` 最小子集（`list + threshold + mode(first|best)`）。
- P2 二轮已完成 API 命令族：`api / api-url / server`（写路径宿主模式 fail-fast）。
- P2 首轮已完成 checkpoint 家族：`checkpoint-create/get/list/go/exit/parent`，并补齐 `go -> character` 别名。
