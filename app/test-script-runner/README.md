**一旦我所属的文件夹有所变化，请更新我**

# test-script-runner/

SillyTavern P4 Playwright E2E 调试页面。用于在浏览器环境串联执行主链路场景与故障注入场景。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `page.tsx` | 页面入口 | P4 场景执行控制台与 JSON 报告输出（主链路 + 故障注入） |
| `scenarios.ts` | 场景编排 | 7 条 P4 E2E 场景定义与执行逻辑（4 主链路 + 3 故障注入） |
| `scenario-helpers.ts` | 辅助模块 | API 上下文与音频执行上下文工厂 |
