/**
 * @input  app/session/session-switch
 * @output createSessionNavigationActions
 * @pos    /session 导航动作
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

export interface SessionNavigationActionsDeps {
  sessionId: string | null;
  characterId: string | null;
  currentCharacterName: string;
  currentMessagesLength: number;
  createSession: (characterId: string, options?: { name?: string }) => Promise<string | null>;
  updateSessionName: (sessionId: string, name: string) => Promise<boolean>;
  resolveCharacterSwitchTarget: (target: string) => Promise<string>;
  getCharacterNameById: (characterId: string) => Promise<string>;
  updateCharacterName: (characterId: string, name: string) => Promise<boolean>;
  pushRoute: (href: string) => void;
  queryMessageElement: (index: number) => HTMLElement | null;
  setCharacterNameOverride: (name: string) => void;
  buildTemporarySessionName: (characterName: string) => string;
  buildSwitchedSessionName: (nextCharacterName: string, currentCharacterName?: string) => string;
}

export function createSessionNavigationActions(deps: SessionNavigationActionsDeps) {
  return {
    handleSwitchCharacter: async (target: string) => {
      const nextCharacterId = await deps.resolveCharacterSwitchTarget(target);
      const nextCharacterName = await deps.getCharacterNameById(nextCharacterId);
      const switchedSessionName = deps.buildSwitchedSessionName(nextCharacterName, deps.currentCharacterName);
      const nextSessionId = await deps.createSession(nextCharacterId, { name: switchedSessionName });
      if (!nextSessionId) {
        throw new Error(`Failed to create session for character: ${nextCharacterId}`);
      }
      deps.pushRoute(`/session?id=${encodeURIComponent(nextSessionId)}`);
      return {
        target,
        characterId: nextCharacterId,
        characterName: nextCharacterName,
        sessionId: nextSessionId,
        sessionName: switchedSessionName,
      };
    },
    handleRenameChat: async (nextName: string) => {
      const normalized = nextName.trim();
      if (!deps.sessionId) {
        throw new Error("Session ID is required to rename chat");
      }
      if (!normalized) {
        throw new Error("Chat name is required");
      }
      const updated = await deps.updateSessionName(deps.sessionId, normalized);
      if (!updated) {
        throw new Error(`Failed to rename chat: ${deps.sessionId}`);
      }
      return normalized;
    },
    handleRenameCurrentCharacter: async (nextName: string) => {
      const normalized = nextName.trim();
      if (!deps.characterId) {
        throw new Error("Character ID is required to rename character");
      }
      if (!normalized) {
        throw new Error("Character name is required");
      }
      const updated = await deps.updateCharacterName(deps.characterId, normalized);
      if (!updated) {
        throw new Error(`Failed to rename character: ${deps.characterId}`);
      }
      deps.setCharacterNameOverride(normalized);
      return normalized;
    },
    handleOpenTemporaryChat: async () => {
      if (!deps.characterId) {
        throw new Error("Character ID is required to open temporary chat");
      }
      const nextSessionName = deps.buildTemporarySessionName(deps.currentCharacterName);
      const nextSessionId = await deps.createSession(deps.characterId, { name: nextSessionName });
      if (!nextSessionId) {
        throw new Error(`Failed to create temporary chat for character: ${deps.characterId}`);
      }
      deps.pushRoute(`/session?id=${encodeURIComponent(nextSessionId)}`);
    },
    handleJumpToMessage: async (index: number) => {
      if (index < 0 || index >= deps.currentMessagesLength) {
        throw new Error(`/chat-jump message index out of range: ${index}`);
      }
      if (typeof document === "undefined") {
        throw new Error("/chat-jump requires browser document");
      }
      const target = deps.queryMessageElement(index);
      if (!target) {
        throw new Error(`/chat-jump message element not found: ${index}`);
      }
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    },
  };
}
