/**
 * Story Agent 卡片 gap 分析器（可复用）。
 *
 * 用我们自己的 import classifier + blueprint compiler 跑一组角色卡，报告：
 *  - 已支持的 RenderIntent（render rules）
 *  - 落入 unsupported 的 UI regex（含 widget 结构分类）→ RenderIntent 白名单广度目标
 *  - 变量约定 extension（supported / unsupported）→ Variable Convention 拓宽目标
 *  - 导入诊断码分布
 *
 * 用法：pnpm exec tsx scripts/analyze-card-gaps.ts [cardDir]
 * 默认 cardDir = /Users/xupeng/Desktop/card；后续有新卡放进该目录即可重跑。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import extract from "png-chunks-extract";
import PNGtext from "png-chunk-text";
import { createImportedAssetBundle, diagnoseImportedAssetBundle } from "@/lib/adapters/import";
import { classifyRegexScript } from "@/lib/story-agent/render-intent/classifier";
import { compileSessionBlueprint } from "@/lib/story-agent/blueprint";
import { diagnoseInitialStateSources } from "@/lib/story-agent/blueprint/initial-state";

const DEFAULT_DIR = "/Users/xupeng/Desktop/card";

function readPngCard(path: string): unknown {
  const chunks = extract(new Uint8Array(readFileSync(path)));
  const text = chunks
    .filter((c) => c.name === "tEXt")
    .map((c) => PNGtext.decode(c.data));
  const meta =
    text.find((c) => c.keyword.toLowerCase() === "ccv3") ??
    text.find((c) => c.keyword.toLowerCase() === "chara");
  if (!meta) throw new Error("no character metadata");
  return JSON.parse(Buffer.from(meta.text, "base64").toString("utf8"));
}

function widgetKinds(html: string): string[] {
  const t = html.toLowerCase();
  const kinds: string[] = [];
  if (/<table/.test(t)) kinds.push("table");
  if (/<img|<audio|<video|<source/.test(t)) kinds.push("media/player");
  if (/<canvas|<svg/.test(t)) kinds.push("canvas/svg");
  if (/<details|<summary/.test(t)) kinds.push("collapsible");
  if (/status-panel|<sfw>|dashboard|状态栏/.test(t)) kinds.push("status-panel");
  if (/<button|choice|选项/.test(t)) kinds.push("action/choice");
  if (/<input|<select|<textarea/.test(t)) kinds.push("form");
  if (/@keyframes|animation:|transition:/.test(t)) kinds.push("animation/css");
  if (/grid|map|地图|网格/.test(t)) kinds.push("map/grid");
  if (/<style|<!doctype|<html/.test(t)) kinds.push("full-html-doc");
  return kinds.length ? kinds : ["other-html"];
}

function tally(items: string[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, k) => {
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

function analyzeCard(path: string, name: string): void {
  console.log(`\n${"=".repeat(70)}\n卡片: ${name}\n${"=".repeat(70)}`);
  let raw: unknown;
  try {
    raw = readPngCard(path);
  } catch (error) {
    console.log(`  [跳过] 无法读取嵌入数据: ${(error as Error).message}`);
    return;
  }

  let bundle;
  let blueprint;
  try {
    bundle = createImportedAssetBundle({
      bundleId: `bundle:${name}`,
      sourceHash: name,
      createdAt: "2026-06-10T00:00:00.000Z",
      characterId: `card:${name}`,
      character: {
        raw,
        source: { sourcePath: path, sourceKind: "manual", detectedFormat: "png-character", sourceHash: name },
      },
    });
    blueprint = compileSessionBlueprint(bundle, { createdAt: "2026-06-10T00:00:00.000Z" });
  } catch (error) {
    console.log(`  [跳过] 编译失败: ${(error as Error).message}`);
    return;
  }

  // regex 分类
  const classifications = bundle.regexScripts.map((r) => classifyRegexScript(r.raw));
  const unsupportedUi = bundle.regexScripts
    .map((r, i) => ({ script: r.raw, cls: classifications[i]! }))
    .filter(({ cls }) => cls.kind === "unsupported" && /<[a-z]/i.test(cls.reasons.join(" ") + (cls.unsupportedReason ?? "") || ""));
  console.log(`  regex 脚本: ${bundle.regexScripts.length} | 分类: ${JSON.stringify(tally(classifications.map((c) => c.kind)))}`);
  console.log(`  支持的 render rules: ${blueprint.renderRules.length} (${JSON.stringify(tally(blueprint.renderRules.map((r) => r.kind)))})`);

  const uiUnsupported = bundle.regexScripts
    .map((r, i) => ({ name: r.raw.scriptName, html: (r.raw.replaceString ?? ""), cls: classifications[i]! }))
    .filter(({ cls, html }) => cls.kind === "unsupported" && /<[a-z]/i.test(html));
  if (uiUnsupported.length) {
    console.log(`  ⚠ unsupported UI regex (${uiUnsupported.length}) —— RenderIntent 广度目标:`);
    for (const u of uiUnsupported) {
      console.log(`     · "${u.name}" → widget=${JSON.stringify(widgetKinds(u.html))} reason="${u.cls.unsupportedReason ?? u.cls.reasons.join(",")}"`);
    }
  }

  // 变量约定 / extension
  const exts = bundle.extensionArtifacts;
  if (exts.length) {
    console.log(`  扩展产物 (${exts.length}):`);
    for (const e of exts) {
      const flag = e.supported ? "✓supported" : "✗unsupported";
      console.log(`     · ${e.extensionKey} [${e.kind}] ${flag}`);
    }
  }

  // 初始状态 + 诊断
  console.log(`  初始变量: ${Object.keys(blueprint.initialState.variables).length} 个; errors=${blueprint.initialState.errors.length}`);
  const diagnostics = [...diagnoseImportedAssetBundle(bundle), ...diagnoseInitialStateSources(bundle), ...blueprint.diagnostics];
  console.log(`  诊断码分布: ${JSON.stringify(tally(diagnostics.map((d) => d.code)))}`);
}

function main(): void {
  const dir = process.argv[2] ?? DEFAULT_DIR;
  const pngs = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".png")).sort();
  console.log(`分析目录: ${dir} (${pngs.length} 张卡)`);
  for (const png of pngs) {
    analyzeCard(join(dir, png), png);
  }
}

main();
