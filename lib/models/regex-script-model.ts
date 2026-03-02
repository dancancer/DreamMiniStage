/**
 * @input  无外部依赖
 * @output RegexScript, RegexPlacement, SubstituteRegexMode, ScriptSource, RegexAllowList, RegexPresetConfig
 * @pos    正则脚本数据模型,定义脚本结构、执行位置、授权控制等
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

/* ═══════════════════════════════════════════════════════════════════════════
   枚举定义 - Placement、SubstituteRegex、ScriptSource
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 脚本作用位置枚举
 * 决定脚本在哪个处理阶段执行
 */
export enum RegexPlacement {
  USER_INPUT = 1,      // 用户输入
  AI_OUTPUT = 2,       // AI 输出
  SLASH_COMMAND = 3,   // 斜杠命令
  WORLD_INFO = 5,      // 世界书内容
  REASONING = 6,       // AI 推理块
}

/**
 * 宏替换模式枚举
 * 决定是否对 findRegex 进行宏替换及转义
 */
export enum SubstituteRegexMode {
  NONE = 0,     // 不替换
  RAW = 1,      // 原始替换（不转义）
  ESCAPED = 2,  // 转义替换（特殊字符转义）
}

/**
 * 脚本来源类型枚举
 * 标识脚本来自哪个层级
 */
export enum ScriptSource {
  GLOBAL = "global",
  CHARACTER = "character",
  PRESET = "preset",
}

/* ═══════════════════════════════════════════════════════════════════════════
   数据模型 - RegexScript 接口
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 正则脚本数据结构
 * 与 SillyTavern 完全兼容的正则脚本模型
 */
export interface RegexScript {
  /* ─────────────────────────────────────────────────────────────────────────
     基础字段
     ───────────────────────────────────────────────────────────────────────── */
  
  /** 脚本唯一标识符 */
  id?: string;
  
  /** 脚本索引键 */
  scriptKey: string;
  
  /** 脚本名称 */
  scriptName: string;
  
  /** 匹配正则表达式 */
  findRegex: string;
  
  /** 替换字符串模板 */
  replaceString?: string | null;
  
  /* ─────────────────────────────────────────────────────────────────────────
     配置字段
     ───────────────────────────────────────────────────────────────────────── */
  
  /** 匹配结果裁剪规则数组 */
  trimStrings: string[];
  
  /** 脚本作用位置数组（支持多位置） */
  placement: number[];
  
  /** 是否禁用此脚本 */
  disabled?: boolean;
  
  /* ─────────────────────────────────────────────────────────────────────────
     SillyTavern 兼容字段
     ───────────────────────────────────────────────────────────────────────── */
  
  /** 正则参数替换模式 */
  substituteRegex?: SubstituteRegexMode;
  
  /** 仅在 Markdown 渲染时应用 */
  markdownOnly?: boolean;
  
  /** 仅在发送给 LLM 的提示词时应用 */
  promptOnly?: boolean;
  
  /** 是否在编辑时运行 */
  runOnEdit?: boolean;
  
  /** 最小深度约束（消息深度） */
  minDepth?: number;
  
  /** 最大深度约束（消息深度） */
  maxDepth?: number;
  
  /* ─────────────────────────────────────────────────────────────────────────
     来源元数据
     ───────────────────────────────────────────────────────────────────────── */
  
  /** 脚本来源类型 */
  source?: ScriptSource;
  
  /** 来源标识符（角色 ID 或预设名称） */
  sourceId?: string;
  
  /* ─────────────────────────────────────────────────────────────────────────
     扩展元数据
     ───────────────────────────────────────────────────────────────────────── */
  
  /** 扩展元数据 */
  extensions?: {
    /** 是否为导入的脚本 */
    imported?: boolean;
    /** 导入时间戳 */
    importedAt?: number;
    /** 是否来自全局源 */
    globalSource?: boolean;
    /** 全局源标识符 */
    globalSourceId?: string;
    /** 全局源名称 */
    globalSourceName?: string;
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   注意：RegexScriptOwnerType 枚举已删除
   使用 ScriptSource 类型替代
   参见 lib/data/roleplay/regex-script-operation.ts
   ═══════════════════════════════════════════════════════════════════════════ */

export interface RegexReplacementResult {
  originalText: string;
  replacedText: string;
  appliedScripts: string[];
  success: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   正则脚本配置

   metadata 字段：额外的配置元数据
   - 使用 unknown 而非 any：防止类型污染
   - 设计理念：配置对象应该是类型安全的，即使扩展也需显式处理
   ═══════════════════════════════════════════════════════════════════════════ */
export interface RegexScriptSettings {
  enabled: boolean;
  applyToPrompt: boolean;
  applyToResponse: boolean;
  metadata?: unknown;
}

/* ═══════════════════════════════════════════════════════════════════════════
   授权控制接口
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 正则脚本授权列表
 * 
 * 控制哪些角色和预设的脚本可以参与合并执行
 * 设计理念：白名单机制，默认拒绝，显式允许
 */
export interface RegexAllowList {
  /** 允许的角色 ID 列表 */
  characters: string[];
  
  /** 按 API 类型分组的预设允许列表 */
  presets: Record<string, string[]>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   正则预设接口
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 正则预设配置
 * 
 * 保存一组脚本的启用/禁用状态快照，用于快速切换配置
 * 设计理念：预设是状态的快照，不是脚本的副本
 */
export interface RegexPresetConfig {
  /** 预设名称（唯一标识符） */
  name: string;
  
  /** 预设描述 */
  description?: string;
  
  /** 创建时间戳 */
  createdAt: number;
  
  /** 最后更新时间戳 */
  updatedAt: number;
  
  /** 脚本状态映射：scriptKey -> enabled */
  scriptStates: Record<string, boolean>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   数据规范化函数
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   规范化正则脚本数据

   设计目标：
   - 填充缺失字段的默认值
   - 限定关键字段到当前支持格式
   - 消除运行时分支和异常输入扩散

   参数类型使用 unknown：
   - 因为输入可能来自用户上传、API 响应等不可控源
   - 内部通过 as 断言安全访问属性
   - 设计理念：边界处用 unknown，内部逻辑通过明确断言保证类型正确性

   @param script - 原始脚本数据（可能是非法格式）
   @returns 规范化后的脚本数据
   ═══════════════════════════════════════════════════════════════════════════ */
export function normalizeRegexScript(script: unknown): RegexScript {
  /* ─────────────────────────────────────────────────────────────────────────
     安全类型断言：将 unknown 转为可索引对象
     这里我们明确知道输入应该是对象，但不能保证其结构
     ───────────────────────────────────────────────────────────────────────── */
  const raw = script as Record<string, unknown>;

  /* ─────────────────────────────────────────────────────────────────────────
     第一步：placement 规范化
     仅接受数组格式，缺失或非法时使用默认值
     ───────────────────────────────────────────────────────────────────────── */

  const placement = Array.isArray(raw.placement)
    ? raw.placement
    : [RegexPlacement.AI_OUTPUT]; // 默认作用于 AI 输出
  
  /* ─────────────────────────────────────────────────────────────────────────
     第二步：substituteRegex 规范化
     仅接受当前枚举值，缺失或非法时降级为 NONE
     ───────────────────────────────────────────────────────────────────────── */

  let substituteRegex: SubstituteRegexMode;

  if (
    typeof raw.substituteRegex === "number" &&
    (raw.substituteRegex === SubstituteRegexMode.NONE ||
      raw.substituteRegex === SubstituteRegexMode.RAW ||
      raw.substituteRegex === SubstituteRegexMode.ESCAPED)
  ) {
    substituteRegex = raw.substituteRegex;
  } else {
    substituteRegex = SubstituteRegexMode.NONE;
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     第三步：构建规范化对象
     所有字段都有明确的值，消除 undefined 的特殊情况
     ───────────────────────────────────────────────────────────────────────── */

  return {
    // 基础字段
    id: raw.id as string | undefined,
    scriptKey: raw.scriptKey as string,
    scriptName: raw.scriptName as string,
    findRegex: raw.findRegex as string,
    replaceString: (raw.replaceString as string | null | undefined) ?? null,

    // 配置字段
    trimStrings: (raw.trimStrings as string[] | undefined) ?? [],
    placement,
    disabled: (raw.disabled as boolean | undefined) ?? false,

    // SillyTavern 兼容字段
    substituteRegex,
    markdownOnly: (raw.markdownOnly as boolean | undefined) ?? false,
    promptOnly: (raw.promptOnly as boolean | undefined) ?? false,
    runOnEdit: (raw.runOnEdit as boolean | undefined) ?? false,
    minDepth: raw.minDepth as number | undefined,
    maxDepth: raw.maxDepth as number | undefined,

    // 来源元数据
    source: raw.source as ScriptSource | undefined,
    sourceId: raw.sourceId as string | undefined,

    // 扩展元数据
    extensions: raw.extensions as RegexScript["extensions"] | undefined,
  };
}
