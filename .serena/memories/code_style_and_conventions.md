# 代码风格与约定
- 语言/框架：TypeScript 优先（strict），React 19 函数组件，Next.js 15 App Router；路径别名 `@/*`。
- 格式：ESLint flat 配置 enforcing 2 空格缩进、双引号、分号、对象括号空格、末尾换行、最多 1 个空行、逗号尾随多行；Prettier printWidth 150、trailingComma es5、tabWidth 2、singleQuote true（若冲突以 ESLint 为准）。
- UI 约定：Tailwind 4 公共主题 token（bg-primary/text-foreground/border 等），用 `cn` 合并类；动画用 Tailwind animate-in/transition，避免 framer-motion；Radix/shadcn 组件从 `@/components/ui/*` 组合，不自造基础控件；移动优先响应式类。
- 命名：组件 PascalCase，hooks `useX`, 工具函数 camelCase；文件尽量 <400 行，函数 <20 行且单一职责；超过 3 层缩进或 3+ 分支需重构结构。
- 注释：中文简明，必要时使用 ASCII 分块风格；代码为人可读优先。
- 测试：Vitest+jsdom，测试文件放 `__tests__` 目录（如 components/__tests__/ChatHtmlBubble.test.ts）。
- 其他：优先消除特殊分支而非堆 if/else；多数据项常一起出现时合并为对象；避免循环依赖/重复逻辑；尽量保持每层目录文件 ≤4 个（可再分子目录）。