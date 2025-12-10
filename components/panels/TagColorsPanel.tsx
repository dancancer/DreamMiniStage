/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                         TagColorsPanel 标签色面板                    ║
 * ║  直接嵌入标签颜色编辑器，复用全局颜色 Store。                        ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { TagColorEditor } from "@/components/TagColorEditor";
import { useSymbolColorStore, type SymbolColor } from "@/contexts/SymbolColorStore";

export function TagColorsPanel() {
  const updateSymbolColors = useSymbolColorStore((state) => state.updateSymbolColors);

  const handleSave = async (colors: SymbolColor[]) => {
    updateSymbolColors(colors);
  };

  return (
    <div className="h-full overflow-auto">
      <TagColorEditor onSave={handleSave} />
    </div>
  );
}
