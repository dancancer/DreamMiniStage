**一旦我所属的文件夹有所变化，请更新我**

# token-usage/

Token 用量适配器。统一各 LLM API 的 Token 用量统计。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `index.ts` | 模块入口 | 导出用量适配器 |
| `types.ts` | 类型定义 | 用量类型定义 |
| `anthropic.ts` | 适配器 | Anthropic Token 统计 |
| `google.ts` | 适配器 | Google Token 统计 |
| `openai.ts` | 适配器 | OpenAI Token 统计 |
