/**
 * @input  zustand, lib/models/persona-model
 * @output usePersonaStore, getActivePersona, getActivePersonaDescription, getActivePersonaName
 * @pos    用户身份状态管理,支持多 Persona 切换、角色连接、Chat 锁定等功能
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                           Persona Store                                    ║
 * ║                                                                            ║
 * ║  使用 Zustand 管理 Persona 状态                                             ║
 * ║  支持持久化、Chat 锁定、Character 连接、默认 Persona 等功能                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type {
  Persona,
  PersonaConnection,
  ChatPersonaLock,
  PersonaResolution,
} from "@/lib/models/persona-model";
import {
  PersonaDescriptionPosition,
  createDefaultPersona,
} from "@/lib/models/persona-model";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface PersonaStoreState {
  /* ─────────────────────────────────────────────────────────────────────────
     核心数据（持久化）
     ───────────────────────────────────────────────────────────────────────── */
  /** 所有 Personas，按 ID 索引 */
  personas: Record<string, Persona>;
  /** Persona 与 Character 的连接关系 */
  connections: PersonaConnection[];
  /** 默认 Persona ID */
  defaultPersonaId: string | null;
  /** Chat 级别锁定 */
  chatLocks: Record<string, string>; // dialogueKey -> personaId

  /* ─────────────────────────────────────────────────────────────────────────
     运行时状态（不持久化）
     ───────────────────────────────────────────────────────────────────────── */
  /** 当前激活的 Persona ID */
  activePersonaId: string | null;
  /** 是否为临时选择（未锁定） */
  isTemporary: boolean;

  /* ─────────────────────────────────────────────────────────────────────────
     Persona CRUD 操作
     ───────────────────────────────────────────────────────────────────────── */
  /** 添加新 Persona */
  addPersona: (persona: Omit<Persona, "id" | "createdAt" | "updatedAt">) => string;
  /** 更新 Persona */
  updatePersona: (id: string, updates: Partial<Persona>) => void;
  /** 删除 Persona */
  deletePersona: (id: string) => void;
  /** 获取 Persona */
  getPersona: (id: string) => Persona | undefined;
  /** 获取所有 Personas */
  getAllPersonas: () => Persona[];

  /* ─────────────────────────────────────────────────────────────────────────
     激活与选择
     ───────────────────────────────────────────────────────────────────────── */
  /** 设置当前激活的 Persona */
  setActivePersona: (id: string | null, isTemporary?: boolean) => void;
  /** 设置默认 Persona */
  setDefaultPersona: (id: string | null) => void;

  /* ─────────────────────────────────────────────────────────────────────────
     Character 连接
     ───────────────────────────────────────────────────────────────────────── */
  /** 连接 Persona 到 Character */
  connectToCharacter: (personaId: string, characterId: string) => void;
  /** 断开 Persona 与 Character 的连接 */
  disconnectFromCharacter: (personaId: string, characterId: string) => void;
  /** 获取角色连接的 Persona */
  getPersonaForCharacter: (characterId: string) => string | null;
  /** 获取 Persona 连接的所有角色 */
  getCharactersForPersona: (personaId: string) => string[];

  /* ─────────────────────────────────────────────────────────────────────────
     Chat 锁定
     ───────────────────────────────────────────────────────────────────────── */
  /** 锁定 Persona 到 Chat */
  lockToChat: (dialogueKey: string, personaId: string) => void;
  /** 解除 Chat 锁定 */
  unlockFromChat: (dialogueKey: string) => void;
  /** 获取 Chat 锁定的 Persona */
  getChatLock: (dialogueKey: string) => string | null;

  /* ─────────────────────────────────────────────────────────────────────────
     解析
     ───────────────────────────────────────────────────────────────────────── */
  /** 解析当前应该使用的 Persona（按优先级） */
  resolvePersona: (dialogueKey: string, characterId: string) => PersonaResolution;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Store 实现
   ═══════════════════════════════════════════════════════════════════════════ */

export const usePersonaStore = create<PersonaStoreState>()(
  persist(
    (set, get) => ({
      /* ─────────────────────────────────────────────────────────────────────
         初始状态
         ───────────────────────────────────────────────────────────────────── */
      personas: {},
      connections: [],
      defaultPersonaId: null,
      chatLocks: {},
      activePersonaId: null,
      isTemporary: false,

      /* ─────────────────────────────────────────────────────────────────────
         Persona CRUD 操作
         ───────────────────────────────────────────────────────────────────── */

      addPersona: (personaData) => {
        const id = uuidv4();
        const now = new Date().toISOString();
        const persona: Persona = {
          ...createDefaultPersona(),
          ...personaData,
          id,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          personas: { ...state.personas, [id]: persona },
        }));

        return id;
      },

      updatePersona: (id, updates) => {
        set((state) => {
          const existing = state.personas[id];
          if (!existing) return state;

          return {
            personas: {
              ...state.personas,
              [id]: {
                ...existing,
                ...updates,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      deletePersona: (id) => {
        set((state) => {
          const { [id]: removed, ...rest } = state.personas;

          // 清理相关连接和锁定
          const connections = state.connections.filter((c) => c.personaId !== id);
          const chatLocks = Object.fromEntries(
            Object.entries(state.chatLocks).filter(([_, pId]) => pId !== id),
          );

          return {
            personas: rest,
            connections,
            chatLocks,
            defaultPersonaId: state.defaultPersonaId === id ? null : state.defaultPersonaId,
            activePersonaId: state.activePersonaId === id ? null : state.activePersonaId,
          };
        });
      },

      getPersona: (id) => get().personas[id],

      getAllPersonas: () => Object.values(get().personas),

      /* ─────────────────────────────────────────────────────────────────────
         激活与选择
         ───────────────────────────────────────────────────────────────────── */

      setActivePersona: (id, isTemporary = false) => {
        set({ activePersonaId: id, isTemporary });
      },

      setDefaultPersona: (id) => {
        set({ defaultPersonaId: id });
      },

      /* ─────────────────────────────────────────────────────────────────────
         Character 连接
         ───────────────────────────────────────────────────────────────────── */

      connectToCharacter: (personaId, characterId) => {
        set((state) => {
          // 移除该角色与其他 Persona 的连接（一个角色只能连接一个 Persona）
          const filtered = state.connections.filter((c) => c.characterId !== characterId);
          return {
            connections: [...filtered, { personaId, characterId }],
          };
        });
      },

      disconnectFromCharacter: (personaId, characterId) => {
        set((state) => ({
          connections: state.connections.filter(
            (c) => !(c.personaId === personaId && c.characterId === characterId),
          ),
        }));
      },

      getPersonaForCharacter: (characterId) => {
        const connection = get().connections.find((c) => c.characterId === characterId);
        return connection?.personaId ?? null;
      },

      getCharactersForPersona: (personaId) => {
        return get()
          .connections.filter((c) => c.personaId === personaId)
          .map((c) => c.characterId);
      },

      /* ─────────────────────────────────────────────────────────────────────
         Chat 锁定
         ───────────────────────────────────────────────────────────────────── */

      lockToChat: (dialogueKey, personaId) => {
        set((state) => ({
          chatLocks: { ...state.chatLocks, [dialogueKey]: personaId },
        }));
      },

      unlockFromChat: (dialogueKey) => {
        set((state) => {
          const { [dialogueKey]: _, ...rest } = state.chatLocks;
          return { chatLocks: rest };
        });
      },

      getChatLock: (dialogueKey) => get().chatLocks[dialogueKey] ?? null,

      /* ─────────────────────────────────────────────────────────────────────
         解析（按优先级）
         ───────────────────────────────────────────────────────────────────── */

      resolvePersona: (dialogueKey, characterId) => {
        const state = get();

        // 1. Chat Lock（最高优先级）
        const chatLock = state.chatLocks[dialogueKey];
        if (chatLock && state.personas[chatLock]) {
          return { personaId: chatLock, lockType: "chat" as const };
        }

        // 2. Character Connection（中等优先级）
        const charConnection = state.connections.find((c) => c.characterId === characterId);
        if (charConnection && state.personas[charConnection.personaId]) {
          return { personaId: charConnection.personaId, lockType: "character" as const };
        }

        // 3. Default Persona（最低优先级）
        if (state.defaultPersonaId && state.personas[state.defaultPersonaId]) {
          return { personaId: state.defaultPersonaId, lockType: "default" as const };
        }

        return { personaId: null, lockType: "none" as const };
      },
    }),
    {
      name: "persona-storage",
      partialize: (state) => ({
        personas: state.personas,
        connections: state.connections,
        defaultPersonaId: state.defaultPersonaId,
        chatLocks: state.chatLocks,
      }),
    },
  ),
);

/* ═══════════════════════════════════════════════════════════════════════════
   便捷函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 获取当前激活的 Persona
 */
export function getActivePersona(): Persona | null {
  const state = usePersonaStore.getState();
  if (!state.activePersonaId) return null;
  return state.personas[state.activePersonaId] ?? null;
}

/**
 * 获取当前 Persona 的描述（用于宏替换）
 */
export function getActivePersonaDescription(): string {
  const persona = getActivePersona();
  return persona?.description ?? "";
}

/**
 * 获取当前 Persona 的名称（用于 {{user}} 替换）
 */
export function getActivePersonaName(): string {
  const persona = getActivePersona();
  return persona?.name ?? "";
}
