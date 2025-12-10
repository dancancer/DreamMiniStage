/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                   Zustand 迁移验证脚本                                     ║
 * ║                                                                          ║
 * ║  检查是否还有遗留的 window 事件派发和监听                                   ║
 * ║  确保所有业务逻辑都已迁移到 Store                                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import * as fs from "fs";
import * as path from "path";

/* ═══════════════════════════════════════════════════════════════════════════
   配置
   ═══════════════════════════════════════════════════════════════════════════ */

const ALLOWED_EVENTS = new Set([
  "resize",           // 响应式布局
  "storage",          // 跨标签页同步
  "message",          // iframe 通信
  "DreamMiniStage:",       // 脚本系统（保留）
]);

const BUSINESS_EVENTS = [
  "modelChanged",
  "closeCharacterSidebar",
  "closeModelSidebar",
  "switchToPresetView",
  "displayUsernameChanged",
  "showLoginModal",
];

const SCAN_DIRS = ["app", "components", "hooks", "lib", "utils"];
const EXCLUDE_PATTERNS = ["node_modules", ".next", "out", "dist"];

/* ═══════════════════════════════════════════════════════════════════════════
   工具函数
   ═══════════════════════════════════════════════════════════════════════════ */

function shouldScanFile(filePath: string): boolean {
  if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) return false;
  return !EXCLUDE_PATTERNS.some((pattern) => filePath.includes(pattern));
}

function extractEventName(line: string): string | null {
  // window.dispatchEvent(new CustomEvent("eventName", ...))
  const dispatchMatch = line.match(/dispatchEvent\s*\(\s*new\s+CustomEvent\s*\(\s*["']([^"']+)["']/);
  if (dispatchMatch) return dispatchMatch[1];

  // window.addEventListener("eventName", ...)
  const listenMatch = line.match(/addEventListener\s*\(\s*["']([^"']+)["']/);
  if (listenMatch) return listenMatch[1];

  return null;
}

function isAllowedEvent(eventName: string): boolean {
  if (ALLOWED_EVENTS.has(eventName)) return true;
  if (eventName.startsWith("DreamMiniStage:")) return true;
  return false;
}

/* ═══════════════════════════════════════════════════════════════════════════
   扫描逻辑
   ═══════════════════════════════════════════════════════════════════════════ */

interface Issue {
  file: string;
  line: number;
  event: string;
  code: string;
}

function scanDirectory(dir: string): Issue[] {
  const issues: Issue[] = [];

  function scan(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDE_PATTERNS.some((p) => entry.name.includes(p))) {
          scan(fullPath);
        }
      } else if (shouldScanFile(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");

        lines.forEach((line, index) => {
          const eventName = extractEventName(line);
          if (eventName && !isAllowedEvent(eventName)) {
            issues.push({
              file: fullPath,
              line: index + 1,
              event: eventName,
              code: line.trim(),
            });
          }
        });
      }
    }
  }

  scan(dir);
  return issues;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主函数
   ═══════════════════════════════════════════════════════════════════════════ */

function main() {
  console.log("🔍 开始扫描遗留的 window 事件...\n");

  const allIssues: Issue[] = [];

  for (const dir of SCAN_DIRS) {
    if (fs.existsSync(dir)) {
      const issues = scanDirectory(dir);
      allIssues.push(...issues);
    }
  }

  if (allIssues.length === 0) {
    console.log("✅ 太棒了！没有发现遗留的业务事件。");
    console.log("✅ 所有业务逻辑已成功迁移到 Zustand Store。\n");
    console.log("📋 允许的事件类型：");
    ALLOWED_EVENTS.forEach((event) => console.log(`   - ${event}`));
    return;
  }

  console.log(`❌ 发现 ${allIssues.length} 个遗留的业务事件：\n`);

  const groupedByEvent = allIssues.reduce((acc, issue) => {
    if (!acc[issue.event]) acc[issue.event] = [];
    acc[issue.event].push(issue);
    return acc;
  }, {} as Record<string, Issue[]>);

  for (const [event, issues] of Object.entries(groupedByEvent)) {
    console.log(`📌 事件: "${event}" (${issues.length} 处)`);
    issues.forEach((issue) => {
      console.log(`   ${issue.file}:${issue.line}`);
      console.log(`   ${issue.code}\n`);
    });
  }

  console.log("💡 建议：");
  console.log("   1. 检查上述文件是否需要迁移到 Store");
  console.log("   2. 如果是合理的事件（如 resize），添加到 ALLOWED_EVENTS");
  console.log("   3. 运行 `pnpm lint` 和 `pnpm test` 确保代码正确\n");

  process.exit(1);
}

main();
