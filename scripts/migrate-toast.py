#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════╗
║                     Toast Migration Script                               ║
║                                                                          ║
║  批量迁移所有组件从旧的 Toast 系统到 Sonner + Zustand                     ║
║  遵循 Linus 哲学：用工具消除重复劳动                                       ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

import re
import os
from pathlib import Path

# ═══════════════════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════════════════

WORKSPACE_ROOT = Path(__file__).parent.parent
COMPONENTS_DIR = WORKSPACE_ROOT / "components"
APP_DIR = WORKSPACE_ROOT / "app"

# ═══════════════════════════════════════════════════════════════════════════
# 替换规则
# ═══════════════════════════════════════════════════════════════════════════

REPLACEMENTS = [
    # 移除旧的 Toast 组件导入
    (r'import\s+\{\s*Toast\s*\}\s+from\s+["\']@/components/Toast["\'];?\n?', ''),
    
    # 移除 useErrorToast 导入
    (r'import\s+\{\s*useErrorToast\s*\}\s+from\s+["\']@/hooks/useErrorToast["\'];?\n?', ''),
    
    # 替换 useErrorToast 调用
    (r'const\s+\{\s*toast:\s*errorToast,\s*showToast:\s*showErrorToast,\s*hideToast(?::\s*\w+)?\s*\}\s*=\s*useErrorToast\([^)]*\);?\n?', ''),
    
    # 替换 showErrorToast 调用为 toast.error
    (r'showErrorToast\(', 'toast.error('),
    
    # 移除 errorToast 状态定义
    (r'const\s+\[errorToast,\s*setErrorToast\]\s*=\s*useState\s*\(\s*\{[^}]*\}\s*\);?\n?', ''),
    
    # 移除 showErrorToast 函数定义
    (r'const\s+showErrorToast\s*=\s*useCallback\(\s*\([^)]*\)\s*=>\s*\{[^}]*setErrorToast[^}]*\},\s*\[[^\]]*\]\s*\);?\n?', ''),
    
    # 移除 hideErrorToast 函数定义  
    (r'const\s+hideErrorToast\s*=\s*useCallback\(\s*\([^)]*\)\s*=>\s*\{[^}]*setErrorToast[^}]*\},\s*\[[^\]]*\]\s*\);?\n?', ''),
]

# 移除 Toast 组件的 JSX
TOAST_JSX_PATTERNS = [
    r'\{errorToast\.isVisible\s*&&\s*\(\s*<(?:ErrorToast|Toast)[^>]*>[^<]*</(?:ErrorToast|Toast)>\s*\)\}',
    r'<(?:ErrorToast|Toast)\s+[^>]*isVisible=\{errorToast\.isVisible\}[^>]*/?>',
]

# ═══════════════════════════════════════════════════════════════════════════
# 工具函数
# ═══════════════════════════════════════════════════════════════════════════

def should_process_file(filepath: Path) -> bool:
    """判断文件是否需要处理"""
    if not filepath.suffix in ['.ts', '.tsx']:
        return False
    if 'node_modules' in str(filepath):
        return False
    if 'Toast.tsx' in str(filepath):
        return False
    if 'toast-store.ts' in str(filepath):
        return False
    return True

def add_toast_import_if_needed(content: str) -> str:
    """如果文件使用了 toast 但没有导入，添加导入"""
    if 'toast.' in content or 'toast(' in content:
        if 'from "@/lib/store/toast-store"' not in content:
            # 找到第一个 import 语句的位置
            import_match = re.search(r'^import\s+', content, re.MULTILINE)
            if import_match:
                insert_pos = import_match.start()
                import_stmt = 'import { toast } from "@/lib/store/toast-store";\n'
                content = content[:insert_pos] + import_stmt + content[insert_pos:]
    return content

def remove_toast_jsx(content: str) -> str:
    """移除 Toast 组件的 JSX"""
    for pattern in TOAST_JSX_PATTERNS:
        content = re.sub(pattern, '', content, flags=re.DOTALL)
    return content

def clean_empty_lines(content: str) -> str:
    """清理多余的空行"""
    # 将连续的空行替换为最多两个空行
    content = re.sub(r'\n{4,}', '\n\n\n', content)
    return content

def process_file(filepath: Path) -> bool:
    """处理单个文件"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # 应用所有替换规则
        for pattern, replacement in REPLACEMENTS:
            content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
        
        # 移除 Toast JSX
        content = remove_toast_jsx(content)
        
        # 添加 toast 导入（如果需要）
        content = add_toast_import_if_needed(content)
        
        # 清理空行
        content = clean_empty_lines(content)
        
        # 如果内容有变化，写回文件
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        
        return False
    except Exception as e:
        print(f"❌ Error processing {filepath}: {e}")
        return False

# ═══════════════════════════════════════════════════════════════════════════
# 主函数
# ═══════════════════════════════════════════════════════════════════════════

def main():
    print("🚀 Starting Toast migration...")
    print(f"📁 Workspace: {WORKSPACE_ROOT}")
    
    modified_files = []
    
    # 处理 components 目录
    for filepath in COMPONENTS_DIR.rglob('*.tsx'):
        if should_process_file(filepath):
            if process_file(filepath):
                modified_files.append(filepath)
                print(f"✅ Modified: {filepath.relative_to(WORKSPACE_ROOT)}")
    
    # 处理 app 目录
    for filepath in APP_DIR.rglob('*.tsx'):
        if should_process_file(filepath):
            if process_file(filepath):
                modified_files.append(filepath)
                print(f"✅ Modified: {filepath.relative_to(WORKSPACE_ROOT)}")
    
    print(f"\n🎉 Migration complete!")
    print(f"📊 Modified {len(modified_files)} files")
    
    if modified_files:
        print("\n📝 Modified files:")
        for filepath in modified_files:
            print(f"  - {filepath.relative_to(WORKSPACE_ROOT)}")

if __name__ == "__main__":
    main()
