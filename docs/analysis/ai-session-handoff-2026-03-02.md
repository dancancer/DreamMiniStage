# AI 会话交接文档（2026-03-02）

> 目的：给下一次 AI 会话提供可直接执行的上下文，避免重复审计与重复改造。
> 当前日期：2026-03-02

## 1. 项目目标（本轮不变）

对齐并整合以下三部分能力：

1. `sillytavern-plugins/SillyTavern` 核心流程
2. `sillytavern-plugins/JS-Slash-Runner`
3. `sillytavern-plugins/MagVarUpdate`

并在开发期持续执行“去兼容化”：移除历史数据/旧入口兼容分支，收敛到单路径实现。

---

## 2. 已完成（可视为当前基线）

### 2.1 Workflow 主链路收敛（messages 单轨）

- `HistoryPreNode` 已移除 `chatHistoryText` 输出，仅保留 `chatHistoryMessages + conversationContext`。
- `ContextNode` 已改为纯透传，不再做 `{{chatHistory}}` 字符串替换。
- `LLMNode` 仅消费 `messages[]`，移除字符串 fallback 组装。
- `MemoryRetrievalNode` + `MemoryNodeTools` 已改为直接操作 `messages[]`。
- `PresetNode` / `PresetNodeTools` 不再输出 `systemMessage/userMessage`，只保留 `messages + presetId`。

### 2.2 Script Bridge 去兼容

- `triggerSlash(command, options)` 中 options 覆盖分支已移除。
- 回调统一由 `ApiCallContext` 注入（`onSend/onTrigger/...`）。

### 2.3 iframe shim 去兼容（本轮重点）

- 已移除顶层全局别名注入：
  - 不再导出 `window.getVariables` / `window.triggerSlash` / `window.getChatMessages` 等。
  - 统一通过 `window.TavernHelper` / `window.SillyTavern` 命名空间访问。
- 未实现的群聊 API 已从“静默默认值”改为 **fail-fast**：
  - `getGroupMembers` -> Promise reject
  - `isGroupChat` -> throw Error
- 新增 API 面一致性测试：确保 shim 中声明的 `api("...")/callApi("...")` 都有 script-bridge handler 对应，防止漂移。

### 2.4 文档整理

- 历史阶段文档已归档到 `docs/archive/2026-03-integration-refresh/`。
- 主入口文档已更新，当前结论集中在：
  - `docs/README.md`
  - `docs/analysis/sillytavern-integration-gap-2026-03.md`

### 2.5 Slash 命令覆盖补齐（P2 第一批）

- 已新增高频算子/字符串命令：
  - 数学：`/mul`、`/div`、`/mod`、`/rand`
  - 字符串：`/split`、`/join`、`/replace`（含别名 `/re`）
- 行为约定（当前实现）：
  - `div/mod` 在除数为 0 时显式报错（fail-fast）。
  - `rand` 支持位置参数与 `from/to/round` 命名参数。
  - `replace` 支持 `mode=literal|regex`，`regex` 兼容 `/pattern/flags` 风格。
- 相关实现：
  - `lib/slash-command/registry/handlers/operators.ts`
  - `lib/slash-command/registry/index.ts`
- 相关测试：
  - `lib/slash-command/__tests__/p2-operators.test.ts`

### 2.6 Slash 命令覆盖补齐（P2 第二批）

- 已新增高频数学命令：
  - `/pow`、`/max`、`/min`
- 行为约定（当前实现）：
  - `pow` 使用顺序幂运算（可消费 pipe 作为首项）。
  - `max/min` 与现有算子一致，支持位置参数与 pipe 输入。
- 相关实现：
  - `lib/slash-command/registry/handlers/operators.ts`
  - `lib/slash-command/registry/index.ts`
- 相关测试：
  - `lib/slash-command/__tests__/p2-operators.test.ts`

### 2.7 变量 API 参数语义对齐（MagVarUpdate 高频路径）

- `mvu.getVariable/mvu.getVariables` 已补齐上游常见参数形态：
  - `{ type: "chat" | "message" | "global" | "character" | "script", message_id }`
  - 兼容 `messageId` 与 legacy 位置参数（字符串/数字消息引用）
- `message_id` 语义与变量主链路保持一致：
  - 支持 `latest`、负索引、数字字符串
  - 越界时显式报错（fail-fast）
- MVU 会话键选择已收敛为 `chatId > dialogueId > characterId > global`，减少跨会话串写风险。
- 相关实现：
  - `hooks/script-bridge/mvu-handlers.ts`
- 相关测试：
  - `hooks/script-bridge/__tests__/mvu-handlers-option-semantics.test.ts`

---

## 3. 本轮新增/关键文件

### 3.1 代码

- `public/iframe-libs/slash-runner-shim.js`
  - 删除顶层 alias
  - 群聊 API 改为 fail-fast

### 3.2 测试

- `lib/script-runner/__tests__/slash-runner-shim-contract.test.ts`
  - 校验只暴露命名空间入口
  - 校验不再存在 `createStub/createAsyncStub/warnUnimplemented`
- `hooks/script-bridge/__tests__/api-surface-contract.test.ts`
  - 校验 shim API 面与 handler 注册面一致
- `hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`
  - JS-Slash-Runner/MagVarUpdate 最小链路回归
- `hooks/script-bridge/__tests__/extension-lifecycle.test.ts`
  - 覆盖 `registerFunctionTool/registerSlashCommand` 的注册、调用、清理、再注册链路

### 3.3 文档

- `hooks/script-bridge/README.md`
- `docs/analysis/sillytavern-integration-gap-2026-03.md`

---

## 4. 已执行验证（命令与结果）

> 注意：测试统一使用 `pnpm vitest run ...`，不要使用 watch 模式。

已通过：

- `pnpm vitest run lib/script-runner/__tests__/slash-runner-shim-contract.test.ts hooks/script-bridge/__tests__/slash-handlers.integration.test.ts`
- `pnpm vitest run lib/script-runner/__tests__/slash-runner-shim-contract.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts hooks/script-bridge/__tests__/slash-handlers.integration.test.ts`
- `pnpm vitest run hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-operators.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-operators.test.ts lib/slash-command/__tests__/js-slash-runner-audio.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-operators.test.ts`
- `pnpm vitest run hooks/script-bridge/__tests__/extension-lifecycle.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`
- `pnpm vitest run hooks/script-bridge/__tests__/mvu-handlers-option-semantics.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts`

结果：全部通过。

---

## 5. 当前差距（下一会话应继续）

### 5.1 高优先（建议先做）

1. **变量 API 参数语义对齐**（MagVarUpdate 高频路径）✅ 已完成
   - `mvu.getVariable/mvu.getVariables` 已支持 `{ type, message_id }` 与 `messageId`。
   - `message_id` 已支持 `latest`、负索引、数字字符串，越界 fail-fast。
   - 新增回归：`hooks/script-bridge/__tests__/mvu-handlers-option-semantics.test.ts`。

2. **音频命令语义对齐**（JS-Slash-Runner）✅ 已完成（本会话）
   - `audio*` 已按上游常用参数语义对齐：
     - `/audioplay type=... play=...`：播放/暂停切换
     - `/audiomode`：`repeat|random|single|stop`
     - `/audioimport`：逗号分隔 URL，支持 `play=false`
     - `/audioselect`：不存在则先入列表再播放
   - 相关实现：
     - `lib/slash-command/registry/handlers/js-slash-runner.ts`
     - `hooks/script-bridge/slash-handlers.ts`（补齐按通道音频上下文）
     - `lib/slash-command/types.ts`（扩展通道级音频执行接口）
   - 回归测试：
     - `lib/slash-command/__tests__/js-slash-runner-audio.test.ts`

3. **Slash 命令覆盖继续补齐**（P2 第二批已完成）
- 已补：`mul/div/mod/rand/split/join/replace(re)/pow/max/min`。
- 下一批建议优先：消息/角色侧真实脚本高频缺口（按插件脚本采样决定）。
- 仍需按真实插件脚本使用频率推进，不追求盲目全量。

### 5.2 中优先

4. `registerFunctionTool/registerSlashCommand` 生命周期测试继续加深：✅ 已补齐最小回归
   - 已覆盖：注册 -> 调用 -> iframe 清理 -> 再注册。
   - 相关测试：`hooks/script-bridge/__tests__/extension-lifecycle.test.ts`

5. 能力清单单源化：
   - 将 shim 暴露面、script-bridge handlers、slash registry 能力形成单一“能力矩阵”文件（生成或校验）。

---

## 6. 执行注意事项（给下一会话）

1. 仓库当前是 **dirty worktree**，大量文件非本任务改动；禁止回滚无关变更。
2. 继续遵循“开发期去兼容化”策略：
   - 优先单路径
   - 失败显式暴露
   - 不做静默 fallback
3. 若新增兼容逻辑，必须先说明“为何不是坏味道”，否则默认应删。
4. 运行测试请使用精确文件级命令，避免全量长跑影响迭代速度。

---

## 7. 下一会话建议起手动作（可直接复制）

```bash
pnpm vitest run \
  lib/slash-command/__tests__/p2-operators.test.ts \
  lib/slash-command/__tests__/js-slash-runner-audio.test.ts \
  hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts \
  hooks/script-bridge/__tests__/api-surface-contract.test.ts \
  hooks/script-bridge/__tests__/variable-handlers.test.ts \
  lib/script-runner/__tests__/slash-runner-shim-contract.test.ts
```

然后从 `lib/slash-command/registry/index.ts` 与真实插件脚本调用频率入手，优先补齐高频命令族。
