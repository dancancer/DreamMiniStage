/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         API Icon Resolver                                  ║
 * ║                                                                            ║
 * ║  纯函数工具：根据 API 配置名称或模型名称解析对应的图标路径                     ║
 * ║  设计原则：消除特殊情况，用数据驱动替代条件分支                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              类型定义
// ============================================================================

export interface IconConfig {
  keywords: string[];
  src: string;
  alt: string;
}

export interface ResolvedIcon {
  src: string;
  alt: string;
}

// ============================================================================
//                              图标配置表
// ============================================================================

const ICON_CONFIGS: IconConfig[] = [
  { keywords: ["deepseek", "deep-seek"], src: "/api-icons/deepseek.svg", alt: "DeepSeek" },
  { keywords: ["claude", "anthropic"], src: "/api-icons/claude.svg", alt: "Claude" },
  { keywords: ["gemini", "google"], src: "/api-icons/gemini.svg", alt: "Gemini" },
  { keywords: ["gemma"], src: "/api-icons/gemma.svg", alt: "Gemma" },
  { keywords: ["ollama", "llama", "mistral", "codellama", "dolphin", "vicuna", "alpaca"], src: "/api-icons/ollama.svg", alt: "Ollama" },
  { keywords: ["qwen", "qwq", "tongyi"], src: "/api-icons/qwen.svg", alt: "Qwen" },
  { keywords: ["grok", "xai"], src: "/api-icons/grok.svg", alt: "Grok" },
  { keywords: ["kimi", "moonshot"], src: "/api-icons/kimi.svg", alt: "Kimi" },
];

const DEFAULT_ICON: ResolvedIcon = { src: "/api-icons/openai.svg", alt: "OpenAI" };

// ============================================================================
//                              核心函数
// ============================================================================

/**
 * 根据名称解析对应的 API 图标
 *
 * 设计：用 find + some 替代 switch/if-else 链
 * 时间复杂度：O(n*m)，n=配置数，m=关键词数，实际 n<10, m<10，常数级
 */
export function resolveApiIcon(name: string): ResolvedIcon {
  const lower = name.toLowerCase();
  const matched = ICON_CONFIGS.find(({ keywords }) =>
    keywords.some((keyword) => lower.includes(keyword)),
  );
  return matched ?? DEFAULT_ICON;
}

/**
 * 批量解析多个名称的图标（用于预加载场景）
 */
export function resolveApiIcons(names: string[]): Map<string, ResolvedIcon> {
  return new Map(names.map((name) => [name, resolveApiIcon(name)]));
}

/**
 * 获取所有可用的图标路径（用于预加载）
 */
export function getAllIconPaths(): string[] {
  const paths = ICON_CONFIGS.map(({ src }) => src);
  return [DEFAULT_ICON.src, ...paths];
}
