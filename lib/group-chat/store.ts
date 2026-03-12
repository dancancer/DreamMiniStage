import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { GroupMemberField } from "@/lib/slash-command/types";

const GROUP_CHAT_STORAGE_KEY = "dreamministage-group-chat";

export interface GroupChatMemberRecord {
  id: string;
  name: string;
  enabled: boolean;
  avatar: string;
}

interface GroupChatDialogueRecord {
  members: GroupChatMemberRecord[];
}

interface GroupChatStoreState {
  nextMemberId: number;
  dialogues: Record<string, GroupChatDialogueRecord>;
  listGroupMembers: (dialogueId: string) => GroupChatMemberRecord[];
  getGroupMemberCount: (dialogueId: string) => number;
  getGroupMember: (dialogueId: string, target: string, field: GroupMemberField) => string | number;
  addGroupMember: (dialogueId: string, target: string) => string;
  removeGroupMember: (dialogueId: string, target: string) => string;
  moveGroupMember: (dialogueId: string, target: string, direction: "up" | "down") => number;
  peekGroupMember: (dialogueId: string, target: string) => string;
  setGroupMemberEnabled: (dialogueId: string, target: string, enabled: boolean) => string;
  reset: () => void;
}

const emptyStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const initialState = {
  nextMemberId: 1,
  dialogues: {},
};

function normalizeDialogueId(dialogueId: string): string {
  const normalized = dialogueId.trim();
  if (!normalized) {
    throw new Error("Group chat requires dialogueId");
  }
  return normalized;
}

function normalizeTarget(target: string, label: string): string {
  const normalized = target.trim();
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function cloneMembers(members: GroupChatMemberRecord[]): GroupChatMemberRecord[] {
  return members.map((member) => ({ ...member }));
}

function ensureDialogueRecord(
  dialogues: Record<string, GroupChatDialogueRecord>,
  dialogueId: string,
): GroupChatDialogueRecord {
  return dialogues[dialogueId] || { members: [] };
}

function findMemberNameIndex(members: GroupChatMemberRecord[], target: string): number {
  return members.findIndex((member) => member.name === target);
}

function findMemberIdIndex(members: GroupChatMemberRecord[], target: string): number {
  return members.findIndex((member) => member.id === target);
}

function findMemberReferenceIndex(members: GroupChatMemberRecord[], target: string): number {
  const nameIndex = findMemberNameIndex(members, target);
  if (nameIndex >= 0) {
    return nameIndex;
  }
  return findMemberIdIndex(members, target);
}

function ensureMember(
  dialogues: Record<string, GroupChatDialogueRecord>,
  dialogueId: string,
  target: string,
): { dialogueId: string; member: GroupChatMemberRecord; index: number; members: GroupChatMemberRecord[] } {
  const resolvedDialogueId = normalizeDialogueId(dialogueId);
  const resolvedTarget = normalizeTarget(target, "group member target");
  const members = ensureDialogueRecord(dialogues, resolvedDialogueId).members;
  const index = findMemberReferenceIndex(members, resolvedTarget);
  if (index < 0) {
    throw new Error(`Group member not found: ${resolvedTarget}`);
  }
  return {
    dialogueId: resolvedDialogueId,
    member: members[index],
    index,
    members,
  };
}

export const useGroupChatStore = create<GroupChatStoreState>()(
  persist((set, get) => ({
    ...initialState,

    listGroupMembers: (dialogueId) => {
      const resolvedDialogueId = normalizeDialogueId(dialogueId);
      return cloneMembers(ensureDialogueRecord(get().dialogues, resolvedDialogueId).members);
    },

    getGroupMemberCount: (dialogueId) => {
      const resolvedDialogueId = normalizeDialogueId(dialogueId);
      return ensureDialogueRecord(get().dialogues, resolvedDialogueId).members.length;
    },

    getGroupMember: (dialogueId, target, field) => {
      const { member, index } = ensureMember(get().dialogues, dialogueId, target);
      if (field === "index") {
        return index;
      }
      if (field === "id") {
        return member.id;
      }
      if (field === "avatar") {
        return member.avatar;
      }
      return member.name;
    },

    addGroupMember: (dialogueId, target) => {
      const resolvedDialogueId = normalizeDialogueId(dialogueId);
      const name = normalizeTarget(target, "group member target");
      const state = get();
      const existing = ensureDialogueRecord(state.dialogues, resolvedDialogueId);
      if (findMemberNameIndex(existing.members, name) >= 0) {
        throw new Error(`Group member already exists: ${name}`);
      }

      const member: GroupChatMemberRecord = {
        id: `member-${state.nextMemberId}`,
        name,
        enabled: true,
        avatar: "",
      };
      const nextDialogue: GroupChatDialogueRecord = {
        members: [...existing.members, member],
      };

      set((current) => ({
        nextMemberId: current.nextMemberId + 1,
        dialogues: {
          ...current.dialogues,
          [resolvedDialogueId]: nextDialogue,
        },
      }));

      return member.name;
    },

    removeGroupMember: (dialogueId, target) => {
      const { dialogueId: resolvedDialogueId, member, members } = ensureMember(get().dialogues, dialogueId, target);
      const nextDialogue: GroupChatDialogueRecord = {
        members: members.filter((current) => current.id !== member.id),
      };

      set((state) => ({
        dialogues: {
          ...state.dialogues,
          [resolvedDialogueId]: nextDialogue,
        },
      }));

      return member.name;
    },

    moveGroupMember: (dialogueId, target, direction) => {
      const { dialogueId: resolvedDialogueId, member, index, members } = ensureMember(get().dialogues, dialogueId, target);
      const nextIndex = direction === "up"
        ? Math.max(0, index - 1)
        : Math.min(members.length - 1, index + 1);
      if (nextIndex === index) {
        return index;
      }

      const nextMembers = cloneMembers(members);
      nextMembers.splice(index, 1);
      nextMembers.splice(nextIndex, 0, { ...member });

      set((state) => ({
        dialogues: {
          ...state.dialogues,
          [resolvedDialogueId]: { members: nextMembers },
        },
      }));

      return nextIndex;
    },

    peekGroupMember: (dialogueId, target) => {
      return ensureMember(get().dialogues, dialogueId, target).member.name;
    },

    setGroupMemberEnabled: (dialogueId, target, enabled) => {
      const { dialogueId: resolvedDialogueId, member, members } = ensureMember(get().dialogues, dialogueId, target);
      const nextMembers = members.map((current) => current.id === member.id
        ? { ...current, enabled }
        : { ...current });

      set((state) => ({
        dialogues: {
          ...state.dialogues,
          [resolvedDialogueId]: { members: nextMembers },
        },
      }));

      return member.name;
    },

    reset: () => set(initialState),
  }), {
    name: GROUP_CHAT_STORAGE_KEY,
    storage: createJSONStorage(() => typeof window !== "undefined" ? window.localStorage : emptyStorage),
    partialize: (state) => ({
      nextMemberId: state.nextMemberId,
      dialogues: state.dialogues,
    }),
  }),
);

export function resetGroupChatStore(): void {
  useGroupChatStore.getState().reset();
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(GROUP_CHAT_STORAGE_KEY);
  }
}
