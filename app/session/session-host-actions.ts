/**
 * @input  app/session/session-gallery, app/session/session-host, lib/model-runtime
 * @output createSessionHostActions
 * @pos    /session 宿主动作
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import type { Character, DialogueMessage, OpeningMessage } from "@/types/character-dialogue";
import type { APIConfig } from "@/lib/store/model-store";
import type { SessionHostCallbacks } from "@/app/session/session-host";
import type { SessionGalleryItem } from "@/app/session/session-gallery";
import type {
  WorldInfoTimedEffectFormat,
  WorldInfoTimedEffectName,
  WorldInfoTimedEffectState,
} from "@/lib/slash-command/types";

function buildSessionSlashHostError(commandName: string, detail: string): Error {
  return new Error(`${commandName} is not wired in /session host yet: ${detail}`);
}

interface ModelConfigState {
  configs: APIConfig[];
  activeConfigId: string;
  setActiveConfig: (id: string) => void;
}

interface SessionHostActionDeps {
  currentCharacter: Character | null;
  openingMessages: OpeningMessage[];
  messages: DialogueMessage[];
  setGalleryState: React.Dispatch<React.SetStateAction<{
    open: boolean;
    items: SessionGalleryItem[];
    target?: { character?: string; group?: string };
  }>>;
  listSessionGalleryItems: (input: {
    id: string;
    name: string;
    avatarPath?: string;
    openingMessages?: Array<{ content: string }>;
    messages?: Array<{ content: string }>;
  }, options?: { character?: string; group?: string }) => Promise<SessionGalleryItem[]>;
  getModelConfigs: () => ModelConfigState;
  syncModelConfigToStorage: (config: APIConfig) => void;
  hostCallbacks: SessionHostCallbacks;
  storeHostCallbacks: {
    getWorldInfoTimedEffect: (
      file: string,
      uid: string,
      effect: WorldInfoTimedEffectName,
      options?: { format?: WorldInfoTimedEffectFormat },
    ) => Promise<boolean | number>;
    setWorldInfoTimedEffect: (
      file: string,
      uid: string,
      effect: WorldInfoTimedEffectName,
      state: WorldInfoTimedEffectState,
    ) => Promise<void>;
    getGroupMember: (target: string, field: "name" | "index" | "id" | "avatar") => Promise<string | number>;
    getGroupMemberCount: () => Promise<number>;
    addGroupMember: (target: string) => Promise<string>;
    removeGroupMember: (target: string) => Promise<string>;
    moveGroupMember: (target: string, direction: "up" | "down") => Promise<number>;
    peekGroupMember: (target: string) => Promise<string>;
    setGroupMemberEnabled: (target: string, enabled: boolean) => Promise<string>;
    createCheckpoint: (messageId: string, requestedName?: string) => Promise<string>;
    createBranch: (messageId: string) => Promise<string>;
    getCheckpoint: (messageId: string) => Promise<string>;
    listCheckpoints: (options?: { links?: boolean }) => Promise<Array<number | string>>;
    goCheckpoint: (messageId: string) => Promise<string>;
    exitCheckpoint: () => Promise<string>;
    getCheckpointParent: () => Promise<string>;
  };
}

export function createSessionHostActions(deps: SessionHostActionDeps) {
  return {
    handleListGallery: async (options?: { character?: string; group?: string }) => {
      if (!deps.currentCharacter) {
        throw buildSessionSlashHostError("/list-gallery", "active character");
      }
      const items = await deps.listSessionGalleryItems({
        id: deps.currentCharacter.id,
        name: deps.currentCharacter.name,
        avatarPath: deps.currentCharacter.avatar_path,
        openingMessages: deps.openingMessages,
        messages: deps.messages,
      }, options);
      return items.map((item) => item.src);
    },
    handleShowGallery: async (options?: { character?: string; group?: string }) => {
      const items = await deps.listSessionGalleryItems({
        id: deps.currentCharacter?.id || "",
        name: deps.currentCharacter?.name || "",
        avatarPath: deps.currentCharacter?.avatar_path,
        openingMessages: deps.openingMessages,
        messages: deps.messages,
      }, options);
      deps.setGalleryState({ open: true, items, target: options });
    },
    handleTranslateText: deps.hostCallbacks.translateText,
    handleGetYouTubeTranscript: deps.hostCallbacks.getYouTubeTranscript,
    handleGetClipboardText: deps.hostCallbacks.getClipboardText,
    handleSetClipboardText: deps.hostCallbacks.setClipboardText,
    handleIsExtensionInstalled: deps.hostCallbacks.isExtensionInstalled,
    handleGetExtensionEnabledState: deps.hostCallbacks.getExtensionEnabledState,
    handleSetExtensionEnabled: deps.hostCallbacks.setExtensionEnabled,
    handleSelectProxyPreset: async (name?: string) => {
      const { configs, activeConfigId, setActiveConfig } = deps.getModelConfigs();
      if (configs.length === 0) {
        throw buildSessionSlashHostError("/proxy", "model-store config presets");
      }
      const normalized = (name || "").trim();
      if (normalized.length === 0) {
        const active = configs.find((config) => config.id === activeConfigId) || configs[0];
        if (!active) {
          throw buildSessionSlashHostError("/proxy", "active proxy preset");
        }
        return active.name;
      }
      const target = configs.find((config) => config.name === normalized || config.id === normalized);
      if (!target) {
        throw new Error(`/proxy preset not found: ${normalized}`);
      }
      setActiveConfig(target.id);
      deps.syncModelConfigToStorage(target);
      return target.name;
    },
    handleGetWorldInfoTimedEffect: deps.storeHostCallbacks.getWorldInfoTimedEffect,
    handleSetWorldInfoTimedEffect: deps.storeHostCallbacks.setWorldInfoTimedEffect,
    handleGetGroupMember: deps.storeHostCallbacks.getGroupMember,
    handleGetGroupMemberCount: deps.storeHostCallbacks.getGroupMemberCount,
    handleAddGroupMember: deps.storeHostCallbacks.addGroupMember,
    handleRemoveGroupMember: deps.storeHostCallbacks.removeGroupMember,
    handleMoveGroupMember: deps.storeHostCallbacks.moveGroupMember,
    handlePeekGroupMember: deps.storeHostCallbacks.peekGroupMember,
    handleSetGroupMemberEnabled: deps.storeHostCallbacks.setGroupMemberEnabled,
    handleCreateCheckpoint: deps.storeHostCallbacks.createCheckpoint,
    handleCreateBranch: deps.storeHostCallbacks.createBranch,
    handleGetCheckpoint: deps.storeHostCallbacks.getCheckpoint,
    handleListCheckpoints: deps.storeHostCallbacks.listCheckpoints,
    handleGoCheckpoint: deps.storeHostCallbacks.goCheckpoint,
    handleExitCheckpoint: deps.storeHostCallbacks.exitCheckpoint,
    handleGetCheckpointParent: deps.storeHostCallbacks.getCheckpointParent,
  };
}
