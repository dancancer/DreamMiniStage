/**
 * @input  lib/store/persona-store, lib/models/persona-model
 * @output useCurrentPersona, UseCurrentPersonaReturn, getPersonaDisplayName, getPersonaDescription, getPersonaDisplayNameForDialogue, getPersonaDescriptionForDialogue, resolvePersonaForDialogue
 * @pos    Persona 解析 Hook - 在对话上下文中自动解析应该使用的 Persona
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       useCurrentPersona Hook                              ║
 * ║                                                                            ║
 * ║  在对话上下文中自动解析应该使用的 Persona                                     ║
 * ║  按优先级：Chat Lock > Character Connection > Default > None               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useMemo } from "react";
import { usePersonaStore } from "@/lib/store/persona-store";
import type { Persona, PersonaLockType } from "@/lib/models/persona-model";

/* ═══════════════════════════════════════════════════════════════════════════
   Hook 返回类型
   ═══════════════════════════════════════════════════════════════════════════ */

export interface UseCurrentPersonaReturn {
  /** 当前应该使用的 Persona（可能为 null） */
  persona: Persona | null;
  /** Persona ID */
  personaId: string | null;
  /** 锁定类型 */
  lockType: PersonaLockType;
  /** 是否为临时选择（与锁定不一致） */
  isTemporary: boolean;
  /** 显示名称（用于替换 {{user}}） */
  displayName: string;
  /** 描述（用于 {{persona}} 宏） */
  description: string;
  /** 锁定到当前 Chat */
  lockToCurrentChat: () => void;
  /** 解除当前 Chat 锁定 */
  unlockCurrentChat: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Hook 实现
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 在对话上下文中获取当前 Persona
 *
 * @param dialogueKey - 对话 Key（sessionId 或 characterId）
 * @param characterId - 角色 ID
 * @param autoActivate - 是否自动激活解析出的 Persona（默认 true）
 */
export function useCurrentPersona(
  dialogueKey: string | undefined,
  characterId: string | undefined,
  autoActivate = true
): UseCurrentPersonaReturn {
  const store = usePersonaStore();

  /* ─────────────────────────────────────────────────────────────────────────
     解析当前应该使用的 Persona
     ───────────────────────────────────────────────────────────────────────── */
  const resolution = useMemo(() => {
    if (!dialogueKey || !characterId) {
      return { personaId: null, lockType: "none" as const };
    }
    return store.resolvePersona(dialogueKey, characterId);
  }, [store, dialogueKey, characterId]);

  const persona = useMemo(() => {
    if (!resolution.personaId) return null;
    return store.personas[resolution.personaId] ?? null;
  }, [resolution.personaId, store.personas]);

  /* ─────────────────────────────────────────────────────────────────────────
     自动激活
     ───────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!autoActivate) return;
    if (!dialogueKey || !characterId) return;

    // 如果当前激活的 Persona 与解析出的不同，更新激活状态
    if (store.activePersonaId !== resolution.personaId) {
      store.setActivePersona(resolution.personaId, false);
    }
  }, [autoActivate, dialogueKey, characterId, resolution.personaId, store]);

  /* ─────────────────────────────────────────────────────────────────────────
     计算属性
     ───────────────────────────────────────────────────────────────────────── */
  const isTemporary = useMemo(() => {
    // 如果当前激活的 Persona 与解析出的锁定 Persona 不同，则为临时
    if (!store.activePersonaId) return false;
    if (!resolution.personaId) return true;
    return store.activePersonaId !== resolution.personaId;
  }, [store.activePersonaId, resolution.personaId]);

  const displayName = useMemo(() => {
    // 优先使用激活的 Persona 名称
    if (store.activePersonaId && store.personas[store.activePersonaId]) {
      return store.personas[store.activePersonaId].name;
    }
    return persona?.name ?? "";
  }, [store.activePersonaId, store.personas, persona]);

  const description = useMemo(() => {
    // 优先使用激活的 Persona 描述
    if (store.activePersonaId && store.personas[store.activePersonaId]) {
      return store.personas[store.activePersonaId].description;
    }
    return persona?.description ?? "";
  }, [store.activePersonaId, store.personas, persona]);

  /* ─────────────────────────────────────────────────────────────────────────
     操作
     ───────────────────────────────────────────────────────────────────────── */
  const lockToCurrentChat = () => {
    if (!dialogueKey || !store.activePersonaId) return;
    store.lockToChat(dialogueKey, store.activePersonaId);
  };

  const unlockCurrentChat = () => {
    if (!dialogueKey) return;
    store.unlockFromChat(dialogueKey);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     返回
     ───────────────────────────────────────────────────────────────────────── */
  return {
    persona,
    personaId: resolution.personaId,
    lockType: resolution.lockType,
    isTemporary,
    displayName,
    description,
    lockToCurrentChat,
    unlockCurrentChat,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   便捷函数（非 Hook，用于非组件上下文）
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 获取当前激活 Persona 的显示名称
 * 如果没有激活的 Persona，返回空字符串
 */
export function getPersonaDisplayName(): string {
  const state = usePersonaStore.getState();
  if (!state.activePersonaId) return "";
  const persona = state.personas[state.activePersonaId];
  return persona?.name ?? "";
}

/**
 * 获取当前激活 Persona 的描述
 * 用于 {{persona}} 宏替换
 */
export function getPersonaDescription(): string {
  const state = usePersonaStore.getState();
  if (!state.activePersonaId) return "";
  const persona = state.personas[state.activePersonaId];
  return persona?.description ?? "";
}

export function getPersonaDisplayNameForDialogue(
  dialogueKey: string,
  characterId: string,
): string {
  const state = usePersonaStore.getState();
  const resolution = state.resolvePersona(dialogueKey, characterId);

  if (!resolution.personaId) {
    return "";
  }

  return state.personas[resolution.personaId]?.name ?? "";
}

export function getPersonaDescriptionForDialogue(
  dialogueKey: string,
  characterId: string,
): string {
  const state = usePersonaStore.getState();
  const resolution = state.resolvePersona(dialogueKey, characterId);

  if (!resolution.personaId) {
    return "";
  }

  return state.personas[resolution.personaId]?.description ?? "";
}

/**
 * 解析指定对话应该使用的 Persona（静态版本）
 */
export function resolvePersonaForDialogue(
  dialogueKey: string,
  characterId: string
): { personaId: string | null; lockType: PersonaLockType } {
  return usePersonaStore.getState().resolvePersona(dialogueKey, characterId);
}
