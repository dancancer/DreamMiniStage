/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        Session Operations                                 ║
 * ║  会话 CRUD 操作：创建、查询、更新、删除                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import {
  SESSIONS_RECORD_FILE,
  deleteRecord,
  getAllRecords,
  getRecordByKey,
  putRecord,
} from "@/lib/data/local-storage";
import { Session, isValidSessionName } from "@/types/session";
import { v4 as uuidv4 } from "uuid";

export class SessionOperations {
  /**
   * 创建新会话
   * 
   * @param characterId - 关联的角色卡 ID
   * @param name - 会话名称（已校验非空）
   * @returns 新创建的 Session 对象
   */
  static async createSession(characterId: string, name: string): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      id: uuidv4(),
      characterId,
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
    };

    await putRecord(SESSIONS_RECORD_FILE, session.id, session);
    return session;
  }

  /**
   * 获取所有会话，按更新时间降序排列
   */
  static async getAllSessions(): Promise<Session[]> {
    const records = await getAllRecords<Session>(SESSIONS_RECORD_FILE);
    return records
      .filter(record => Boolean(record?.id))
      .sort((a, b) => {
        const timeA = new Date(a.updatedAt).getTime();
        const timeB = new Date(b.updatedAt).getTime();
        return timeB - timeA;
      });
  }

  /**
   * 根据 ID 获取单个会话
   */
  static async getSessionById(sessionId: string): Promise<Session | null> {
    return await getRecordByKey<Session>(SESSIONS_RECORD_FILE, sessionId);
  }

  /**
   * 获取指定角色的所有会话
   */
  static async getSessionsByCharacterId(characterId: string): Promise<Session[]> {
    const all = await this.getAllSessions();
    return all.filter(s => s.characterId === characterId);
  }

  /**
   * 更新会话
   * 
   * @param sessionId - 会话 ID
   * @param updates - 要更新的字段（name 会被校验）
   * @returns 更新后的 Session，若不存在或校验失败返回 null
   */
  static async updateSession(
    sessionId: string,
    updates: Partial<Pick<Session, "name">>,
  ): Promise<Session | null> {
    const existing = await this.getSessionById(sessionId);
    if (!existing) {
      return null;
    }

    // 校验名称
    if (updates.name !== undefined && !isValidSessionName(updates.name)) {
      return null;
    }

    const updated: Session = {
      ...existing,
      ...(updates.name !== undefined && { name: updates.name.trim() }),
      updatedAt: new Date().toISOString(),
    };

    await putRecord(SESSIONS_RECORD_FILE, sessionId, updated);
    return updated;
  }

  /**
   * 删除会话
   * 
   * @param sessionId - 会话 ID
   * @returns 是否删除成功
   */
  static async deleteSession(sessionId: string): Promise<boolean> {
    const existing = await this.getSessionById(sessionId);
    if (!existing) {
      return false;
    }

    await deleteRecord(SESSIONS_RECORD_FILE, sessionId);
    return true;
  }

  /**
   * 更新会话的最后活动时间
   */
  static async touchSession(sessionId: string): Promise<Session | null> {
    const existing = await this.getSessionById(sessionId);
    if (!existing) {
      return null;
    }

    const updated: Session = {
      ...existing,
      updatedAt: new Date().toISOString(),
    };

    await putRecord(SESSIONS_RECORD_FILE, sessionId, updated);
    return updated;
  }
}
