/**
 * @input  lib/slash-command/types, types/character-dialogue
 * @output createSessionStoreHostCallbacks
 * @pos    /session store 宿主回调
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      Session Store Host Helpers                          ║
 * ║                                                                           ║
 * ║  收口 checkpoint / group / timed-effect 这批依赖 store 的 slash 宿主。     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { DialogueMessage } from "@/types/character-dialogue";
import type {
  WorldInfoTimedEffectFormat,
  WorldInfoTimedEffectName,
  WorldInfoTimedEffectState,
} from "@/lib/slash-command/types";

function buildSessionSlashHostError(commandName: string, detail: string): Error {
  return new Error(`${commandName} is not wired in /session host yet: ${detail}`);
}

interface SessionStoreHostDeps {
  createCheckpoint: (sessionId: string, messageId: string, requestedName?: string) => string | Promise<string>;
  createBranch: (sessionId: string, messageId: string, parentSessionId: string) => string | Promise<string>;
  getCheckpoint: (sessionId: string, messageId: string) => string | Promise<string>;
  listCheckpoints: (
    sessionId: string,
    messages: DialogueMessage[],
    links: boolean,
  ) => Array<number | string> | Promise<Array<number | string>>;
  goCheckpoint: (sessionId: string, messageId: string, parentSessionId: string) => string | Promise<string>;
  exitCheckpoint: (sessionId: string) => string | Promise<string>;
  getCheckpointParent: (sessionId: string) => string | Promise<string>;
  getWorldInfoTimedEffect: (input: {
    dialogueId: string;
    file: string;
    uid: string;
    effect: WorldInfoTimedEffectName;
    format?: WorldInfoTimedEffectFormat;
  }) => boolean | number | Promise<boolean | number>;
  setWorldInfoTimedEffect: (input: {
    dialogueId: string;
    file: string;
    uid: string;
    effect: WorldInfoTimedEffectName;
    state: WorldInfoTimedEffectState;
  }) => void | Promise<void>;
  getGroupMember: (
    sessionId: string,
    target: string,
    field: "name" | "index" | "id" | "avatar",
  ) => string | number | Promise<string | number>;
  getGroupMemberCount: (sessionId: string) => number | Promise<number>;
  addGroupMember: (sessionId: string, target: string) => string | Promise<string>;
  removeGroupMember: (sessionId: string, target: string) => string | Promise<string>;
  moveGroupMember: (sessionId: string, target: string, direction: "up" | "down") => number | Promise<number>;
  peekGroupMember: (sessionId: string, target: string) => string | Promise<string>;
  setGroupMemberEnabled: (sessionId: string, target: string, enabled: boolean) => string | Promise<string>;
}

interface CreateSessionStoreHostCallbacksOptions {
  sessionId: string | null;
  dialogueMessages: DialogueMessage[];
  deps: SessionStoreHostDeps;
}

function requireSessionId(sessionId: string | null, commandName: string): string {
  if (!sessionId) {
    throw buildSessionSlashHostError(commandName, "active dialogue session");
  }
  return sessionId;
}

export function createSessionStoreHostCallbacks(
  options: CreateSessionStoreHostCallbacksOptions,
) {
  return {
    createCheckpoint: async (messageId: string, requestedName?: string) => {
      const sessionId = requireSessionId(options.sessionId, "/checkpoint-create");
      return options.deps.createCheckpoint(sessionId, messageId, requestedName);
    },
    createBranch: async (messageId: string) => {
      const sessionId = requireSessionId(options.sessionId, "/branch-create");
      return options.deps.createBranch(sessionId, messageId, sessionId);
    },
    getCheckpoint: async (messageId: string) => {
      const sessionId = requireSessionId(options.sessionId, "/checkpoint-get");
      return options.deps.getCheckpoint(sessionId, messageId);
    },
    listCheckpoints: async (optionsInput?: { links?: boolean }) => {
      const sessionId = requireSessionId(options.sessionId, "/checkpoint-list");
      return options.deps.listCheckpoints(sessionId, options.dialogueMessages, optionsInput?.links ?? false);
    },
    goCheckpoint: async (messageId: string) => {
      const sessionId = requireSessionId(options.sessionId, "/checkpoint-go");
      return options.deps.goCheckpoint(sessionId, messageId, sessionId);
    },
    exitCheckpoint: async () => {
      const sessionId = requireSessionId(options.sessionId, "/checkpoint-exit");
      return options.deps.exitCheckpoint(sessionId);
    },
    getCheckpointParent: async () => {
      const sessionId = requireSessionId(options.sessionId, "/checkpoint-parent");
      return options.deps.getCheckpointParent(sessionId);
    },
    getWorldInfoTimedEffect: async (
      file: string,
      uid: string,
      effect: WorldInfoTimedEffectName,
      format?: { format?: WorldInfoTimedEffectFormat },
    ) => {
      const sessionId = requireSessionId(options.sessionId, "/wi-get-timed-effect");
      return options.deps.getWorldInfoTimedEffect({
        dialogueId: sessionId,
        file,
        uid,
        effect,
        format: format?.format,
      });
    },
    setWorldInfoTimedEffect: async (
      file: string,
      uid: string,
      effect: WorldInfoTimedEffectName,
      state: WorldInfoTimedEffectState,
    ) => {
      const sessionId = requireSessionId(options.sessionId, "/wi-set-timed-effect");
      return options.deps.setWorldInfoTimedEffect({
        dialogueId: sessionId,
        file,
        uid,
        effect,
        state,
      });
    },
    getGroupMember: async (
      target: string,
      field: "name" | "index" | "id" | "avatar",
    ) => {
      const sessionId = requireSessionId(options.sessionId, "/getmember");
      return options.deps.getGroupMember(sessionId, target, field);
    },
    getGroupMemberCount: async () => {
      const sessionId = requireSessionId(options.sessionId, "/countmember");
      return options.deps.getGroupMemberCount(sessionId);
    },
    addGroupMember: async (target: string) => {
      const sessionId = requireSessionId(options.sessionId, "/addmember");
      return options.deps.addGroupMember(sessionId, target);
    },
    removeGroupMember: async (target: string) => {
      const sessionId = requireSessionId(options.sessionId, "/member-remove");
      return options.deps.removeGroupMember(sessionId, target);
    },
    moveGroupMember: async (target: string, direction: "up" | "down") => {
      const sessionId = requireSessionId(options.sessionId, "/member-up");
      return options.deps.moveGroupMember(sessionId, target, direction);
    },
    peekGroupMember: async (target: string) => {
      const sessionId = requireSessionId(options.sessionId, "/member-peek");
      return options.deps.peekGroupMember(sessionId, target);
    },
    setGroupMemberEnabled: async (target: string, enabled: boolean) => {
      const sessionId = requireSessionId(options.sessionId, enabled ? "/enable" : "/disable");
      return options.deps.setGroupMemberEnabled(sessionId, target, enabled);
    },
  };
}
