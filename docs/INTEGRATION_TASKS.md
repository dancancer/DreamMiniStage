# SillyTavern 功能整合任务清单

> **生成时间**: 2025-12-13
> **关联文档**: [SILLYTAVERN_INTEGRATION_REPORT.md](./SILLYTAVERN_INTEGRATION_REPORT.md)

本文档提供具体的开发任务清单，按优先级排序。

---

## Phase 1: TavernHelper API 完善

### 1.1 核心 API 实现

```
优先级: ⭐⭐⭐⭐⭐ (最高)
预计工作量: ~800 行代码
```

**文件**: `lib/script-runner/tavern-helper.ts`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 创建 TavernHelper 工厂函数 | □ | - |
| 实现 `generate()` API | □ | LLMNode |
| 实现 `generateRaw()` API | □ | LLMNode |
| 实现 `stopGenerationById()` | □ | AbortController |
| 实现 `eventOn/eventEmit/eventOnce` | □ | EventEmitter |
| 实现 `eventMakeFirst/eventMakeLast` | □ | EventEmitter |
| 实现 `eventClearAll()` (自动清理) | □ | ScriptContext |
| 实现 `getVariables/replaceVariables` | □ | MVU Store |
| 实现 `getAllVariables()` (合并) | □ | MVU Store |
| 实现 `getChatMessages/createChatMessages` | □ | DialogueStore |
| 实现 `getPreset/loadPreset` | □ | PresetStore |
| 实现 `getWorldbookNames/createWorldbookEntries` | □ | WorldBookOps |
| 实现 `triggerSlash()` | □ | SlashRegistry |
| 实现 `substitudeMacros()` | □ | STMacroEvaluator |

### 1.2 脚本存储系统

```
优先级: ⭐⭐⭐⭐⭐ (最高)
预计工作量: ~600 行代码
```

**文件**: `lib/script-runner/script-storage.ts`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 定义 Script/ScriptFolder 类型 | □ | - |
| 实现全局脚本存储 | □ | IndexedDB |
| 实现预设级脚本存储 | □ | PresetStore |
| 实现角色卡级脚本存储 | □ | CharacterStore |
| 实现脚本启用状态管理 | □ | - |
| 实现 `getActiveScripts()` 合并函数 | □ | - |
| 实现脚本 data 持久化 | □ | IndexedDB |

**文件**: `lib/data/roleplay/script-operation.ts`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 创建 ScriptOperation 类 | □ | IndexedDB |
| 实现 CRUD 操作 | □ | - |
| 实现脚本树查询 | □ | - |

### 1.3 脚本按钮系统

```
优先级: ⭐⭐⭐⭐ (高)
预计工作量: ~400 行代码
```

**文件**: `lib/script-runner/script-buttons.ts`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 定义 ScriptButton 类型 | □ | - |
| 实现 `getScriptButtons()` | □ | ScriptStorage |
| 实现 `replaceScriptButtons()` | □ | ScriptStorage |
| 实现 `appendInexistentScriptButtons()` | □ | - |
| 实现 `getButtonEvent()` 事件映射 | □ | EventEmitter |

**文件**: `components/ScriptButtonPanel.tsx`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 创建按钮面板组件 | □ | Radix UI |
| 实现按钮动态渲染 | □ | useScriptButtons hook |
| 实现按钮点击事件分发 | □ | EventEmitter |
| 实现按钮可见性过滤 | □ | - |
| 添加到聊天界面 | □ | CharacterChatPanel |

### 1.4 脚本编辑器 UI

```
优先级: ⭐⭐⭐ (中)
预计工作量: ~600 行代码
```

**文件**: `components/ScriptEditor.tsx`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 创建脚本列表视图 | □ | ScriptStorage |
| 实现脚本创建/删除 UI | □ | - |
| 集成代码编辑器 (Monaco/CodeMirror) | □ | 第三方库 |
| 实现脚本启用/禁用开关 | □ | - |
| 实现脚本信息编辑 | □ | - |
| 实现按钮配置 UI | □ | - |

---

## Phase 2: 群聊与 Persona

### 2.1 群聊系统

```
优先级: ⭐⭐⭐ (中)
预计工作量: ~800 行代码
```

**文件**: `lib/models/group-model.ts`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 定义 Group 类型 | □ | - |
| 定义 GroupMessage 类型 | □ | - |
| 定义角色轮换策略枚举 | □ | - |

**文件**: `lib/data/roleplay/group-operation.ts`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 创建 GroupOperation 类 | □ | IndexedDB |
| 实现群组 CRUD | □ | - |
| 实现成员管理 | □ | CharacterOps |

**文件**: `lib/store/group-store.ts`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 创建群组状态管理 | □ | Zustand |
| 实现当前群组状态 | □ | - |
| 实现轮换逻辑 | □ | - |

**文件**: `components/GroupChatPanel.tsx`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 创建群组创建对话框 | □ | Radix Dialog |
| 实现成员选择器 | □ | CharacterOps |
| 实现轮换策略配置 | □ | - |
| 实现群聊视图 | □ | DialogueStore |

### 2.2 Persona 系统

```
优先级: ⭐⭐⭐ (中)
预计工作量: ~400 行代码
```

**文件**: `lib/models/persona-model.ts`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 定义 Persona 类型 | □ | - |

**文件**: `lib/data/roleplay/persona-operation.ts`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 创建 PersonaOperation 类 | □ | IndexedDB |
| 实现 Persona CRUD | □ | - |
| 实现默认 Persona | □ | - |

**文件**: `components/PersonaSelector.tsx`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 创建 Persona 选择器 | □ | Radix DropdownMenu |
| 实现 Persona 编辑 | □ | - |
| 集成到聊天界面 | □ | CharacterChatPanel |

---

## Phase 3: 多后端完善

### 3.1 Claude API 完善

```
优先级: ⭐⭐⭐ (中)
预计工作量: ~300 行代码
```

**文件**: `lib/core/prompt/converters/claude.ts`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 完善 system 消息处理 | □ | - |
| 实现多轮 system 合并 | □ | - |
| 添加 anthropic-beta 头部支持 | □ | - |
| 实现 extended thinking 支持 | □ | - |

**文件**: `lib/api/backends.ts`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 完善 Claude 后端配置 | □ | - |
| 添加 Claude 特有参数 | □ | - |

### 3.2 Gemini API 完善

```
优先级: ⭐⭐ (中低)
预计工作量: ~300 行代码
```

**文件**: `lib/core/prompt/converters/google.ts`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 完善消息格式转换 | □ | - |
| 实现多模态支持 | □ | - |
| 添加安全设置配置 | □ | - |

### 3.3 TextGen API 实现

```
优先级: ⭐⭐ (中低)
预计工作量: ~400 行代码
```

**文件**: `lib/core/prompt/converters/textgen.ts`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 创建 TextGen 转换器 | □ | - |
| 实现模型列表获取 | □ | - |
| 实现生成参数映射 | □ | - |

---

## Phase 4: 数据兼容

### 4.1 角色卡 PNG 导入导出

```
优先级: ⭐⭐ (低)
预计工作量: ~300 行代码
```

**文件**: `lib/data/import-export/png-metadata.ts`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 实现 PNG tEXt 块读取 | □ | - |
| 实现 PNG tEXt 块写入 | □ | - |
| 实现角色数据 base64 编解码 | □ | - |
| 实现 Character Card v2/v3 解析 | □ | - |

### 4.2 聊天 JSONL 导入导出

```
优先级: ⭐⭐ (低)
预计工作量: ~200 行代码
```

**文件**: `lib/data/import-export/jsonl-chat.ts`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 实现 JSONL 解析 | □ | - |
| 实现 JSONL 序列化 | □ | - |
| 实现消息格式映射 | □ | DialogueStore |

### 4.3 导入导出 UI

```
优先级: ⭐ (低)
预计工作量: ~400 行代码
```

**文件**: `components/ImportExportPanel.tsx`

| 任务 | 状态 | 依赖 |
|------|------|------|
| 创建导入向导 | □ | Radix Dialog |
| 创建导出选择器 | □ | - |
| 实现批量导入 | □ | - |
| 实现格式自动检测 | □ | - |

---

## 测试任务

### 单元测试

| 文件 | 覆盖目标 | 状态 |
|------|----------|------|
| `tavern-helper.test.ts` | TavernHelper API | □ |
| `script-storage.test.ts` | 脚本存储 | □ |
| `script-buttons.test.ts` | 按钮系统 | □ |
| `group-operation.test.ts` | 群组操作 | □ |
| `persona-operation.test.ts` | Persona 操作 | □ |

### Property-Based 测试

| 文件 | 覆盖目标 | 状态 |
|------|----------|------|
| `tavern-helper.property.test.ts` | API 边界条件 | □ |
| `script-merge.property.test.ts` | 脚本合并逻辑 | □ |

### 集成测试

| 文件 | 覆盖目标 | 状态 |
|------|----------|------|
| `script-execution.integration.test.ts` | 脚本完整执行流程 | □ |
| `group-chat.integration.test.ts` | 群聊完整流程 | □ |

---

## 完成标准

### Phase 1 完成标准
- [ ] 现有 JS-Slash-Runner 脚本可以直接运行
- [ ] 脚本按钮在聊天界面正确显示和响应
- [ ] 脚本数据在会话间正确持久化
- [ ] 所有新增 API 有对应测试用例

### Phase 2 完成标准
- [ ] 可以创建和管理群组
- [ ] 群聊消息正确显示角色来源
- [ ] Persona 可以在对话中切换
- [ ] 群聊历史正确保存和加载

### Phase 3 完成标准
- [ ] Claude API 支持所有主要功能
- [ ] Gemini API 支持多模态
- [ ] TextGen API 可以连接本地模型

### Phase 4 完成标准
- [ ] 可以导入 SillyTavern 角色卡 PNG
- [ ] 可以导入 SillyTavern 聊天记录
- [ ] 可以导出为 SillyTavern 兼容格式

---

## 注意事项

1. **代码质量**: 每个文件不超过 400 行，必要时拆分
2. **测试覆盖**: 新功能必须有对应测试
3. **类型安全**: 使用 TypeScript 严格模式，避免 `any`
4. **文档更新**: 重要 API 变更需更新 docs/
5. **向后兼容**: 不破坏现有功能
