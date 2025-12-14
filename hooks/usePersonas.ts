/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                           usePersonas Hook                                ║
 * ║                                                                            ║
 * ║  封装 Persona Store 操作，为 UI 组件提供统一接口                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { useCallback, useMemo } from "react";
import { usePersonaStore } from "@/lib/store/persona-store";
import type { Persona } from "@/lib/models/persona-model";
import { PersonaDescriptionPosition } from "@/lib/models/persona-model";
import {
  fileToDataUrl,
  generateDefaultAvatar,
  exportPersonas,
  downloadExport,
} from "@/lib/data/roleplay/persona-operation";

/* ═══════════════════════════════════════════════════════════════════════════
   Hook 返回类型
   ═══════════════════════════════════════════════════════════════════════════ */

export interface UsePersonasReturn {
  /* ─────────────────────────────────────────────────────────────────────────
     数据
     ───────────────────────────────────────────────────────────────────────── */
  /** 所有 Personas 列表（按更新时间排序） */
  personas: Persona[];
  /** 默认 Persona */
  defaultPersona: Persona | null;
  /** 当前激活的 Persona */
  activePersona: Persona | null;
  /** 是否为临时选择 */
  isTemporary: boolean;

  /* ─────────────────────────────────────────────────────────────────────────
     CRUD 操作
     ───────────────────────────────────────────────────────────────────────── */
  /** 创建新 Persona */
  createPersona: (data: PersonaCreateInput) => Promise<string>;
  /** 更新 Persona */
  updatePersona: (id: string, updates: Partial<Persona>) => void;
  /** 删除 Persona */
  deletePersona: (id: string) => void;
  /** 获取 Persona */
  getPersona: (id: string) => Persona | undefined;

  /* ─────────────────────────────────────────────────────────────────────────
     头像操作
     ───────────────────────────────────────────────────────────────────────── */
  /** 上传头像（从 File） */
  uploadAvatar: (personaId: string, file: File) => Promise<void>;
  /** 生成默认头像 */
  generateAvatar: (personaId: string) => void;

  /* ─────────────────────────────────────────────────────────────────────────
     选择与激活
     ───────────────────────────────────────────────────────────────────────── */
  /** 设置为默认 Persona */
  setAsDefault: (id: string | null) => void;
  /** 激活 Persona */
  activatePersona: (id: string | null, temporary?: boolean) => void;

  /* ─────────────────────────────────────────────────────────────────────────
     连接管理
     ───────────────────────────────────────────────────────────────────────── */
  /** 连接到角色 */
  connectToCharacter: (personaId: string, characterId: string) => void;
  /** 断开与角色的连接 */
  disconnectFromCharacter: (personaId: string, characterId: string) => void;
  /** 获取角色连接的 Persona ID */
  getPersonaForCharacter: (characterId: string) => string | null;

  /* ─────────────────────────────────────────────────────────────────────────
     Chat 锁定
     ───────────────────────────────────────────────────────────────────────── */
  /** 锁定到 Chat */
  lockToChat: (dialogueKey: string, personaId: string) => void;
  /** 解除 Chat 锁定 */
  unlockFromChat: (dialogueKey: string) => void;
  /** 获取 Chat 锁定的 Persona ID */
  getChatLock: (dialogueKey: string) => string | null;

  /* ─────────────────────────────────────────────────────────────────────────
     导入导出
     ───────────────────────────────────────────────────────────────────────── */
  /** 导出所有 Personas */
  exportAll: () => void;
}

/** 创建 Persona 的输入 */
export interface PersonaCreateInput {
  name: string;
  description?: string;
  avatarFile?: File;
  position?: PersonaDescriptionPosition;
  depth?: number;
  role?: "system" | "user";
}

/* ═══════════════════════════════════════════════════════════════════════════
   Hook 实现
   ═══════════════════════════════════════════════════════════════════════════ */

export function usePersonas(): UsePersonasReturn {
  /* ─────────────────────────────────────────────────────────────────────────
     Store 状态
     ───────────────────────────────────────────────────────────────────────── */
  const store = usePersonaStore();

  /* ─────────────────────────────────────────────────────────────────────────
     计算属性
     ───────────────────────────────────────────────────────────────────────── */
  const personas = useMemo(() => {
    return Object.values(store.personas).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [store.personas]);

  const defaultPersona = useMemo(() => {
    if (!store.defaultPersonaId) return null;
    return store.personas[store.defaultPersonaId] ?? null;
  }, [store.defaultPersonaId, store.personas]);

  const activePersona = useMemo(() => {
    if (!store.activePersonaId) return null;
    return store.personas[store.activePersonaId] ?? null;
  }, [store.activePersonaId, store.personas]);

  /* ─────────────────────────────────────────────────────────────────────────
     CRUD 操作
     ───────────────────────────────────────────────────────────────────────── */
  const createPersona = useCallback(
    async (data: PersonaCreateInput): Promise<string> => {
      let avatarPath = "";

      // 处理头像
      if (data.avatarFile) {
        avatarPath = await fileToDataUrl(data.avatarFile);
      } else if (data.name) {
        avatarPath = generateDefaultAvatar(data.name);
      }

      const id = store.addPersona({
        name: data.name,
        description: data.description ?? "",
        avatarPath,
        position: data.position ?? PersonaDescriptionPosition.IN_PROMPT,
        depth: data.depth ?? 4,
        role: data.role ?? "system",
      });

      return id;
    },
    [store]
  );

  const updatePersona = useCallback(
    (id: string, updates: Partial<Persona>) => {
      store.updatePersona(id, updates);
    },
    [store]
  );

  const deletePersona = useCallback(
    (id: string) => {
      store.deletePersona(id);
    },
    [store]
  );

  const getPersona = useCallback(
    (id: string) => store.getPersona(id),
    [store]
  );

  /* ─────────────────────────────────────────────────────────────────────────
     头像操作
     ───────────────────────────────────────────────────────────────────────── */
  const uploadAvatar = useCallback(
    async (personaId: string, file: File) => {
      const avatarPath = await fileToDataUrl(file);
      store.updatePersona(personaId, { avatarPath });
    },
    [store]
  );

  const generateAvatar = useCallback(
    (personaId: string) => {
      const persona = store.personas[personaId];
      if (!persona) return;

      const avatarPath = generateDefaultAvatar(persona.name);
      store.updatePersona(personaId, { avatarPath });
    },
    [store]
  );

  /* ─────────────────────────────────────────────────────────────────────────
     选择与激活
     ───────────────────────────────────────────────────────────────────────── */
  const setAsDefault = useCallback(
    (id: string | null) => {
      store.setDefaultPersona(id);
    },
    [store]
  );

  const activatePersona = useCallback(
    (id: string | null, temporary = false) => {
      store.setActivePersona(id, temporary);
    },
    [store]
  );

  /* ─────────────────────────────────────────────────────────────────────────
     连接管理
     ───────────────────────────────────────────────────────────────────────── */
  const connectToCharacter = useCallback(
    (personaId: string, characterId: string) => {
      store.connectToCharacter(personaId, characterId);
    },
    [store]
  );

  const disconnectFromCharacter = useCallback(
    (personaId: string, characterId: string) => {
      store.disconnectFromCharacter(personaId, characterId);
    },
    [store]
  );

  const getPersonaForCharacter = useCallback(
    (characterId: string) => store.getPersonaForCharacter(characterId),
    [store]
  );

  /* ─────────────────────────────────────────────────────────────────────────
     Chat 锁定
     ───────────────────────────────────────────────────────────────────────── */
  const lockToChat = useCallback(
    (dialogueKey: string, personaId: string) => {
      store.lockToChat(dialogueKey, personaId);
    },
    [store]
  );

  const unlockFromChat = useCallback(
    (dialogueKey: string) => {
      store.unlockFromChat(dialogueKey);
    },
    [store]
  );

  const getChatLock = useCallback(
    (dialogueKey: string) => store.getChatLock(dialogueKey),
    [store]
  );

  /* ─────────────────────────────────────────────────────────────────────────
     导入导出
     ───────────────────────────────────────────────────────────────────────── */
  const exportAll = useCallback(() => {
    const data = exportPersonas(
      store.personas,
      store.connections,
      store.defaultPersonaId
    );
    downloadExport(data);
  }, [store]);

  /* ─────────────────────────────────────────────────────────────────────────
     返回
     ───────────────────────────────────────────────────────────────────────── */
  return {
    // 数据
    personas,
    defaultPersona,
    activePersona,
    isTemporary: store.isTemporary,

    // CRUD
    createPersona,
    updatePersona,
    deletePersona,
    getPersona,

    // 头像
    uploadAvatar,
    generateAvatar,

    // 选择与激活
    setAsDefault,
    activatePersona,

    // 连接管理
    connectToCharacter,
    disconnectFromCharacter,
    getPersonaForCharacter,

    // Chat 锁定
    lockToChat,
    unlockFromChat,
    getChatLock,

    // 导入导出
    exportAll,
  };
}
