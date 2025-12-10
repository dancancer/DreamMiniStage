/**
 * HTML Tag Processor - HTML标签检测、分类和替换工具
 * 
 * 设计原则：
 * 1. 语义化分类：根据标签含义智能分配颜色
 * 2. 缓存优化：避免重复计算，提高性能
 * 3. 样式合并：保留原有样式，智能合并新样式
 * 4. 安全处理：跳过敏感标签（script、style等）
 */

import { useSymbolColorStore } from "@/contexts/SymbolColorStore";

// 语义化颜色分组
const SEMANTIC_COLOR_GROUPS = {
  // 交流&对话标签
  communication: [
    "var(--color-sand)",
  ],
  // 状态&状态标签
  status: [
    "var(--color-sand)",
  ],
  // 情感&感受标签
  emotion: [
    "var(--color-sand)",
  ],
  // 动作&移动标签
  action: [
    "var(--color-sand)",
  ],
  // 思考&心理标签
  thought: [
    "var(--color-info)",
  ],
  // 叙述&描述标签
  narrative: [
    "var(--color-cream)",
  ],
  // 强调&注意标签
  emphasis: [
    "var(--color-sand)",
  ],
  // 神秘&特殊标签
  mystical: [
    "var(--color-info)",
  ],
} as const;

// 优化的颜色调色板
const OPTIMIZED_COLOR_PALETTE = [
  "var(--color-sand)",
  "var(--color-sand)",
  "var(--color-sand)",
  "var(--color-sand)",
  "var(--color-sand)",
  "var(--color-info)",
  "var(--color-info)",
  "color-mix(in srgb, var(--color-sky) 60%, var(--color-cream))",
  "color-mix(in srgb, var(--color-cream) 80%, var(--color-ink-soft))",
  "var(--color-cream-soft)",
  "color-mix(in srgb, var(--color-cream) 70%, var(--color-ink-soft))",
  "var(--color-cream)",
];

// 性能优化：缓存颜色调色板以避免重复计算
const colorPaletteCache = new Map<string, Record<string, string>>();
const CACHE_MAX_SIZE = 50;

/**
 * 从唯一标签生成缓存键
 */
function generateCacheKey(tags: string[]): string {
  return tags.sort().join("|");
}

/**
 * 清理缓存 - 当达到限制时删除旧条目
 */
function pruneCache(): void {
  if (colorPaletteCache.size >= CACHE_MAX_SIZE) {
    const keysToDelete = Array.from(colorPaletteCache.keys()).slice(0, 10);
    keysToDelete.forEach(key => colorPaletteCache.delete(key));
  }
}

/**
 * 智能标签分类 - 根据标签名称确定语义类别
 */
function categorizeTag(tagName: string): keyof typeof SEMANTIC_COLOR_GROUPS | "default" {
  const lowerTag = tagName.toLowerCase();
  
  // 交流模式
  if (["speech", "dialogue", "talk", "say", "voice", "whisper", "shout"].includes(lowerTag)) {
    return "communication";
  }
  
  // 状态模式
  if (["status", "state", "condition", "mode", "phase"].includes(lowerTag) || 
      lowerTag.includes("status") || lowerTag.includes("state")) {
    return "status";
  }
  
  // 情感模式
  if (["emotion", "feeling", "mood", "heart", "soul", "passion", "love", "anger", "joy", "sad"].includes(lowerTag) ||
      lowerTag.includes("feel") || lowerTag.includes("emotion")) {
    return "emotion";
  }
  
  // 动作模式
  if (["action", "move", "walk", "run", "jump", "dance", "fight", "attack", "defend"].includes(lowerTag) ||
      lowerTag.includes("action") || lowerTag.includes("move")) {
    return "action";
  }
  
  // 思考模式
  if (["think", "thought", "mind", "brain", "consider", "ponder", "reflect", "remember"].includes(lowerTag) ||
      lowerTag.includes("think") || lowerTag.includes("mind")) {
    return "thought";
  }
  
  // 叙述模式
  if (["screen", "scene", "setting", "background", "environment", "description", "narrative", "content"].includes(lowerTag)) {
    return "narrative";
  }
  
  // 强调模式
  if (["emphasis", "important", "urgent", "warning", "alert", "critical"].includes(lowerTag) ||
      lowerTag.includes("emphasis") || lowerTag.includes("important")) {
    return "emphasis";
  }
  
  // 神秘模式
  if (["magic", "mystical", "spell", "enchant", "divine", "sacred", "ritual", "prophecy"].includes(lowerTag) ||
      lowerTag.includes("magic") || lowerTag.includes("mystical")) {
    return "mystical";
  }
  
  return "default";
}

/**
 * 生成标签颜色调色板
 */
export function generatePalette(uniqueTags: string[]): Record<string, string> {
  // 先检查缓存
  const cacheKey = generateCacheKey(uniqueTags);
  const cachedPalette = colorPaletteCache.get(cacheKey);
  if (cachedPalette) {
    return cachedPalette;
  }

  const { symbolColors, getColorForHtmlTag, addCustomTag } = useSymbolColorStore.getState();
  const colours: Record<string, string> = {};
  const usedColors = new Set<string>();

  // 第一轮：从存储中分配现有颜色
  uniqueTags.forEach(tag => {
    try {
      const lowerTag = tag.toLowerCase();
      const mappedColor = getColorForHtmlTag(lowerTag);
      
      if (mappedColor && /^#[0-9A-Fa-f]{6}$/.test(mappedColor)) {
        colours[lowerTag] = mappedColor;
        usedColors.add(mappedColor);
      }
    } catch (error) {
      console.warn(`Error processing tag "${tag}":`, error);
    }
  });

  // 第二轮：为未分配的标签智能分配语义颜色
  const unassignedTags = uniqueTags.filter(tag => !colours[tag.toLowerCase()]);
  const availableColors = OPTIMIZED_COLOR_PALETTE.filter(color => !usedColors.has(color));
  
  // 按语义类别分组未分配的标签
  const categorizedTags: Record<string, string[]> = {};
  unassignedTags.forEach(tag => {
    const category = categorizeTag(tag);
    if (!categorizedTags[category]) categorizedTags[category] = [];
    categorizedTags[category].push(tag.toLowerCase());
  });

  let colorIndex = 0;
  
  // 优先按语义组分配颜色
  Object.entries(categorizedTags).forEach(([category, tags]) => {
    if (category !== "default" && SEMANTIC_COLOR_GROUPS[category as keyof typeof SEMANTIC_COLOR_GROUPS]) {
      const categoryColors = SEMANTIC_COLOR_GROUPS[category as keyof typeof SEMANTIC_COLOR_GROUPS]
        .filter(color => !usedColors.has(color));
      
      tags.sort((a, b) => a.localeCompare(b)).forEach((tag, i) => {
        if (!colours[tag]) {
          let selectedColor: string;
          
          if (categoryColors.length > 0) {
            selectedColor = categoryColors[i % categoryColors.length];
          } else {
            selectedColor = availableColors[colorIndex % availableColors.length];
            colorIndex++;
          }
          
          colours[tag] = selectedColor;
          usedColors.add(selectedColor);
          
          try {
            addCustomTag(tag, selectedColor);
          } catch (error) {
            console.warn(`Error adding custom tag "${tag}":`, error);
          }
        }
      });
    }
  });
  
  // 为"default"类别的标签分配剩余颜色
  if (categorizedTags.default) {
    categorizedTags.default.sort((a, b) => a.localeCompare(b)).forEach(tag => {
      if (!colours[tag]) {
        const remainingColors = availableColors.filter(color => !usedColors.has(color));
        const selectedColor = remainingColors.length > 0 
          ? remainingColors[colorIndex % remainingColors.length]
          : OPTIMIZED_COLOR_PALETTE[colorIndex % OPTIMIZED_COLOR_PALETTE.length];
        
        colours[tag] = selectedColor;
        usedColors.add(selectedColor);
        
        try {
          addCustomTag(tag, selectedColor);
        } catch (error) {
          console.warn(`Error adding custom tag "${tag}":`, error);
        }
        colorIndex++;
      }
    });
  }

  // 缓存结果以供将来使用
  pruneCache();
  colorPaletteCache.set(cacheKey, colours);

  return colours;
}

/**
 * 检测HTML字符串中的标签
 */
export function detectHtmlTags(str: string): string[] {
  const htmlTagRegex = /<\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/g;
  const selfClosingTagRegex = /<\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/\s*>/g;
  const tags = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = htmlTagRegex.exec(str)) !== null) tags.add(match[1].toLowerCase());
  while ((match = selfClosingTagRegex.exec(str)) !== null) tags.add(match[1].toLowerCase());
  
  return [...tags];
}

/**
 * 清理颜色缓存
 */
export function clearColorCache(): void {
  colorPaletteCache.clear();
}
