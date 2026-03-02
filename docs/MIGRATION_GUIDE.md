# 导入指南（SillyTavern）

本项目当前处于开发阶段，已明确不再维护“旧版本本地数据迁移链路”。

本指南仅覆盖 **SillyTavern 资产导入**（预设、世界书、正则脚本、聊天 JSONL 等），不再包含 DreamMiniStage 历史版本之间的兼容迁移说明。

## 适用范围

- 需要把 SillyTavern 现有配置迁移到 DreamMiniStage
- 需要验证导入后与 SillyTavern 行为是否一致

不适用：
- 旧版 DreamMiniStage 本地存储结构升级
- 历史兼容字段自动修复

## 预设导入（OpenAI Preset）

1. 在 SillyTavern 打开 **AI Response Configuration**。
2. 导出预设 JSON 文件。
3. 在 DreamMiniStage 通过导入入口加载该 JSON。
4. 导入后重点核对：
   - `prompts`
   - `prompt_order`
   - 采样参数（temperature/top_p/top_k 等）

## 导入验收清单

每次导入后建议最少跑一轮对齐检查：

1. 宏替换：`{{user}}`、`{{char}}`、变量宏行为正确。
2. 消息组装：marker 插入位置与预期一致。
3. 世界书注入：关键词触发、深度/优先级生效。
4. 正则脚本：启用状态与执行顺序符合预期。
5. Slash/MVU：目标脚本可执行，无旧接口依赖。

## 常见问题

### 导入成功但行为不一致

优先检查以下两点：

- 预设中的 `prompt_order` 是否完整。
- 世界书/正则脚本是否在当前会话范围内启用。

### 是否支持旧版本地数据自动迁移

不支持。

项目已移除历史数据兼容链路，建议使用当前导出格式重新导入。

## 相关文档

- `docs/analysis/sillytavern-integration-gap-2026-03.md`
- `docs/PRESET_FORMAT.md`
- `docs/MACRO_REFERENCE.md`
- `docs/CHAT_JSONL_IMPORT_EXPORT.md`
