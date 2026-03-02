**一旦我所属的文件夹有所变化，请更新我**

# streaming/

流式处理模块。处理 LLM 流式响应与中断控制。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `index.ts` | 模块入口 | 导出流式处理功能 |
| `abort-controller.ts` | 核心 | 请求中断控制器 |
| `reasoning-extractor.ts` | 核心 | 推理过程提取 |
| `tool-call-parser.ts` | 核心 | 工具调用解析 |
| `sse-handler.ts` | 核心 | SSE 事件处理 |
