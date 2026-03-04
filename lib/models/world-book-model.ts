/**
 * @input  无外部依赖
 * @output WorldBookEntry, SecondaryKeyLogic, WorldBookSource, WorldBookEntryWithSource
 * @pos    世界书条目数据模型,支持关键词匹配、高级功能(sticky/cooldown/概率)等
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

/* ═══════════════════════════════════════════════════════════════════════════
   WorldBookEntry 扩展属性接口

   采用 Record 索引签名替代 any，精确表达"任意字符串键到未知类型值"的语义
   设计理念：未知优于 any，保持类型系统的完整性
   ═══════════════════════════════════════════════════════════════════════════ */
interface WorldBookEntryExtensions {
  position?: number;
  [key: string]: unknown;
}

/**
 * 次关键词匹配逻辑
 * - AND: 所有次关键词必须匹配
 * - OR: 至少一个次关键词匹配
 * - NOT: 所有次关键词都不匹配
 * - AND_ANY: 主关键词匹配 + 至少一个次关键词匹配 (SillyTavern 兼容)
 * - AND_ALL: 主关键词匹配 + 所有次关键词匹配 (SillyTavern 兼容)
 * - NOT_ANY: 主关键词匹配 + 没有任何次关键词匹配 (SillyTavern 兼容)
 * - NOT_ALL: 主关键词匹配 + 不是所有次关键词都匹配 (SillyTavern 兼容)
 */
export type SecondaryKeyLogic =
  | "AND"
  | "OR"
  | "NOT"
  | "AND_ANY"
  | "AND_ALL"
  | "NOT_ANY"
  | "NOT_ALL";

/**
 * World Book 条目完整定义
 * 兼容 SillyTavern 格式
 */
export interface WorldBookEntry {
  entry_id?: string;
  id?: number;
  /** 条目内容 */
  content: string;
  /** 主关键词列表 */
  keys: string[];
  /** 次关键词列表 */
  secondary_keys?: string[];
  /** 次关键词匹配逻辑 */
  selectiveLogic?: SecondaryKeyLogic;
  /** 是否启用选择性匹配 */
  selective: boolean;
  /** 是否始终激活 */
  constant: boolean;
  /** 注入位置 */
  position: string | number;
  /** 插入顺序 */
  insertion_order?: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 是否使用正则匹配 */
  use_regex?: boolean;
  /** 注入深度 (从聊天历史底部计算) */
  depth?: number;
  /** 备注 */
  comment?: string;
  /** Token 数量 */
  tokens?: number;
  /** 扩展属性 */
  extensions?: WorldBookEntryExtensions;

  /* ─────────────────────────────────────────────────────────────────────────
     高级功能 - 关键词匹配选项
     ───────────────────────────────────────────────────────────────────────── */

  /** 是否全词匹配 (单词边界检查) */
  matchWholeWords?: boolean;
  /** 是否大小写敏感 */
  caseSensitive?: boolean;
  /** 自定义扫描深度 (覆盖全局设置) */
  scanDepth?: number;

  /* ─────────────────────────────────────────────────────────────────────────
     高级功能 - 时间效果
     ───────────────────────────────────────────────────────────────────────── */

  /** Sticky: 激活后保持的轮数 */
  sticky?: number;
  /** Cooldown: 激活后冷却的轮数 */
  cooldown?: number;
  /** Delay: 匹配后延迟激活的轮数 */
  delay?: number;

  /* ─────────────────────────────────────────────────────────────────────────
     高级功能 - 概率与互斥
     ───────────────────────────────────────────────────────────────────────── */

  /** 激活概率 (0-100) */
  probability?: number;
  /** 是否启用概率判定（false 时忽略 probability） */
  useProbability?: boolean;
  /** 互斥组名称 */
  group?: string;
  /** 组内优先级 (数字越大优先级越高) */
  group_priority?: number;
  /** 组内优先级（兼容字段） */
  groupPriority?: number;
  /** 组内权重 (用于评分系统) */
  group_weight?: number;
  /** 组内权重（兼容字段） */
  groupWeight?: number;

  /* ─────────────────────────────────────────────────────────────────────────
     高级功能 - 递归激活
     ───────────────────────────────────────────────────────────────────────── */

  /** 是否阻止递归扫描此条目内容 */
  preventRecursion?: boolean;

  /* ─────────────────────────────────────────────────────────────────────────
     运行时状态 (不持久化)
     ───────────────────────────────────────────────────────────────────────── */

  /** 上次激活的轮次 */
  _lastActivatedTurn?: number;
  /** 剩余 sticky 轮数 */
  _stickyRemaining?: number;
  /** 剩余 cooldown 轮数 */
  _cooldownRemaining?: number;
  /** 延迟激活的目标轮次 */
  _delayUntilTurn?: number;
  /** 递归激活深度 (运行时) */
  _recursionDepth?: number;
}

/**
 * World Book 来源类型
 */
export type WorldBookSource = "global" | "character" | "persona" | "chat";

/**
 * 带来源的 World Book 条目
 */
export interface WorldBookEntryWithSource extends WorldBookEntry {
  source: WorldBookSource;
  sourcePriority: number;
}
