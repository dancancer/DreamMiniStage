#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/ 目录文件头注释批量添加工具
 *
 * 为 lib/ 目录下所有 .ts 文件添加标准化文件头注释
 * ═══════════════════════════════════════════════════════════════════════════
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// ========== 配置 ==========

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const LIB_DIR = path.join(PROJECT_ROOT, "lib");

// ========== 工具函数 ==========

/**
 * 递归扫描目录,获取所有 .ts 文件
 */
async function scanDirectory(dir) {
  const files = [];

  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // 跳过测试目录
        if (entry.name === "__tests__") continue;
        await walk(fullPath);
      } else if (entry.isFile()) {
        // 跳过 index.ts 和测试文件
        if (entry.name === "index.ts" || entry.name.includes(".test.")) continue;

        // 只处理 .ts 文件
        if (entry.name.endsWith(".ts")) {
          files.push(fullPath);
        }
      }
    }
  }

  await walk(dir);
  return files;
}

/**
 * 分析文件的导入导出
 */
function analyzeFile(content) {
  const imports = [];
  const exports = [];

  // 提取导入
  const importRegex = /import\s+(?:{[^}]+}|[\w*]+)?\s*(?:,\s*{[^}]+})?\s*from\s+["']([^"']+)["']/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    // 只记录内部依赖
    if (importPath.startsWith("@/")) {
      const mainCategory = importPath.split("/").slice(1, 3).join("/");
      if (!imports.includes(mainCategory)) {
        imports.push(mainCategory);
      }
    }
  }

  // 提取导出
  const exportDefaultRegex = /export\s+default\s+(?:function|class)?\s*(\w+)/;
  const exportNamedRegex = /export\s+(?:function|class|const|interface|type|enum)\s+(\w+)/g;

  const defaultMatch = exportDefaultRegex.exec(content);
  if (defaultMatch) {
    exports.push(defaultMatch[1]);
  }

  while ((match = exportNamedRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  return { imports, exports };
}

/**
 * 根据文件路径推断角色定位
 */
function inferPosition(filePath) {
  const relativePath = path.relative(LIB_DIR, filePath);
  const parts = relativePath.split(path.sep);
  const fileName = path.basename(filePath, ".ts");

  // 目录映射规则
  const positionMap = {
    "core": "核心提示词组装与处理模块",
    "core/prompt": "提示词管理与转换模块",
    "core/prompt/converters": "LLM 提供商格式转换器",
    "store": "Zustand 状态管理模块",
    "models": "数据模型定义",
    "data": "数据操作层",
    "data/roleplay": "角色扮演数据操作层",
    "data/agent": "Agent 数据操作层",
    "data/import-export": "数据导入导出模块",
    "slash-command": "斜杠命令系统",
    "slash-command/core": "斜杠命令核心引擎",
    "slash-command/registry": "斜杠命令注册表",
    "slash-command/registry/handlers": "斜杠命令处理器",
    "slash-command/registry/utils": "斜杠命令工具函数",
    "mvu": "MVU 变量系统 - Model-View-Update 架构",
    "mvu/core": "MVU 核心解析执行引擎",
    "mvu/data": "MVU 数据持久化层",
    "nodeflow": "节点流程执行引擎",
    "nodeflow/LLMNode": "LLM 调用节点",
    "nodeflow/PresetNode": "预设处理节点",
    "nodeflow/ContextNode": "上下文构建节点",
    "nodeflow/HistoryPreNode": "历史预处理节点",
    "nodeflow/MemoryNode": "记忆检索节点",
    "nodeflow/OutputNode": "输出处理节点",
    "nodeflow/PluginNode": "插件执行节点",
    "nodeflow/RegexNode": "正则处理节点",
    "nodeflow/UserInputNode": "用户输入节点",
    "nodeflow/WorldBookNode": "世界书处理节点",
    "streaming": "流式响应处理模块",
    "storage": "存储抽象层",
    "api": "API 请求处理模块",
    "utils": "通用工具函数",
    "vector-memory": "向量记忆检索模块",
    "plugins": "插件系统模块",
    "audio": "音频控制模块",
    "adapters": "数据适配器层",
    "adapters/import": "导入适配器",
    "adapters/token-usage": "Token 使用统计适配器",
    "extensions": "扩展功能模块",
    "events": "事件系统模块",
    "prompts": "提示词模板模块",
    "tools": "工具调用模块",
    "workflow": "工作流引擎",
    "script-runner": "脚本运行时环境",
    "prompt-viewer": "提示词查看器模块",
    "dialogue": "对话处理模块",
  };

  // 特殊文件名映射
  const fileNameMap = {
    "macro-evaluator-manager": "宏求值器管理,统一管理多种宏替换策略",
    "st-macro-evaluator": "SillyTavern 兼容宏求值器",
    "macro-substitutor": "宏变量替换器",
    "regex-processor": "正则脚本处理器",
    "regex-debugger": "正则脚本调试器",
    "world-book": "世界书条目匹配与注入",
    "world-book-loader": "世界书加载器",
    "world-book-advanced": "世界书高级功能(sticky/cooldown/概率)",
    "world-book-cascade-loader": "世界书级联加载器",
    "token-manager": "Token 计数与预算管理",
    "memory-manager": "记忆系统管理器",
    "memory-utils": "记忆系统工具函数",
    "character-history": "角色对话历史管理",
    "character-dialogue": "角色对话核心逻辑",
    "character": "角色数据处理",
    "config-manager": "配置管理器",
    "gemini-client": "Google Gemini API 客户端",
    "dialogue-key": "对话键生成与管理",
    "trim-string-filter": "字符串修剪过滤器",
    "extension-prompts": "扩展提示词管理",
    "st-preset-types": "SillyTavern 预设类型定义",
    "executor": "命令执行器",
    "parser": "命令解析器",
    "scope": "作用域管理",
    "types": "类型定义",
    "debug": "调试工具",
    "schema": "Schema 定义",
    "snapshot": "快照管理",
    "floor-management": "楼层管理",
    "floor-replay": "楼层回放",
    "worldbook-filter": "世界书过滤器",
    "math-eval": "数学表达式求值",
    "auto-cleanup": "自动清理",
    "json-patch": "JSON Patch 操作",
    "variable-init": "变量初始化",
    "function-call": "函数调用处理",
    "extra-model": "额外模型定义",
    "manager": "管理器",
    "sorting": "排序算法",
    "preset-utils": "预设工具函数",
    "compatibility": "兼容性处理",
    "post-processor": "后处理器",
    "google": "Google 格式转换",
    "claude": "Claude 格式转换",
    "helpers": "辅助函数",
    "operators": "操作符处理",
    "messages": "消息处理",
    "core": "核心功能",
    "generation": "生成处理",
    "variables": "变量处理",
    "events": "事件处理",
    "js-slash-runner": "JS Slash Runner 兼容层",
    "template": "模板处理",
    "store": "状态存储",
    "persistence": "持久化处理",
  };

  // 先尝试文件名映射
  if (fileNameMap[fileName]) {
    return fileNameMap[fileName];
  }

  // 再尝试目录映射
  const dirPath = parts.slice(0, -1).join("/");
  if (positionMap[dirPath]) {
    return positionMap[dirPath];
  }

  // 尝试第一级目录
  if (parts.length > 0 && positionMap[parts[0]]) {
    return positionMap[parts[0]];
  }

  // 默认
  return "库函数模块";
}

/**
 * 检查文件是否已有标准化注释
 */
function hasStandardHeader(content) {
  return content.includes("@input") && content.includes("@output") && content.includes("@pos");
}

/**
 * 生成文件头注释
 */
function generateHeader(filePath, content) {
  const { imports, exports } = analyzeFile(content);
  const position = inferPosition(filePath);

  // 格式化 @input
  const inputStr = imports.length > 0
    ? imports.map(i => `@/${i}`).join(", ")
    : "无外部依赖";

  // 格式化 @output
  const outputStr = exports.length > 0
    ? exports.slice(0, 5).join(", ") + (exports.length > 5 ? " ..." : "")
    : path.basename(filePath, ".ts");

  return `/**
 * @input  ${inputStr}
 * @output ${outputStr}
 * @pos    ${position}
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */`;
}

/**
 * 为文件添加头注释
 */
async function addHeaderToFile(filePath) {
  try {
    let content = await fs.readFile(filePath, "utf-8");

    // 检查是否已有标准化注释
    if (hasStandardHeader(content)) {
      console.log(`⏭️  跳过 (已有注释): ${path.relative(PROJECT_ROOT, filePath)}`);
      return { status: "skipped", reason: "already-has-header" };
    }

    // 分析文件
    const { imports, exports } = analyzeFile(content);
    const position = inferPosition(filePath);

    const inputStr = imports.length > 0
      ? imports.map(i => `@/${i}`).join(", ")
      : "无外部依赖";

    const outputStr = exports.length > 0
      ? exports.slice(0, 5).join(", ") + (exports.length > 5 ? " ..." : "")
      : path.basename(filePath, ".ts");

    // 检查是否有 ASCII 艺术字注释
    const hasAsciiArt = content.includes("╔═") || content.includes("║");

    let newContent;

    if (hasAsciiArt) {
      // 如果有 ASCII 艺术字,在其开头添加标签
      const artMatch = content.match(/^(\/\*\*[\s\S]*?\*\/)/);
      if (artMatch) {
        const oldComment = artMatch[1];
        // 在 /** 后面立即添加标签
        const newComment = oldComment.replace(
          /^\/\*\*/,
          `/**\n * @input  ${inputStr}\n * @output ${outputStr}\n * @pos    ${position}\n * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md\n *`
        );
        newContent = content.replace(oldComment, newComment);
      } else {
        // 如果匹配失败,直接在开头添加
        const header = generateHeader(filePath, content);
        newContent = `${header}\n\n${content}`;
      }
    } else {
      // 直接在文件开头添加
      const header = generateHeader(filePath, content);
      newContent = `${header}\n\n${content}`;
    }

    // 写回文件
    await fs.writeFile(filePath, newContent, "utf-8");

    console.log(`✅ 处理完成: ${path.relative(PROJECT_ROOT, filePath)}`);
    return { status: "success" };

  } catch (error) {
    console.error(`❌ 处理失败: ${path.relative(PROJECT_ROOT, filePath)}`);
    console.error(`   错误: ${error.message}`);
    return { status: "error", error: error.message };
  }
}

// ========== 主函数 ==========

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  lib/ 目录文件头注释批量添加工具");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("📂 扫描目录:", LIB_DIR);

  const files = await scanDirectory(LIB_DIR);

  console.log(`\n📊 找到 ${files.length} 个文件需要处理\n`);

  const results = {
    success: 0,
    skipped: 0,
    error: 0,
  };

  for (const file of files) {
    const result = await addHeaderToFile(file);

    if (result.status === "success") {
      results.success++;
    } else if (result.status === "skipped") {
      results.skipped++;
    } else {
      results.error++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  处理完成");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`✅ 成功: ${results.success}`);
  console.log(`⏭️  跳过: ${results.skipped}`);
  console.log(`❌ 失败: ${results.error}`);
  console.log(`📊 总计: ${files.length}`);
}

main().catch(console.error);
