**一旦我所属的文件夹有所变化，请更新我**

# test-script-runner/

SillyTavern P4 Playwright E2E 调试页面。用于在浏览器环境串联执行脚本工具、Slash 控制流、MVU 与音频事件主场景。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `page.tsx` | 页面入口 | P4 场景执行控制台与 JSON 报告输出 |
| `scenarios.ts` | 场景编排 | 四条 P4 E2E 场景定义与执行逻辑 |
| `scenario-helpers.ts` | 辅助模块 | API 上下文与音频执行上下文工厂 |
