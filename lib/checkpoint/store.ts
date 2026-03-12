import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const CHECKPOINT_STORAGE_KEY = "dreamministage-checkpoints";

interface CheckpointDialogueRecord {
  autoSeed: number;
  currentCheckpoint: string | null;
  parentChatName: string;
  messageToCheckpoint: Record<string, string>;
}

interface CheckpointStoreState {
  dialogues: Record<string, CheckpointDialogueRecord>;
  createCheckpoint: (dialogueId: string, messageId: string, requestedName?: string) => string;
  createBranch: (dialogueId: string, messageId: string, parentChatName: string) => string;
  getCheckpoint: (dialogueId: string, messageId: string) => string;
  listCheckpoints: (
    dialogueId: string,
    messages: Array<{ id: string }>,
    links: boolean,
  ) => Array<number | string>;
  goCheckpoint: (dialogueId: string, messageId: string, parentChatName: string) => string;
  exitCheckpoint: (dialogueId: string) => string;
  getCheckpointParent: (dialogueId: string) => string;
  getCurrentCheckpoint: (dialogueId: string) => string;
  reset: () => void;
}

const emptyStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const initialState = {
  dialogues: {},
};

function normalizeDialogueId(dialogueId: string): string {
  const normalized = dialogueId.trim();
  if (!normalized) {
    throw new Error("checkpoint requires dialogueId");
  }
  return normalized;
}

function normalizeMessageId(messageId: string): string {
  const normalized = messageId.trim();
  if (!normalized) {
    throw new Error("checkpoint target message has no id");
  }
  return normalized;
}

function getDialogueRecord(
  dialogues: Record<string, CheckpointDialogueRecord>,
  dialogueId: string,
): CheckpointDialogueRecord {
  return dialogues[dialogueId] || {
    autoSeed: 0,
    currentCheckpoint: null,
    parentChatName: "",
    messageToCheckpoint: {},
  };
}

function nextLinkName(record: CheckpointDialogueRecord, prefix: "checkpoint" | "branch"): string {
  const existed = new Set(Object.values(record.messageToCheckpoint));
  let seed = record.autoSeed;
  while (true) {
    seed += 1;
    const candidate = `${prefix}-${seed}`;
    if (!existed.has(candidate)) {
      record.autoSeed = seed;
      return candidate;
    }
  }
}

export const useCheckpointStore = create<CheckpointStoreState>()(
  persist((set, get) => ({
    ...initialState,

    createCheckpoint: (dialogueId, messageId, requestedName) => {
      const resolvedDialogueId = normalizeDialogueId(dialogueId);
      const resolvedMessageId = normalizeMessageId(messageId);
      const record = { ...getDialogueRecord(get().dialogues, resolvedDialogueId) };
      const checkpointName = requestedName?.trim() || nextLinkName(record, "checkpoint");
      record.messageToCheckpoint = {
        ...record.messageToCheckpoint,
        [resolvedMessageId]: checkpointName,
      };

      set((state) => ({
        dialogues: {
          ...state.dialogues,
          [resolvedDialogueId]: record,
        },
      }));
      return checkpointName;
    },

    createBranch: (dialogueId, messageId, parentChatName) => {
      const resolvedDialogueId = normalizeDialogueId(dialogueId);
      const resolvedMessageId = normalizeMessageId(messageId);
      const record = { ...getDialogueRecord(get().dialogues, resolvedDialogueId) };
      const branchName = nextLinkName(record, "branch");
      record.messageToCheckpoint = {
        ...record.messageToCheckpoint,
        [resolvedMessageId]: branchName,
      };
      record.currentCheckpoint = branchName;
      record.parentChatName = parentChatName;

      set((state) => ({
        dialogues: {
          ...state.dialogues,
          [resolvedDialogueId]: record,
        },
      }));
      return branchName;
    },

    getCheckpoint: (dialogueId, messageId) => {
      const resolvedDialogueId = normalizeDialogueId(dialogueId);
      const resolvedMessageId = normalizeMessageId(messageId);
      return getDialogueRecord(get().dialogues, resolvedDialogueId).messageToCheckpoint[resolvedMessageId] || "";
    },

    listCheckpoints: (dialogueId, messages, links) => {
      const resolvedDialogueId = normalizeDialogueId(dialogueId);
      const record = getDialogueRecord(get().dialogues, resolvedDialogueId);
      const result: Array<number | string> = [];
      messages.forEach((message, index) => {
        const checkpoint = record.messageToCheckpoint[message.id];
        if (!checkpoint) {
          return;
        }
        result.push(links ? checkpoint : index);
      });
      return result;
    },

    goCheckpoint: (dialogueId, messageId, parentChatName) => {
      const resolvedDialogueId = normalizeDialogueId(dialogueId);
      const resolvedMessageId = normalizeMessageId(messageId);
      const record = { ...getDialogueRecord(get().dialogues, resolvedDialogueId) };
      const checkpointName = record.messageToCheckpoint[resolvedMessageId] || "";
      if (!checkpointName) {
        return "";
      }
      record.currentCheckpoint = checkpointName;
      record.parentChatName = parentChatName;

      set((state) => ({
        dialogues: {
          ...state.dialogues,
          [resolvedDialogueId]: record,
        },
      }));
      return checkpointName;
    },

    exitCheckpoint: (dialogueId) => {
      const resolvedDialogueId = normalizeDialogueId(dialogueId);
      const record = { ...getDialogueRecord(get().dialogues, resolvedDialogueId) };
      if (!record.currentCheckpoint) {
        return "";
      }
      record.currentCheckpoint = null;

      set((state) => ({
        dialogues: {
          ...state.dialogues,
          [resolvedDialogueId]: record,
        },
      }));
      return record.parentChatName;
    },

    getCheckpointParent: (dialogueId) => {
      const resolvedDialogueId = normalizeDialogueId(dialogueId);
      const record = getDialogueRecord(get().dialogues, resolvedDialogueId);
      if (!record.currentCheckpoint) {
        return "";
      }
      return record.parentChatName;
    },

    getCurrentCheckpoint: (dialogueId) => {
      const resolvedDialogueId = normalizeDialogueId(dialogueId);
      return getDialogueRecord(get().dialogues, resolvedDialogueId).currentCheckpoint || "";
    },

    reset: () => set(initialState),
  }), {
    name: CHECKPOINT_STORAGE_KEY,
    storage: createJSONStorage(() => typeof window !== "undefined" ? window.localStorage : emptyStorage),
    partialize: (state) => ({
      dialogues: state.dialogues,
    }),
  }),
);

export function resetCheckpointStore(): void {
  useCheckpointStore.getState().reset();
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(CHECKPOINT_STORAGE_KEY);
  }
}
