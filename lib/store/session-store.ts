/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                         Session Store                                     ║
 * ║                                                                           ║
 * ║  会话状态的全局管理 - 使用 Zustand 管理会话列表                               ║
 * ║  设计原则：单一数据源、类型安全、与 IndexedDB 同步                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { create } from "zustand";
import { SessionOperations } from "@/lib/data/roleplay/session-operation";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { migrateExistingDialogues } from "@/lib/data/roleplay/session-migration";
import {
  Session,
  SessionWithCharacter,
  generateDefaultSessionName,
  isValidSessionName,
} from "@/types/session";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface SessionState {
  // ========== 状态 ==========
  sessions: SessionWithCharacter[];
  isLoading: boolean;

  // ========== 操作 ==========
  fetchAllSessions: () => Promise<void>;
  createSession: (characterId: string) => Promise<string | null>;
  updateSessionName: (sessionId: string, name: string) => Promise<boolean>;
  deleteSession: (sessionId: string) => Promise<boolean>;

  // ========== 查询 ==========
  getSessionById: (sessionId: string) => SessionWithCharacter | undefined;
}

/* ═══════════════════════════════════════════════════════════════════════════
   辅助函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 将 Session 转换为 SessionWithCharacter
 * 附加角色名称和头像信息
 */
async function enrichSessionWithCharacter(
  session: Session,
): Promise<SessionWithCharacter> {
  const character = await LocalCharacterRecordOperations.getCharacterById(
    session.characterId,
  );

  return {
    ...session,
    characterName: character?.data?.name ?? "已删除的角色",
    characterAvatar: character?.imagePath ?? "",
  };
}

/**
 * 批量转换 Session 数组
 */
async function enrichSessions(
  sessions: Session[],
): Promise<SessionWithCharacter[]> {
  return Promise.all(sessions.map(enrichSessionWithCharacter));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Store 实现
   ═══════════════════════════════════════════════════════════════════════════ */

export const useSessionStore = create<SessionState>((set, get) => ({
  // ========== 初始状态 ==========
  sessions: [],
  isLoading: false,

  // ========== 操作 ==========

  /**
   * 获取所有会话并附加角色信息
   * 首次加载时自动执行迁移
   * Requirements: 1.1, 7.2
   */
  fetchAllSessions: async () => {
    set({ isLoading: true });

    try {
      // 首次加载时执行迁移
      await migrateExistingDialogues();

      const rawSessions = await SessionOperations.getAllSessions();
      const enriched = await enrichSessions(rawSessions);
      set({ sessions: enriched });
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * 创建新会话
   * Requirements: 2.2
   * 
   * @returns 新会话 ID，失败返回 null
   */
  createSession: async (characterId: string) => {
    try {
      const character = await LocalCharacterRecordOperations.getCharacterById(
        characterId,
      );
      if (!character) {
        console.error("Character not found:", characterId);
        return null;
      }

      const defaultName = generateDefaultSessionName(
        character.data?.name ?? "未知角色",
      );
      const session = await SessionOperations.createSession(
        characterId,
        defaultName,
      );

      const enriched = await enrichSessionWithCharacter(session);

      // 插入到列表头部（最新的在前）
      set((state) => ({
        sessions: [enriched, ...state.sessions],
      }));

      return session.id;
    } catch (error) {
      console.error("Failed to create session:", error);
      return null;
    }
  },

  /**
   * 更新会话名称
   * Requirements: 4.3
   * 
   * @returns 是否更新成功
   */
  updateSessionName: async (sessionId: string, name: string) => {
    if (!isValidSessionName(name)) {
      return false;
    }

    try {
      const updated = await SessionOperations.updateSession(sessionId, {
        name,
      });
      if (!updated) {
        return false;
      }

      // 更新本地状态
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? { ...s, name: updated.name, updatedAt: updated.updatedAt } : s,
        ),
      }));

      return true;
    } catch (error) {
      console.error("Failed to update session name:", error);
      return false;
    }
  },

  /**
   * 删除会话及其关联的对话树
   * Requirements: 5.2
   * 
   * @returns 是否删除成功
   */
  deleteSession: async (sessionId: string) => {
    try {
      const session = get().sessions.find((s) => s.id === sessionId);
      if (!session) {
        return false;
      }

      // 删除关联的对话树（使用 sessionId 作为 dialogueId）
      await LocalCharacterDialogueOperations.deleteDialogueTree(sessionId);

      // 删除会话记录
      const success = await SessionOperations.deleteSession(sessionId);
      if (!success) {
        return false;
      }

      // 更新本地状态
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
      }));

      return true;
    } catch (error) {
      console.error("Failed to delete session:", error);
      return false;
    }
  },

  // ========== 查询 ==========

  /**
   * 根据 ID 获取会话
   */
  getSessionById: (sessionId: string) => {
    return get().sessions.find((s) => s.id === sessionId);
  },
}));
