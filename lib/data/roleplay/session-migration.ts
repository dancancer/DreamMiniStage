/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        Session Migration                                  ║
 * ║  将旧的 characterId-based 对话树迁移到 sessionId-based 结构                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import {
  CHARACTER_DIALOGUES_FILE,
  SESSIONS_RECORD_FILE,
  getAllRecords,
  getRecordByKey,
  putRecord,
} from "@/lib/data/local-storage";
import { LocalCharacterRecordOperations } from "./character-record-operation";
import { SessionOperations } from "./session-operation";
import { Session, generateDefaultSessionName } from "@/types/session";
import { DialogueTree } from "@/lib/models/node-model";

/* ═══════════════════════════════════════════════════════════════════════════
   迁移状态管理
   ═══════════════════════════════════════════════════════════════════════════ */

const MIGRATION_KEY = "session_migration_completed";

/**
 * 检查迁移是否已完成
 */
export function isMigrationCompleted(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(MIGRATION_KEY) === "true";
}

/**
 * 标记迁移已完成
 */
function markMigrationCompleted(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(MIGRATION_KEY, "true");
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   迁移逻辑
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 执行会话迁移
 * 
 * 迁移策略：
 * 1. 获取所有现有对话树
 * 2. 对于每个对话树，检查是否已有对应的 Session 记录
 * 3. 如果没有，创建一个新的 Session 记录
 * 4. 对话树 ID 保持不变（兼容旧数据）
 * 
 * @returns 迁移的会话数量
 */
export async function migrateExistingDialogues(): Promise<number> {
  if (isMigrationCompleted()) {
    return 0;
  }

  try {
    // 获取所有对话树
    const dialogues = await getAllRecords<DialogueTree>(CHARACTER_DIALOGUES_FILE);
    
    // 获取所有已存在的会话
    const existingSessions = await SessionOperations.getAllSessions();
    const existingSessionIds = new Set(existingSessions.map(s => s.id));

    let migratedCount = 0;

    for (const dialogue of dialogues) {
      // 跳过无效记录
      if (!dialogue?.id) continue;

      // 如果已有对应的 Session，跳过
      if (existingSessionIds.has(dialogue.id)) continue;

      // 获取角色信息以生成默认名称
      const characterId = dialogue.character_id || dialogue.id;
      const character = await LocalCharacterRecordOperations.getCharacterById(characterId);
      
      const sessionName = character?.data?.name
        ? generateDefaultSessionName(character.data.name)
        : `会话 - ${new Date().toLocaleString("zh-CN")}`;

      // 创建 Session 记录，使用对话树 ID 作为 Session ID
      const session: Session = {
        id: dialogue.id,
        characterId,
        name: sessionName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await putRecord(SESSIONS_RECORD_FILE, session.id, session);
      migratedCount++;
    }

    markMigrationCompleted();
    return migratedCount;
  } catch (error) {
    console.error("Session migration failed:", error);
    throw error;
  }
}

/**
 * 重置迁移状态（仅用于测试）
 */
export function resetMigrationState(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(MIGRATION_KEY);
  }
}
