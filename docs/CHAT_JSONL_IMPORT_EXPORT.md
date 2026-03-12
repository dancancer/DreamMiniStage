# Chat JSONL Import/Export + Swipes

本项目支持 **SillyTavern 风格 JSONL** 的聊天导入/导出，并将 **assistant 多候选（swipe variants）** 作为核心对话能力的一部分。

## Swipes（assistant 多候选）

- 同一轮用户输入会对应多个 assistant 回复候选（swipes），以 **同父节点 + 同 userInput 的 sibling nodes** 表示。
- 当前选中的候选由 `DialogueTree.current_nodeId` 指向的节点决定。
- **重新生成（Regenerate）最后一条 assistant**：不会删除旧回复，而是创建一个新的 sibling 节点，并切换到新节点（新候选成为激活候选）。

### UI 操作

- 仅在 **最后一条 assistant** 消息显示 swipe 控制（`prev/next` + `2/5` 指示）。
- Slash 命令兼容：`/swipe`（默认 next）、`/swipe prev`、`/swipe 2`（0-based index）。

## JSONL 格式（SillyTavern-like）

### 导出

- 第一行：metadata（至少包含 `user_name`、`character_name`）。
- 后续每行：message 对象。
  - 用户消息：
    - `{ "is_user": true, "is_system": false, "mes": "<userInput>" }`
  - assistant 消息：
    - `{ "is_user": false, "is_system": false, "mes": "<selected>" }`
    - 当该轮存在多个候选时额外包含：
      - `"swipes": ["<swipe0>", "<swipe1>", ...]`
      - `"swipe_id": <activeIndex>`

### 导入

- 逐行解析 JSONL，按 `(user, assistant)` 进行配对重建对话树。
- 若 assistant 行包含 `swipes[]`：
  - 为该轮创建多个 sibling 节点（同 parentNodeId、同 userInput）
  - 依据 `swipe_id` 选择激活候选，并以该候选继续后续对话串联

### 限制与兼容性说明

- 未支持/未识别字段采用确定性映射：
  - 导入时：保留到根节点 `extra.jsonl_metadata` 或 turn 节点 `extra.jsonl_message`
  - 导出时：会按原始 header / user / assistant 位置回填，保证 round-trip 不丢失已保留字段
- `is_system` 目前不做专用通道处理（按普通 assistant 文本导入/导出）。
- 群聊字段会被忽略。

## UI 入口

在聊天页输入框左侧的「展开控制」面板中：

- `导入 JSONL`：选择 `.jsonl` 文件后导入，并刷新当前会话对话。
- `导出 JSONL`：下载当前会话的 `.jsonl` 文件。
