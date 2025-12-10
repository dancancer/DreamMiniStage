/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        Session Type Definitions                           ║
 * ║  会话管理相关类型：Session 实体、带角色信息的扩展类型                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

/**
 * 会话实体 - 用户与角色卡之间的独立对话实例
 * 
 * 设计要点：
 * - id 为 UUID，确保全局唯一
 * - characterId 关联角色卡，支持同一角色多会话
 * - name 支持用户自定义，默认格式为 "{CharacterName} - {Timestamp}"
 */
export interface Session {
  id: string;
  characterId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 带角色信息的会话 - 用于 UI 展示
 * 
 * 扩展 Session，附加角色名称和头像路径，
 * 避免 UI 层重复查询角色信息
 */
export interface SessionWithCharacter extends Session {
  characterName: string;
  characterAvatar: string;
}

/**
 * 会话序列化/反序列化辅助函数
 */
export function serializeSession(session: Session): string {
  return JSON.stringify(session);
}

export function deserializeSession(json: string): Session {
  return JSON.parse(json) as Session;
}

/**
 * 生成默认会话名称
 */
export function generateDefaultSessionName(characterName: string): string {
  const timestamp = new Date().toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${characterName} - ${timestamp}`;
}

/**
 * 校验会话名称是否有效（非空白字符串）
 */
export function isValidSessionName(name: string): boolean {
  return name.trim().length > 0;
}
