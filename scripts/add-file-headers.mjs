#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 文件头注释批量添加工具
 *
 * 为 components/ 目录下所有 .ts/.tsx 文件添加标准化文件头注释
 * ═══════════════════════════════════════════════════════════════════════════
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// ========== 配置 ==========

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const COMPONENTS_DIR = path.join(PROJECT_ROOT, "components");

// ========== 工具函数 ==========

/**
 * 递归扫描目录,获取所有 .ts/.tsx 文件
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

        // 只处理 .ts/.tsx 文件
        if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
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
      const mainCategory = importPath.split("/")[1];
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
  const relativePath = path.relative(COMPONENTS_DIR, filePath);
  const parts = relativePath.split(path.sep);
  const fileName = path.basename(filePath, path.extname(filePath));

  // 位置映射规则
  const positionMap = {
    "ui": "基础 UI 组件",
    "home": "首页会话管理组件",
    "panels": "功能面板组件",
    "character-chat": "角色对话交互组件",
    "character-sidebar": "角色侧边栏配置组件",
    "dialogue-tree": "对话树可视化组件",
    "import-modal": "数据导入模态框组件",
    "layout": "应用布局组件",
    "model-sidebar": "模型配置侧边栏组件",
    "plugin-manager": "插件管理组件",
    "preset-editor": "预设编辑器组件",
    "prompt-viewer": "提示词查看器组件",
    "regex-editor": "正则脚本编辑器组件",
    "worldbook-editor": "世界书编辑器组件",
    "download-modal": "应用下载模态框组件",
    "chat": "聊天相关组件",
  };

  // 特殊文件名映射
  const fileNameMap = {
    "PWAInstallButton": "PWA 安装按钮组件",
    "ThinkBubble": "角色思考气泡展示组件",
    "LoginModal": "用户登录模态框组件",
    "AccountModal": "用户账户管理模态框组件",
    "SettingsDropdown": "全局设置下拉菜单组件",
    "ToastProvider": "全局 Toast 通知提供者",
    "GoogleAnalytics": "Google Analytics 集成组件",
    "MobileBottomNav": "移动端底部导航栏组件",
    "MainLayout": "应用主布局容器",
    "ModelSidebar": "模型配置侧边栏入口",
    "CharacterSidebar": "角色配置侧边栏入口",
    "MessageBubble": "消息气泡展示组件",
    "CharacterChatPanel": "角色对话主面板",
    "WorldBookEditor": "世界书编辑器入口",
    "PresetEditor": "预设编辑器入口",
    "RegexScriptEditor": "正则脚本编辑器入口",
    "PersonaCard": "人格卡片展示组件",
    "PersonaEditor": "人格编辑器组件",
    "PersonaManagementPanel": "人格管理面板",
    "PersonaQuickSwitch": "人格快速切换组件",
    "CharacterCardGrid": "角色卡片网格展示",
    "CharacterCardCarousel": "角色卡片轮播组件",
    "CharacterAvatarBackground": "角色头像背景组件",
    "DialogueTreeModal": "对话树模态框",
    "EditCharacterModal": "角色编辑模态框",
    "EditPromptModal": "提示词编辑模态框",
    "ImportCharacterModal": "角色导入模态框",
    "ImportWorldBookModal": "世界书导入模态框",
    "ImportPresetModal": "预设导入模态框",
    "ImportRegexScriptModal": "正则脚本导入模态框",
    "CreatePresetModal": "预设创建模态框",
    "CopyPresetModal": "预设复制模态框",
    "EditPresetNameModal": "预设名称编辑模态框",
    "DownloadModal": "应用下载模态框",
    "PluginManagerModal": "插件管理器模态框",
    "GlobalWorldBookPanel": "全局世界书面板",
    "AgentProgressPanel": "Agent 进度面板",
    "AgentUserInput": "Agent 用户输入组件",
    "InlineUserInput": "内联用户输入组件",
    "CreatorAreaBanner": "创作区横幅组件",
    "RegexDebuggerPanel": "正则调试器面板",
    "RegexPresetSelector": "正则预设选择器",
    "RegexScriptEntryEditor": "正则脚本条目编辑器",
    "WorldBookEntryEditor": "世界书条目编辑器",
    "AdvancedSettingsEditor": "高级设置编辑器",
    "TagColorEditor": "标签颜色编辑器",
    "UserNameSettingModal": "用户名设置模态框",
    "ScriptSandbox": "脚本沙箱运行环境",
    "ScriptDebugPanel": "脚本调试面板",
    "ScriptButtonPanel": "脚本按钮面板",
    "HomeContent": "首页主内容区",
    "Sidebar": "应用侧边栏",
  };

  // 先尝试文件名映射
  if (fileNameMap[fileName]) {
    return fileNameMap[fileName];
  }

  // 再尝试目录映射
  if (parts.length > 1 && positionMap[parts[0]]) {
    return positionMap[parts[0]];
  }

  // 默认
  return "UI 组件";
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
    : "React, UI 基础组件";

  // 格式化 @output
  const outputStr = exports.length > 0
    ? exports.join(", ")
    : path.basename(filePath, path.extname(filePath));

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
      : "React, UI 基础组件";

    const outputStr = exports.length > 0
      ? exports.join(", ")
      : path.basename(filePath, path.extname(filePath));

    // 检查是否有 ASCII 艺术字注释
    const hasAsciiArt = content.includes("╔═") || content.includes("║");

    // 检查是否有 "use client" 指令
    const useClientRegex = /^["']use client["'];?\s*\n/;
    const useClientMatch = content.match(useClientRegex);

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
    } else if (useClientMatch) {
      // 如果有 "use client",在其前面添加注释
      const header = generateHeader(filePath, content);
      newContent = content.replace(
        useClientRegex,
        `${header}\n\n${useClientMatch[0]}`
      );
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
  console.log("  文件头注释批量添加工具");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("📂 扫描目录:", COMPONENTS_DIR);

  const files = await scanDirectory(COMPONENTS_DIR);

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
