# UI/面板落地决策

## 决策日期
2024-12-15

## 背景
任务6要求选择 UI 实现方案：
- 方案A：直接嵌入 JS-Slash-Runner panel
- 方案B：用现有组件重建最小 UI

## 现状分析

### 已有基础设施

| 组件 | 位置 | 功能 |
|------|------|------|
| RightPanel | `components/layout/RightPanel.tsx` | 统一面板容器，panelId 驱动 |
| ScriptSandbox | `components/ScriptSandbox.tsx` | iframe 沙箱，消息通信 |
| RegexScriptEditor | `components/regex-editor/` | 完整脚本编辑器（列表、工具栏、源切换） |
| PluginsPanel | `components/panels/PluginsPanel.tsx` | 插件管理入口 |
| script-runner.html | `public/iframe-libs/` | 脚本执行环境 |
| slash-runner-shim.js | `public/iframe-libs/` | SillyTavern API 兼容层 |

### 架构优势

1. **iframe 沙箱隔离** - 安全执行用户脚本
2. **消息驱动通信** - `SCRIPT_EXECUTE` / `SCRIPT_RESULT` / `API_CALL`
3. **高度自适应** - ScriptSandbox 已支持动态高度
4. **类型安全** - 完整的 TypeScript 类型定义

## 决策结论

**选择方案B的变体：复用现有组件，无需重建**

### 理由

1. **RegexScriptEditor 已覆盖脚本管理需求**
   - 脚本列表 ✓
   - 导入/导出 ✓
   - 编辑/排序 ✓

2. **音频命令已通过 Slash Command 提供**
   - `/audioplay`, `/audiostop`, `/audiovolume` 等
   - 无需专用 UI，可在脚本中直接调用

3. **工具注册已通过 API 实现**
   - `registerFunctionTool` / `registerSlashCommand`
   - shim 已去 stub，功能可用

4. **PluginsPanel 可作为扩展入口**
   - 若需要，可在此面板添加脚本执行状态展示

## 后续可选增强

| 增强项 | 优先级 | 说明 |
|--------|--------|------|
| 脚本执行日志面板 | P3 | 基于 SlashDebugMonitor 事件 |
| 音频可视化控件 | P3 | 基于 SoundContext 扩展 |
| Quick Reply 面板 | P2 | 类似 SillyTavern QR 面板 |

## 验证清单

- [x] ScriptSandbox 可正常加载脚本
- [x] API 调用链路通畅
- [x] Slash 命令可从脚本调用
- [x] 类型检查通过

## 相关文件

- `lib/slash-command/` - 命令系统
- `hooks/script-bridge/` - API 处理器
- `public/iframe-libs/` - 运行时环境
