# Getting Started with DreamMiniStage

本指南帮助你快速启动 DreamMiniStage 开发环境。

## 环境要求

- **Node.js** v18+
- **pnpm** (推荐) 或 npm
- **Git**

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/dancancer/DreamMiniStage.git
cd DreamMiniStage
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

按 `.env.example` 填入密钥（示例）：

```env
NEXT_PUBLIC_API_KEY=your_opeani_type_api_key       # 主模型 API Key
NEXT_PUBLIC_API_URL=https://api.openai.com/v1      # 主模型 Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3303         # 与 dev 端口保持一致
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key     # 可选：Gemini
NEXT_PUBLIC_GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta
NEXT_PUBLIC_TAVILY_API_KEY=your_tavily_search_api_key
NEXT_PUBLIC_JINA_API_KEY=your_jina_ai_api_key
NEXT_PUBLIC_FAL_API_KEY=your_fal_api_key
```

### 4. 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3303](http://localhost:3303)（脚本默认使用 Turbopack 和 3303 端口）

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 生产构建 |
| `pnpm lint` | 代码检查 |
| `pnpm lint:fix` | 自动修复 lint 问题 |
| `pnpm test` | 运行 Vitest（非 watch） |
| `pnpm build:pwa` | 构建 PWA 版本 |

## 打包部署

### Docker 部署

```bash
docker-compose up --build
```

### 桌面应用打包

首先安装 pake-cli：
```bash
npm install -g pake-cli
```

然后根据平台打包：

```bash
# macOS
pnpm pake-mac

# Linux
pnpm pake-linux

# Windows
pnpm pake-win
```

### PWA / 移动端

```bash
pnpm build:pwa
pnpm preview  # 预览 out/ 目录
```

## 常见问题

### macOS 安装后显示"已损坏"

```bash
xattr -d com.apple.quarantine /Applications/DreamMiniStage.app
```

## 项目结构

```
DreamMiniStage/
├── app/              # Next.js App Router 页面
├── components/       # React 组件
│   └── ui/          # Radix UI 基础组件
├── lib/             # 核心库
│   ├── core/        # 核心功能 (PromptManager, MacroEvaluator, WorldBook)
│   ├── events/      # 事件系统
│   ├── mvu/         # MVU 变量系统
│   └── slash-command/ # Slash 命令系统
├── hooks/           # React Hooks
├── contexts/        # React Contexts
├── types/           # TypeScript 类型定义
├── utils/           # 工具函数
├── public/          # 静态资源
└── docs/            # 文档
```

## 相关文档

- [Preset 格式说明](./PRESET_FORMAT.md)
- [宏系统参考](./MACRO_REFERENCE.md)
- [事件系统](./EVENT_SYSTEM.md)
- [SillyTavern 兼容性](./sillytavern-gap-analysis.md)

## 测试

运行全部测试：

```bash
pnpm test          # 等价于 vitest run
```

运行单个文件：

```bash
pnpm vitest run path/to/test-file.test.ts
```
