**一旦我所属的文件夹有所变化，请更新我**

# actions/

对话状态操作。按职责划分的状态变更函数。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `dialogue-event-emitter.ts` | 辅助 | 统一封装对话相关事件发射 |
| `dialogue-snapshot-state.ts` | 辅助 | 将后端/处理后的消息快照映射为对话状态补丁 |
| `dialogue-status-state.ts` | 辅助 | 统一封装对话发送状态补丁 |
| `generation-actions.ts` | 操作 | 生成相关操作 |
| `generation-event-state.ts` | 辅助 | 将生成事件映射为对话状态变更 |
| `generation-request-runtime.ts` | 辅助 | 统一封装生成请求生命周期、transport 分流与流式事件消费 |
| `lifecycle-actions.ts` | 操作 | 生命周期操作 |
| `message-actions.ts` | 操作 | 消息操作 |
| `navigation-actions.ts` | 操作 | 导航操作 |
