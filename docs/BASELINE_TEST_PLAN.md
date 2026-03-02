# SillyTavern 基线测试体系设计与实施计划

## 📋 总体目标

建立一套系统化的基线测试体系，确保 DreamMiniStage 项目与 SillyTavern（及其插件 JS-Slash-Runner、MagVarUpdate）的功能保持一致，为后续的功能迭代和兼容性维护提供坚实保障。

---

## 🏗️ 三层金字塔架构

```
                    ╔═══════════════════════╗
                    ║   Layer 3: E2E        ║  真实场景模拟
                    ║   端到端基线测试       ║  (完整会话流程)
                    ╚═══════════════════════╝
                ╔═══════════════════════════════╗
                ║     Layer 2: Integration      ║  多模块协作
                ║     集成基线测试              ║  (跨模块一致性)
                ╚═══════════════════════════════╝
    ╔═══════════════════════════════════════════════════╗
    ║           Layer 1: Unit                            ║  单模块对齐
    ║           单元基线测试                              ║  (与 ST 行为对齐)
    ╚═══════════════════════════════════════════════════╝
```

---

## ✅ 已完成的测试

### 1. 宏替换系统基线测试 ✅

**文件**: `lib/core/__tests__/st-baseline-macro.test.ts`
**测试用例数**: 47
**覆盖范围**:
- ✅ 环境宏（{{user}}, {{char}}, {{description}}, etc.） - 10 个用例
- ⚠️ 局部变量宏（{{setvar}}, {{getvar}}, {{incvar}}, {{decvar}}, {{addvar}}） - 6 个用例
  - ❌ **已知问题**: 变量操作宏（incvar/decvar/addvar）不能在同一次 evaluate 中与 getvar 混用
- ✅ 全局变量宏（{{setglobalvar}}, {{getglobalvar}}, etc.） - 4 个用例
- ✅ 时间宏（{{time}}, {{date}}, {{isodate}}, {{isotime}}） - 4 个用例
- ✅ 工具宏（{{random}}, {{pick}}, {{roll}}） - 5 个用例
- ✅ 边界情况和错误处理 - 6 个用例
- ✅ 宏嵌套和组合 - 4 个用例
- ✅ SillyTavern 行为对齐验证 - 5 个用例
- ✅ 变量持久化 - 3 个用例

**已知实现差异**:
1. **变量操作宏执行时机问题**（lib/core/st-macro-evaluator.ts）
   - SillyTavern 行为：`{{incvar::count}}当前值：{{getvar::count}}` 应输出更新后的值
   - 当前实现：必须分开调用，否则 getvar 在 incvar 更新前执行
   - 原因：宏处理流水线中，变量操作宏和读取宏的执行顺序问题

### 2. 提示装配基线测试 ✅（已有）

**文件**: `lib/core/__tests__/st-baseline-assembly.test.ts`
**覆盖范围**:
- ✅ 世界书匹配和位置处理
- ✅ 提示消息装配
- ✅ 多预设对比（明月秋青、夏瑾 Pro）

### 3. 正则处理系统基线测试 ✅

**文件**: `lib/core/__tests__/st-baseline-regex.test.ts`
**测试用例数**: 19
**覆盖范围**:
- ✅ 基础正则替换（字符串替换、全局匹配、模式匹配、捕获组、大小写不敏感） - 5 个用例
- ✅ Placement 过滤（USER_INPUT, AI_OUTPUT, 多 placement 支持，空数组处理） - 3 个用例
- ✅ 宏替换集成（replaceString 宏、RAW 模式、ESCAPED 模式） - 3 个用例
- ✅ 标志位过滤（markdownOnly, promptOnly, disabled） - 3 个用例
- ✅ 深度约束（minDepth, maxDepth） - 2 个用例
- ✅ 边界情况和错误处理（空文本、无匹配、多脚本执行顺序） - 3 个用例

**关键发现**:
- 创建了自定义测试辅助函数 `processTextWithScripts()`，避免依赖存储层
- 正则编译支持 `/pattern/flags` 格式和回退策略（编译失败时转为字面量匹配）
- 宏替换在 `findRegex` 和 `replaceString` 中的应用符合 SillyTavern 行为
- 捕获组引用 `$1`, `$2` 等替换逻辑正确

### 4. 世界书系统基线测试 ✅（完成）

**文件**: `lib/core/__tests__/st-baseline-worldbook.test.ts`
**测试用例数**: 47（全部通过）
**覆盖范围**:
- ✅ 基础关键词匹配（主关键词、多关键词 OR、历史搜索、上下文窗口）
- ✅ 常量条目与选择性激活（enabled/selective 过滤）
- ✅ 位置注入策略（before_char/after_char/数字/扩展字段）
- ✅ 次关键词匹配逻辑（AND/OR/NOT）
- ✅ 高级匹配选项（全词匹配、大小写敏感）
- ✅ 递归扫描、时间效果（sticky/cooldown/delay）、概率激活、互斥组
- ✅ Token 预算、最小激活数、边界情况（空输入、Record 格式）

**已知实现差异**:
- 当前无已知差异（matchWholeWords、cooldown 等行为已与 SillyTavern 对齐）

---

## 🚧 待实现的测试（Layer 1: 单元基线测试）

### 5. Slash 命令系统基线测试 ✅（部分完成）

**文件**: `lib/core/__tests__/st-baseline-slash-command.test.ts`
**测试用例数**: 52（47 个通过，0 个失败，5 个跳过）
**优先级**: P1
**覆盖范围**:
- ✅ 命令解析（命名参数、位置参数、引号处理）
- ✅ 管道操作（cmd1 | cmd2 | cmd3）
- ✅ 块语法（支持嵌套与块内管道）
- ✅ 变量命令（set/get/del/list/flush/dump/inc/dec，含浮点数）
- ✅ 作用域链（块内读取/覆盖外部变量、嵌套查询）
- ✅ 控制信号（/return, /abort）
- ⏭ 控制信号（/break 配合宏替换）
- ✅ 条件命令（/if 基础）
- ⏭ 条件命令（/if 配合宏替换）
- ✅ 循环命令（/times）
- ⏭ 循环命令（/while 配合宏替换）
- ✅ 消息命令（/send, /trigger）
- ✅ 边界情况和错误处理
- ✅ SillyTavern 行为对齐：命令名大小写、管道传递、变量持久化

**已知实现差异**（5 个跳过）:
- 宏替换未集成到 Slash 系统：涉及条件/循环/控制信号与宏结合的 5 个用例仍跳过，需在执行前做宏预处理以避免死循环

### 6. MVU 变量管理系统基线测试 ✅（已完成）

**文件**: `lib/core/__tests__/st-baseline-mvu.test.ts`
**测试用例数**: 57（全部通过）
**优先级**: P1
**覆盖范围**:
- ✅ 变量初始化（`[InitVar]` 世界书条目解析） - 8 个用例
- ✅ 命令解析（`_.set`, `_.insert`, `_.delete`） - 10 个用例
- ✅ 命令执行（路径解析、值设置） - 9 个用例
- ✅ 值解析（布尔、null、数字、JSON、数学表达式） - 8 个用例
- ✅ 路径处理（简单、数组索引、引号键、中文路径） - 6 个用例
- ✅ Schema 生成和验证 - 4 个用例
- ✅ `display_data` vs `stat_data` 的差异 - 2 个用例
- ✅ 边界情况 - 6 个用例
- ✅ SillyTavern 行为对齐 - 6 个用例（包含 oldValue 严格相等、多命令顺序执行、多行命令解析）

**已修复的实现差异**:

1. ✅ **变量初始化 API** - 已添加简化 API 重载
   - 现支持：`initializeVariables({ worldBooks, worldBookNames })`
   - 位置：lib/mvu/variable-init.ts

2. ✅ **命令解析分号可选** - 分号不再是必需的
   - 现支持：`_.set('name', 'Alice', 'Bob')` 可以不带分号
   - 位置：lib/mvu/core/parser.ts

3. ✅ **命令执行 API** - 已添加 STStyleCommand 对象支持
   - 现支持：`updateSingleVariable(variables, command)` 接受 MvuCommand 对象
   - 位置：lib/mvu/core/executor.ts

4. ✅ **deepClone 处理 undefined** - 已修复
   - 现支持：正确处理 undefined 值
   - 位置：lib/mvu/core/executor.ts

5. ✅ **MvuCommand 类型统一** - 已添加 `name`、`path`、`oldValue`、`newValue` 字段
   - 位置：lib/mvu/types.ts、lib/mvu/core/parser.ts

6. ✅ **updateVariablesFromMessage 参数顺序** - 支持两种调用方式
   - 现支持：`(variables, message)` 和 `(message, variables)` 两种顺序
   - 位置：lib/mvu/core/executor.ts

7. ✅ **数组元素删除** - 使用 splice 而非 delete
   - 位置：lib/mvu/core/executor.ts

---

## 🔗 已完成的测试（Layer 2: 集成基线测试）

### 7. 完整对话流程基线测试 ✅

**文件**: `lib/core/__tests__/st-baseline-dialogue-flow.test.ts`
**测试用例数**: 18 (18 个通过)
**优先级**: P2
**覆盖范围**:
- ✅ 单轮对话完整流程（用户输入 → 宏替换 → 正则处理 → 世界书匹配 → 提示装配） - 4 个用例
- ✅ 多轮对话状态保持（历史累积、世界书历史匹配、完整历史装配） - 3 个用例
- ✅ 处理管线协作（宏 → 正则、世界书 → 宏、完整管线） - 4 个用例
- ✅ 边界情况和错误处理（空数组、禁用脚本、无效正则） - 4 个用例
- ✅ SillyTavern 行为对齐（placement 过滤、常量条目、历史搜索） - 3 个用例

**关键设计**:
- 使用 `executeDialogueFlow()` 函数模拟完整的对话处理流程
- 不依赖真实 LLM，使用确定性的模拟响应
- 验证数据在各模块间的正确流动和转换
- 测试管线中每个步骤的独立性和协作性

### 8. 插件协作基线测试 ✅

**文件**: `lib/core/__tests__/st-baseline-plugin-integration.test.ts`
**测试用例数**: 24 (24 个通过)
**优先级**: P2
**覆盖范围**:
- ✅ Regex + Macro 协作（findRegex 宏、replaceString 宏、复杂替换、多脚本） - 4 个用例
- ✅ WorldBook + Macro 协作（内容宏、关键词宏、常量条目宏） - 3 个用例
- ✅ WorldBook + Regex 协作（内容处理、提示处理、多条目处理） - 3 个用例
- ✅ Macro + Slash Command 协作（参数宏、变量读取、条件宏） - 3 个用例（模拟）
- ✅ MVU + Slash Command 协作（变量读写、更新触发） - 3 个用例（模拟）
- ✅ 完整集成场景（多模块管线、执行顺序） - 2 个用例
- ✅ 模块冲突检测（宏与正则、变量独立性、处理顺序） - 3 个用例
- ✅ SillyTavern 行为对齐（执行顺序、注入时机、RAW 模式） - 3 个用例

**关键设计**:
- 测试每对模块的协作接口和数据传递
- 验证宏替换在正则和世界书中的应用
- 模拟 Slash 和 MVU 系统的变量管理
- 检测模块间的冲突和竞争条件

---

## 🔗 待实现的测试（Layer 3: E2E 端到端测试）

### 9. 真实场景模拟基线测试

**文件**: `lib/core/__tests__/st-baseline-e2e-scenarios.test.ts`
**优先级**: P3
**覆盖范围**:
- [ ] 使用真实角色卡和预设进行完整会话模拟
- [ ] MVU 状态栏的生成和显示
- [ ] 变量更新的跨轮追踪
- [ ] 对话历史的一致性验证
- [ ] 与 SillyTavern + 插件的完整体验对齐

**测试资产需求**:
- 真实的角色卡（Sgw3.card.json ✅，圣女理理 ✅）
- 真实的预设（明月秋青 ✅，夏瑾 Pro ✅）
- 真实的世界书（服装随机化 ✅）

---

## 🛠️ 测试辅助工具

### 已实现

**文件**: `lib/core/__tests__/baseline-helpers.ts`
**功能**:
- ✅ 统一资产加载器（`loadAsset`, `loadCharacterCard`, `loadWorldBook`, `loadPreset`）
- ✅ 内容分析工具（`hashContent`, `preview`, `summarize`）
- ✅ 差异对比工具（`diffMessages`, `diffText`, `diffVariables`）
- ✅ 确定性环境准备（`setupDeterministicEnv`, `teardownDeterministicEnv`）

### 待扩展

- [ ] 正则脚本加载器
- [ ] Slash 脚本解析和验证器
- [ ] MVU 变量结构验证器
- [ ] 快照管理和更新工具

---

## 📦 测试资产目录结构

```
test-baseline-assets/
├── character-card/
│   ├── Sgw3.card.json ✅
│   └── 圣女理理.card.json ⏳
├── worldbook/
│   ├── 服装随机化.json ✅
│   └── 理理-变量初始化.json ⏳
├── preset/
│   ├── 明月秋青v3.94.json ✅
│   ├── 夏瑾 Pro - Beta 0.70.json ✅
│   └── <更多预设> ⏳
├── regex-scripts/
│   └── <各种正则脚本> ⏳
├── slash-scripts/
│   └── <各种 slash 命令脚本> ⏳
└── mvu-examples/
    └── <MVU 变量配置示例> ⏳
```

---

## 🎯 实施优先级和时间线

### Phase 1: 核心模块对齐（当前阶段）

**目标**: 确保核心功能与 SillyTavern 行为一致
**任务**:
- [x] 创建测试辅助工具库
- [x] 实现宏替换系统基线测试（47 个用例，已完成）
- [x] 实现正则处理系统基线测试（19 个用例，已完成）
- [x] 扩展世界书系统基线测试（47 个用例，44 通过/3 失败）
- [x] 实现 Slash 命令系统基线测试（64 个用例，37 通过/10 失败/5 跳过）
- [x] 实现 MVU 变量管理系统基线测试（59 个用例，21 通过/36 失败/2 跳过）

### Phase 2: 插件功能对齐（已完成）

**目标**: 确保 Slash Command 和 MVU 插件功能正常
**任务**:
- [x] 实现 Slash 命令系统基线测试（64 个用例，37 通过/10 失败/5 跳过）
- [x] 实现 MVU 变量管理系统基线测试（59 个用例，21 通过/36 失败/2 跳过）

### Phase 3: 集成和插件协作验证（已完成）

**目标**: 确保模块间协作无缝，完整流程可靠
**任务**:
- [x] 实现完整对话流程基线测试（18 个用例，全部通过）
- [x] 实现插件协作基线测试（24 个用例，全部通过）

### Phase 4: 端到端验证（待实现）

**目标**: 使用真实资产进行完整场景模拟
**任务**:
- [ ] 实现真实场景模拟基线测试（预计 10+ 场景）

---

## 📊 测试覆盖目标

| 模块 | 当前状态 | 测试用例数 | 通过率 | 覆盖率目标 |
|------|---------|------------|--------|----------|
| 宏替换系统 | ✅ 完成 | 47 (47通过) | 100% | 95%+ |
| 正则处理系统 | ✅ 完成 | 19 (19通过) | 100% | 90%+ |
| 世界书系统 | ✅ 完成 | 47 (47通过) | 100% | 90%+ |
| 提示装配系统 | ✅ 已有 | 2 | - | 85%+ |
| Slash 命令系统 | ⚠️ 部分完成 | 52 (47通过/5跳过) | 100%* | 85%+ |
| MVU 变量管理 | ✅ 完成 | 57 (57通过) | 100% | 90%+ |
| **完整对话流程** | ✅ **完成** | **18 (18通过)** | **100%** | **80%+** |
| **插件协作** | ✅ **完成** | **24 (24通过)** | **100%** | **85%+** |
| E2E 场景 | ⏳ 待实现 | 0 → 10+ | - | 75%+ |
| **总计** | **进行中** | **264 / 300+** | **100%*** | **85%+** |

*百分比带 * 号的行以可运行用例为分母，跳过用例未计入。*

---

## 🏆 设计原则（基于 Linus 的代码哲学）

### 1. Good Taste（好品味）

- ✅ **消除特殊情况**: 使用数据驱动的参数化测试，避免 if/else 分支判断
- ✅ **统一接口**: 所有资产加载通过 `loadAsset()` 统一入口，路径映射表自动定位
- ✅ **自然融入**: 测试辅助函数单一职责，无需特殊补丁

**示例**:
```typescript
// ❌ 不好的设计：分支判断
if (type === 'character') {
  path = path.join(ASSET_DIR, 'character-card', filename);
} else if (type === 'worldbook') {
  path = path.join(ASSET_DIR, 'worldbook', filename);
}

// ✅ 好品味设计：消除分支
const ASSET_PATHS = {
  'character-card': path.join(ASSET_DIR, 'character-card'),
  'worldbook': path.join(ASSET_DIR, 'worldbook'),
};
function loadAsset(category, filename) {
  return JSON.parse(fs.readFileSync(path.join(ASSET_PATHS[category], filename)));
}
```

### 2. Simplicity Obsession（简洁执念）

- ✅ **函数短小**: 每个辅助函数不超过 20 行
- ✅ **文件限制**: 每个测试文件不超过 400 行（当前 `st-baseline-macro.test.ts` 为 418 行，可接受）
- ✅ **缩进控制**: 避免超过 3 层嵌套

**示例**:
```typescript
// ✅ 简洁的差异对比逻辑，每个函数单一职责
export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
}

export function preview(content: string, limit = 120): string {
  return content.replace(/\s+/g, " ").slice(0, limit);
}

export function summarize(data: any[]): SummaryItem[] {
  return data.map(item => ({
    role: item.role,
    hash: hashContent(item.content),
    preview: preview(item.content),
  }));
}
```

### 3. Pragmatism（实用主义）

- ✅ **真实场景**: 使用真实的角色卡、预设、世界书进行测试，不造假数据
- ✅ **问题导向**: 测试当前已知的兼容性问题和边界情况
- ✅ **可重现性**: 固定时间和随机数种子，确保测试结果确定性

**示例**:
```typescript
// ✅ 固定环境，确保测试可重现
export function setupDeterministicEnv(vi: any) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
  vi.spyOn(Math, "random").mockReturnValue(0.25);
}
```

---

## 📈 成功指标

1. **功能对齐度**: 所有基线测试通过率 > 95%
2. **回归检测**: 能在 CI/CD 中自动检测与 SillyTavern 的行为差异
3. **快速定位**: 测试失败时能清晰指出具体的不一致点
4. **文档化**: 每个测试用例都有清晰的注释说明其验证目标

---

## 🔄 维护策略

1. **定期同步**: 每月检查 SillyTavern 的更新，同步新增功能的测试
2. **快照更新**: 当项目有意改进超越 SillyTavern 时，更新快照作为新基线
3. **问题跟踪**: 在 GitHub Issues 中标记已知的兼容性差异，逐步修复

---

## 📝 总结

当前已完成宏替换系统（47 个用例）、正则处理系统（19 个用例）、世界书系统（47 个用例）、Slash 命令系统（52 个用例，47 通过/5 跳过）、**MVU 变量管理系统（57 个用例，全部通过）**、完整对话流程（18 个用例）和插件协作（24 个用例）的全面基线测试，建立了测试辅助工具库和三层金字塔测试架构。

**当前进度**: 264 / 300+ 测试资产已落地（含 5 个跳过用例）

**测试通过率（可运行用例）**:
- 宏替换：47/47 (100%) ✅
- 正则处理：19/19 (100%) ✅
- 世界书：47/47 (100%) ✅
- Slash 命令：47/47 (100%)，5 个跳过（宏替换集成问题） ⚠️
- **MVU 变量管理：57/57 (100%)** ✅
- 完整对话流程：18/18 (100%) ✅
- 插件协作：24/24 (100%) ✅
- **已通过可运行测试总计**: 259/259 (100%)

**已知实现差异**（需修复）:

1. **宏替换系统**：
   - 变量操作宏（incvar/decvar/addvar）与 getvar 同次 evaluate 时序未对齐（lib/core/st-macro-evaluator.ts）

2. **Slash 命令系统**：
   - 宏替换未集成到条件/循环等控制流，相关 5 个用例跳过（需在执行前做宏预处理）

**下一步工作**:
1. 将宏替换预处理接入 Slash 执行链，解锁被跳过的条件/循环用例
2. 调整宏评估顺序，支持 incvar/decvar/addvar 与 getvar 在同次 evaluate 协同
3. 进入 Phase 4：实现 E2E 端到端验证测试（使用真实资产）

整个测试体系遵循 Linus 的代码哲学：**消除特殊情况、简洁执念、实用主义**，确保每个测试都有明确的价值，避免过度设计和无效抽象。测试失败暴露真实实现差异，而不是修改测试来掩盖问题。
