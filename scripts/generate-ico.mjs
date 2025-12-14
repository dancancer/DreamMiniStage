#!/usr/bin/env node
/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      ICO 图标生成脚本                                      ║
 * ║  将多尺寸 PNG 合并为单个 .ico 文件，支持 Retina 高清显示                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import pngToIco from "png-to-ico";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  ICO 标准尺寸：16, 32, 48, 64, 128, 256                                 │
// │  覆盖 1x/2x/3x 屏幕场景                                                 │
// └─────────────────────────────────────────────────────────────────────────┘
const sizes = [16, 32, 48, 64, 128, 256];
const pngFiles = sizes.map((s) => join(publicDir, `icon-${s}x${s}.png`));

async function main() {
  console.log("🎨 生成多尺寸 ICO 图标...");
  console.log(`   包含尺寸: ${sizes.join(", ")}px`);

  const icoBuffer = await pngToIco(pngFiles);
  const outputPath = join(publicDir, "icon.ico");

  writeFileSync(outputPath, icoBuffer);
  console.log(`✅ 已生成: ${outputPath}`);
}

main().catch((err) => {
  console.error("❌ 生成失败:", err.message);
  process.exit(1);
});
