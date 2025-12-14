/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                           Persona 数据模型                                 ║
 * ║                                                                            ║
 * ║  定义用户身份（Persona）的核心数据结构                                        ║
 * ║  支持多 Persona 管理、描述注入位置配置、角色连接等功能                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

/* ═══════════════════════════════════════════════════════════════════════════
   描述注入位置枚举
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Persona 描述的注入位置
 *
 * 与 SillyTavern 保持兼容的枚举值：
 * - IN_PROMPT: 通过 {{persona}} 宏注入
 * - TOP_AN: Author's Note 上方
 * - BOTTOM_AN: Author's Note 下方
 * - AT_DEPTH: 在指定深度注入到对话历史
 * - NONE: 不注入
 */
export enum PersonaDescriptionPosition {
  /** 通过 {{persona}} 宏注入到 story string */
  IN_PROMPT = 0,
  /** Author's Note 上方 */
  TOP_AN = 2,
  /** Author's Note 下方 */
  BOTTOM_AN = 3,
  /** 在指定深度注入到对话历史 */
  AT_DEPTH = 4,
  /** 不注入 */
  NONE = 9,
}

/* ═══════════════════════════════════════════════════════════════════════════
   Persona 核心数据结构
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Persona 用户身份
 *
 * 代表用户在对话中使用的身份，包含：
 * - 基本信息：名称、头像、描述
 * - 注入配置：位置、深度、角色
 * - 元数据：创建/更新时间
 */
export interface Persona {
  /** UUID 唯一标识 */
  id: string;
  /** 显示名称（替换 {{user}} 宏） */
  name: string;
  /** 头像路径（相对路径或 data URL） */
  avatarPath: string;
  /** 人物描述（用于 {{persona}} 宏或直接注入） */
  description: string;
  /** 描述注入位置 */
  position: PersonaDescriptionPosition;
  /** AT_DEPTH 时的深度值（从对话底部计算） */
  depth: number;
  /** 注入时的消息角色 */
  role: "system" | "user";
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Persona 连接关系
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Persona 与 Character 的连接关系
 *
 * 当用户打开某个角色的对话时，
 * 系统会根据此连接自动选择对应的 Persona
 */
export interface PersonaConnection {
  /** Persona ID */
  personaId: string;
  /** 角色 ID */
  characterId: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Chat 级别锁定
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Chat 级别的 Persona 锁定信息
 *
 * Chat 锁定具有最高优先级，
 * 即使角色有默认连接的 Persona，Chat 锁定也会覆盖它
 */
export interface ChatPersonaLock {
  /** 对话 Key（sessionId 或 characterId） */
  dialogueKey: string;
  /** 锁定的 Persona ID */
  lockedPersonaId: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   锁定类型
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Persona 锁定类型
 *
 * 优先级从高到低：
 * 1. chat - 对话级别锁定（最高）
 * 2. character - 角色级别连接
 * 3. default - 全局默认
 * 4. none - 无锁定
 */
export type PersonaLockType = "chat" | "character" | "default" | "none";

/* ═══════════════════════════════════════════════════════════════════════════
   解析结果
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Persona 解析结果
 *
 * 包含解析出的 Persona ID 及其锁定类型
 */
export interface PersonaResolution {
  /** 解析出的 Persona ID（可能为 null） */
  personaId: string | null;
  /** 锁定类型 */
  lockType: PersonaLockType;
}

/* ═══════════════════════════════════════════════════════════════════════════
   工厂函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 创建新 Persona 的默认值
 */
export function createDefaultPersona(overrides: Partial<Persona> = {}): Persona {
  const now = new Date().toISOString();
  return {
    id: "",
    name: "",
    avatarPath: "",
    description: "",
    position: PersonaDescriptionPosition.IN_PROMPT,
    depth: 4,
    role: "system",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * 获取注入位置的显示名称
 */
export function getPositionLabel(position: PersonaDescriptionPosition): string {
  const labels: Record<PersonaDescriptionPosition, string> = {
    [PersonaDescriptionPosition.IN_PROMPT]: "In Prompt ({{persona}})",
    [PersonaDescriptionPosition.TOP_AN]: "Above Author's Note",
    [PersonaDescriptionPosition.BOTTOM_AN]: "Below Author's Note",
    [PersonaDescriptionPosition.AT_DEPTH]: "At Depth",
    [PersonaDescriptionPosition.NONE]: "Don't Inject",
  };
  return labels[position] ?? "Unknown";
}

/**
 * 获取注入位置的中文显示名称
 */
export function getPositionLabelZh(position: PersonaDescriptionPosition): string {
  const labels: Record<PersonaDescriptionPosition, string> = {
    [PersonaDescriptionPosition.IN_PROMPT]: "提示词内 ({{persona}})",
    [PersonaDescriptionPosition.TOP_AN]: "作者注释上方",
    [PersonaDescriptionPosition.BOTTOM_AN]: "作者注释下方",
    [PersonaDescriptionPosition.AT_DEPTH]: "指定深度",
    [PersonaDescriptionPosition.NONE]: "不注入",
  };
  return labels[position] ?? "未知";
}
