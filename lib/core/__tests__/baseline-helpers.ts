/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         基线测试辅助工具集                                  ║
 * ║                                                                            ║
 * ║  为基线测试提供统一的资产加载、内容分析、差异对比工具。                        ║
 * ║  设计原则：                                                                 ║
 * ║  - 消除特殊情况：统一的加载接口，无需 if/else 判断资产类型                   ║
 * ║  - 函数短小：每个函数单一职责，不超过 20 行                                  ║
 * ║  - 实用主义：工具围绕真实测试场景设计，不做过度抽象                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

// ════════════════════════════════════════════════════════════════════════════
//   类型定义
// ════════════════════════════════════════════════════════════════════════════

export interface DiffItem {
  index: number;
  kind: "missing" | "mismatch";
  baseline?: Record<string, any>;
  project?: Record<string, any>;
}

export interface DiffResult {
  baselineCount: number;
  projectCount: number;
  diffs: DiffItem[];
}

export interface SummaryItem {
  role?: string;
  identifier?: string;
  hash: string;
  preview: string;
}

// ════════════════════════════════════════════════════════════════════════════
//   常量配置
// ════════════════════════════════════════════════════════════════════════════

const ASSET_DIR = path.join(process.cwd(), "test-baseline-assets");

const ASSET_PATHS = {
  "character-card": path.join(ASSET_DIR, "character-card"),
  worldbook: path.join(ASSET_DIR, "worldbook"),
  preset: path.join(ASSET_DIR, "preset"),
  regex: path.join(ASSET_DIR, "regex-scripts"),
  slash: path.join(ASSET_DIR, "slash-scripts"),
  mvu: path.join(ASSET_DIR, "mvu-examples"),
} as const;

// ════════════════════════════════════════════════════════════════════════════
//   资产加载器
// ════════════════════════════════════════════════════════════════════════════

/**
 * 统一的资产加载入口
 * 消除分支：通过路径映射表自动定位文件
 */
export function loadAsset<T>(category: keyof typeof ASSET_PATHS, filename: string): T {
  const basePath = ASSET_PATHS[category];
  const fullPath = path.join(basePath, filename);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

/**
 * 专用加载器：角色卡
 */
export function loadCharacterCard(filename: string) {
  return loadAsset("character-card", filename);
}

/**
 * 专用加载器：世界书
 */
export function loadWorldBook(filename: string) {
  return loadAsset("worldbook", filename);
}

/**
 * 专用加载器：预设
 */
export function loadPreset(filename: string) {
  return loadAsset("preset", filename);
}

// ════════════════════════════════════════════════════════════════════════════
//   内容分析工具
// ════════════════════════════════════════════════════════════════════════════

/**
 * 内容哈希：用于快速比较内容是否相同
 */
export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
}

/**
 * 内容预览：截取内容前 N 个字符，压缩空白
 */
export function preview(content: string, limit: number = 120): string {
  return content.replace(/\s+/g, " ").slice(0, limit);
}

/**
 * 内容摘要：生成包含哈希和预览的摘要对象
 */
export function summarize(data: any[]): SummaryItem[] {
  return data.map((item) => {
    const content =
      typeof item.content === "string" ? item.content : JSON.stringify(item.content);

    return {
      role: item.role,
      identifier: item.identifier,
      hash: hashContent(content),
      preview: preview(content),
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
//   差异对比工具
// ════════════════════════════════════════════════════════════════════════════

/**
 * 消息数组差异对比
 * 逐条比较 baseline 和 project 的消息，识别缺失和不匹配项
 */
export function diffMessages(baseline: any[], project: any[]): DiffResult {
  const maxLen = Math.max(baseline.length, project.length);
  const diffs: DiffItem[] = [];

  const baselineSummary = summarize(baseline);
  const projectSummary = summarize(project);

  for (let i = 0; i < maxLen; i++) {
    const b = baselineSummary[i];
    const p = projectSummary[i];

    if (!b || !p) {
      diffs.push({
        index: i,
        kind: "missing",
        baseline: b,
        project: p,
      });
      continue;
    }

    if (b.role !== p.role || b.hash !== p.hash) {
      diffs.push({
        index: i,
        kind: "mismatch",
        baseline: b,
        project: p,
      });
    }
  }

  return {
    baselineCount: baseline.length,
    projectCount: project.length,
    diffs,
  };
}

/**
 * 文本差异对比
 * 简单的字符串相等性检查 + 长度对比
 */
export function diffText(baseline: string, project: string) {
  return {
    isEqual: baseline === project,
    baselineLength: baseline.length,
    projectLength: project.length,
    baselineHash: hashContent(baseline),
    projectHash: hashContent(project),
  };
}

/**
 * 变量对象差异对比
 * 深度比较两个变量对象的键值差异
 */
export function diffVariables(baseline: Record<string, any>, project: Record<string, any>) {
  const allKeys = new Set([...Object.keys(baseline), ...Object.keys(project)]);
  const diffs: Array<{
    key: string;
    kind: "missing" | "mismatch";
    baselineValue?: any;
    projectValue?: any;
  }> = [];

  for (const key of allKeys) {
    const bVal = baseline[key];
    const pVal = project[key];

    if (bVal === undefined || pVal === undefined) {
      diffs.push({
        key,
        kind: "missing",
        baselineValue: bVal,
        projectValue: pVal,
      });
      continue;
    }

    const bStr = JSON.stringify(bVal);
    const pStr = JSON.stringify(pVal);

    if (bStr !== pStr) {
      diffs.push({
        key,
        kind: "mismatch",
        baselineValue: bVal,
        projectValue: pVal,
      });
    }
  }

  return {
    baselineKeys: Object.keys(baseline).length,
    projectKeys: Object.keys(project).length,
    diffs,
  };
}

// ════════════════════════════════════════════════════════════════════════════
//   环境准备工具
// ════════════════════════════════════════════════════════════════════════════

/**
 * 固定时间和随机数，确保测试结果可重现
 */
export function setupDeterministicEnv(vi: any) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
  vi.spyOn(Math, "random").mockReturnValue(0.25);
}

/**
 * 恢复真实环境
 */
export function teardownDeterministicEnv(vi: any) {
  vi.useRealTimers();
  vi.restoreAllMocks();
}
