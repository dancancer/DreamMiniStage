# Handoff（2026-03-03）

## 本轮完成（P1）

- 已在 `lib/mvu/core/executor.ts` 落地 `strictSet` 执行语义：
  - `strictSet=false`：`ValueWithDescription` 仅更新值位，保留描述。
  - `strictSet=true`：按普通 set 语义替换整个值。
- 已将 `strictTemplate` / `concatTemplateArray` 作为执行期开关接入 `insert` 模板应用链路，并修正 primitive + array template 在 merge 模式下的行为。
- 已在 Slash 内核落地条件宏预处理与比较表达式求值：
  - `/if`、`/while` 支持 `{{getvar::}}` / `{{getglobalvar::}}`。
  - 未知宏显式 fail-fast（返回 abort/error），避免静默偏差。
- 已解除 `st-baseline-slash-command` 中宏条件流相关 skip（5 项清零）。

## 新增/更新测试

- 新增：`lib/mvu/__tests__/executor-option-semantics.test.ts`
- 更新：`lib/core/__tests__/st-baseline-slash-command.test.ts`（取消 skip，补 unknown macro fail-fast）

## 本轮回归

```bash
pnpm vitest run \
  lib/mvu/__tests__/executor-option-semantics.test.ts \
  lib/core/__tests__/st-baseline-mvu.test.ts \
  lib/core/__tests__/st-baseline-slash-command.test.ts \
  lib/slash-command/__tests__/kernel-core.test.ts
```

- 结果：`4` files passed，`131` tests passed，`0` skipped。

## 下一步建议（进入 P2/P3）

1. 先做 P2 命令族补齐的频次基线：从 `test-baseline-assets` + 现有脚本样本统计 Top N 缺失命令，优先 `checkpoint / chat-manager / api / branch / ui`。
2. 每轮仅补一个命令族并附失败路径测试，补完即更新 Slash 覆盖率快照，目标先推到 `>= 30%`。
3. 并行推进 P3 的高频 API 缺口（`import_raw / script buttons / version`），将 TavernHelper API 覆盖率推到 `>= 55%`。
4. 门槛达成后再进入 Playwright MCP E2E，减少“已知缺口噪声”导致的无效失败。
