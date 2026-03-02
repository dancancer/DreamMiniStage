# SillyTavern 基线对比问题报告

## 背景
- 目标：验证项目在相同输入（角色卡、预设、世界书、用户输入）下，拼装出的 LLM 请求消息是否与 SillyTavern + 插件一致。
- 基线实现：`lib/core/__tests__/st-baseline-assembly.test.ts` 读取 `test-baseline-assets` 中的素材，构建 SillyTavern 期望输出与当前项目输出并对比快照（参考 `lib/core/__tests__/st-baseline-assembly.test.ts:225`）。
- 运行：`pnpm vitest run lib/core/__tests__/st-baseline-assembly.test.ts --update`，快照存于 `lib/core/__tests__/__snapshots__/st-baseline-assembly.test.ts.snap`。

## 输入
- 角色卡：`test-baseline-assets/character-card/Sgw3.card.json`
- 世界书：`test-baseline-assets/worldbook/服装随机化.json`
- 预设：`明月秋青v3.94.json`、`夏瑾 Pro - Beta 0.70.json`
- 用户输入：`推进剧情`

## 主要发现
1) 世界书未注入或位置错误  
   - 基线（SillyTavern）包含 `worldInfoBefore/After` 大段内容；当前输出在对应位置为空或被其他 prompt 占位。  
   - 见快照差异：`worldInfoAfter` 在基线有内容，当前为 `""`（`明月秋青` Case, index 10）；`worldInfoBefore` 被替换为其他用户 prompt（`夏瑾` Case, index 4）。  
   - 根因：`loadWorldBookContent` 仅 `Number(entry.position || 0)`，无法解析字符串位置（如 `after_char`）或 `extensions.position`，导致位置解析失败后落入 `0` 分支或直接丢弃。参考现实现 `lib/core/core/world-book-loader.ts:36-82`（当前 Number 语义），与基线解析 `normalizePosition` 兼容字符串/扩展字段（`lib/core/__tests__/st-baseline-assembly.test.ts:62-99`）。

2) 消息顺序偏移  
   - 因世界书注入失败，后续 prompt 队列前移，导致多个用户/system prompt 与基线错位，形成大量 mismatch（快照 index 9 之后）。  
   - 修复世界书位置后顺序应自动回正。

## 风险
- 任何依赖世界书注入的位置、深度注入（position 0/1/2）的逻辑在真实运行中会缺失关键信息，影响故事/规则遵循。
- 预设兼容性：真实用户导入含字符串 position 的世界书时会被忽略。

## 修复建议
1) 世界书位置解析对齐 SillyTavern  
   - 在世界书匹配/导入处统一解析 `position`：支持数字、`before_char`/`after_char` 字符串、`extensions.position`。  
   - 回写 `loadWorldBookContent` 使用统一的 position 解析函数，避免 `Number(undefined)` → 0 的误判。

2) 回归验证  
   - 修复后重跑 `pnpm vitest run lib/core/__tests__/st-baseline-assembly.test.ts --update`，确保快照 diff 收敛（特别是 `worldInfoBefore/After`).

3) 可选加强  
   - 在世界书导入适配器中提前标准化 position 字段，减少运行时分支。  
   - 为 `loadWorldBookContent` 添加单元测试，覆盖字符串/扩展位置解析。

## 当前状态
- 基线测试已落地并有快照；仍存在明显不一致，需尽快修复世界书位置解析后更新快照。 ***
