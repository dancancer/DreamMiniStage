#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                         图标生成脚本                                          ║
║  从源 PNG 生成各尺寸图标，包括 favicon、PWA 图标、Apple Touch Icon 和 .ico    ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

from PIL import Image
import os
from pathlib import Path

# ┌──────────────────────────────────────────────────────────────────────────────┐
# │                              配置区                                          │
# └──────────────────────────────────────────────────────────────────────────────┘

SOURCE_FILE = "public/icon (1).png"
OUTPUT_DIR = "public/icons"

# 标准图标尺寸（覆盖 Web、PWA、iOS、Android 等场景）
ICON_SIZES = [
    16,    # favicon 最小尺寸
    32,    # favicon 标准
    48,    # Windows 小图标
    64,    # Windows 中图标
    72,    # Android legacy
    96,    # Android legacy
    120,   # iPhone Retina (iOS 7+)
    128,   # Chrome Web Store
    144,   # Windows 8 磁贴 / Android
    152,   # iPad Retina (iOS 7+)
    180,   # iPhone 6 Plus (iOS 8+)
    192,   # Android Chrome
    256,   # Windows 大图标
    384,   # PWA splash
    512,   # PWA / Google Play
]

# ICO 文件包含的尺寸（Windows 标准）
ICO_SIZES = [16, 32, 48, 64, 128, 256]


# ┌──────────────────────────────────────────────────────────────────────────────┐
# │                              核心逻辑                                        │
# └──────────────────────────────────────────────────────────────────────────────┘

def generate_icons():
    """生成所有尺寸的图标"""
    
    # 确保输出目录存在
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 加载源图像
    src = Image.open(SOURCE_FILE)
    print(f"✓ 源文件: {SOURCE_FILE} ({src.size[0]}x{src.size[1]})")
    
    # 转换为 RGBA 确保透明度支持
    if src.mode != "RGBA":
        src = src.convert("RGBA")
    
    generated = []
    
    # 生成各尺寸 PNG
    for size in ICON_SIZES:
        output_path = f"{OUTPUT_DIR}/icon-{size}x{size}.png"
        resized = src.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(output_path, "PNG", optimize=True)
        generated.append(output_path)
        print(f"  → {size}x{size}")
    
    # 生成 favicon.ico（多尺寸合一）
    ico_images = [
        src.resize((s, s), Image.Resampling.LANCZOS) 
        for s in ICO_SIZES
    ]
    ico_path = "public/icon.ico"
    ico_images[0].save(
        ico_path,
        format="ICO",
        sizes=[(s, s) for s in ICO_SIZES],
        append_images=ico_images[1:]
    )
    print(f"✓ ICO 文件: {ico_path} (含 {len(ICO_SIZES)} 个尺寸)")
    
    # 生成 Apple Touch Icon（180x180 是标准）
    apple_icon = src.resize((180, 180), Image.Resampling.LANCZOS)
    apple_path = f"{OUTPUT_DIR}/apple-touch-icon.png"
    apple_icon.save(apple_path, "PNG", optimize=True)
    print(f"✓ Apple Touch Icon: {apple_path}")
    
    # 生成根目录 favicon（32x32）
    favicon = src.resize((32, 32), Image.Resampling.LANCZOS)
    favicon.save("public/favicon.png", "PNG", optimize=True)
    print(f"✓ Favicon: public/favicon.png")
    
    print(f"\n✅ 完成！共生成 {len(generated) + 3} 个图标文件")


if __name__ == "__main__":
    generate_icons()
