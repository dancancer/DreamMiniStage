/**
 * @input  lib/slash-command, lib/slash-command/prompt-injection-store, lib/slash-command/types
 * @output createSessionSlashExecutor
 * @pos    /session slash 执行器
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      Session Slash Executor                              ║
 * ║                                                                           ║
 * ║  收口 /session 的 slash 执行上下文组装、变量读写与 Quick Reply 执行路径。     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { executeSlashCommandScript } from "@/lib/slash-command";
import { getTotalListenerCount } from "@/hooks/script-bridge/event-handlers";
import { getRegisteredFunctionToolNames } from "@/hooks/script-bridge/function-tool-bridge";
import {
  getScriptHostCapabilityFromCall,
  type ScriptHostCapabilitySourceKey,
} from "@/hooks/script-bridge/host-capability-matrix";
import { resolveHostCapabilityState } from "@/hooks/script-bridge/host-debug-resolver";
import type { ScriptHostDebugState } from "@/hooks/script-bridge/host-debug-state";
import {
  createDefaultAutoBackground,
  createDefaultLockBackground,
  createDefaultSetBackground,
  createDefaultResetPanels,
  createDefaultSetAverageBackgroundColor,
  createDefaultSetChatDisplayMode,
  createDefaultSetCssVariable,
  createDefaultSetMovingUiPreset,
  createDefaultSetTheme,
  createDefaultTogglePanels,
  createDefaultToggleVisualNovelMode,
  createDefaultUnlockBackground,
  defaultCloseCurrentChat,
  defaultIsMobile,
  defaultPickIcon,
  defaultShowButtonsPopup,
  defaultShowPopup,
} from "@/hooks/script-bridge/default-ui-host";
import {
  upsertPromptInjection,
  listPromptInjections,
} from "@/lib/slash-command/prompt-injection-store";
import type {
  QuickReplyRecord,
  VisibleQuickReplyEntry,
} from "@/lib/quick-reply/store";
import type { ExecutionContext, SendOptions } from "@/lib/slash-command/types";
import type { DialogueMessage } from "@/types/character-dialogue";

interface QuickReplyStoreLike {
  resolveVisibleQuickReply: (dialogueId: string | undefined, index: number) => VisibleQuickReplyEntry;
  activateContextSets: (dialogueId: string, reply: QuickReplyRecord) => void;
  toggleGlobalQuickReplySet?: ExecutionContext["toggleGlobalQuickReplySet"];
  addGlobalQuickReplySet?: ExecutionContext["addGlobalQuickReplySet"];
  removeGlobalQuickReplySet?: ExecutionContext["removeGlobalQuickReplySet"];
  toggleChatQuickReplySet?: ExecutionContext["toggleChatQuickReplySet"];
  addChatQuickReplySet?: ExecutionContext["addChatQuickReplySet"];
  removeChatQuickReplySet?: ExecutionContext["removeChatQuickReplySet"];
  listQuickReplySets?: ExecutionContext["listQuickReplySets"];
  listQuickReplies?: ExecutionContext["listQuickReplies"];
  getQuickReply?: ExecutionContext["getQuickReply"];
  createQuickReply?: ExecutionContext["createQuickReply"];
  updateQuickReply?: ExecutionContext["updateQuickReply"];
  deleteQuickReply?: ExecutionContext["deleteQuickReply"];
  addQuickReplyContextSet?: ExecutionContext["addQuickReplyContextSet"];
  removeQuickReplyContextSet?: ExecutionContext["removeQuickReplyContextSet"];
  clearQuickReplyContextSets?: ExecutionContext["clearQuickReplyContextSets"];
  createQuickReplySet?: ExecutionContext["createQuickReplySet"];
  updateQuickReplySet?: ExecutionContext["updateQuickReplySet"];
  deleteQuickReplySet?: ExecutionContext["deleteQuickReplySet"];
}

interface VariableSnapshot {
  global: Record<string, unknown>;
  character: Record<string, unknown>;
}

type SessionSlashExecutorCallbacks = Partial<ExecutionContext> & {
  renameCurrentChat: NonNullable<ExecutionContext["renameCurrentChat"]>;
};

interface CreateSessionSlashExecutorOptions {
  characterId?: string | null;
  sessionId?: string | null;
  currentSessionName: string;
  dialogue: {
    messages: DialogueMessage[];
    addUserMessage: NonNullable<ExecutionContext["onSend"]>;
    triggerGeneration: NonNullable<ExecutionContext["onTrigger"]>;
    addRoleMessage: (
      role: string,
      text: string,
      options?: SendOptions,
    ) => void | Promise<void>;
    handleSwipe: NonNullable<ExecutionContext["onSwipe"]>;
    setMessages: (messages: DialogueMessage[]) => void;
  };
  promptCallbacks: Partial<ExecutionContext>;
  quickReplyStore: QuickReplyStoreLike;
  variables: VariableSnapshot;
  setUserInput: (text: string) => void;
  setScriptVariable: (key: string, value: unknown, scope: "global" | "character", id?: string) => void;
  deleteScriptVariable: (key: string, scope?: "global" | "character", id?: string) => void;
  hostDebugState: ScriptHostDebugState;
  syncHostDebug: () => void;
  resolveHostCapabilitySources: () => Partial<Record<
    ScriptHostCapabilitySourceKey,
    "session-default" | "api-context"
  >>;
  callbacks: SessionSlashExecutorCallbacks;
}

export function createSessionSlashExecutor(options: CreateSessionSlashExecutorOptions) {
  const globalVariables: Record<string, unknown> = { ...options.variables.global };
  const characterVariables: Record<string, unknown> = { ...options.variables.character };
  const hasCharacterVariable = (key: string): boolean =>
    Object.prototype.hasOwnProperty.call(characterVariables, key);

  const getVariable = (key: string): unknown => {
    if (hasCharacterVariable(key)) {
      return characterVariables[key];
    }
    return globalVariables[key];
  };

  const setVariable = (key: string, value: unknown): void => {
    if (options.characterId) {
      characterVariables[key] = value;
      options.setScriptVariable(key, value, "character", options.characterId);
      return;
    }

    globalVariables[key] = value;
    options.setScriptVariable(key, value, "global");
  };

  const deleteVariable = (key: string): void => {
    if (options.characterId) {
      delete characterVariables[key];
      options.deleteScriptVariable(key, "character", options.characterId);
      return;
    }

    delete globalVariables[key];
    options.deleteScriptVariable(key, "global");
  };

  let executionContext: ExecutionContext;
  const defaultSetAverageBackgroundColor = createDefaultSetAverageBackgroundColor();
  const defaultSetChatDisplayMode = createDefaultSetChatDisplayMode();
  const defaultTogglePanels = createDefaultTogglePanels();
  const defaultResetPanels = createDefaultResetPanels();
  const defaultToggleVisualNovelMode = createDefaultToggleVisualNovelMode();
  const defaultSetBackground = createDefaultSetBackground();
  const defaultLockBackground = createDefaultLockBackground();
  const defaultUnlockBackground = createDefaultUnlockBackground();
  const defaultAutoBackground = createDefaultAutoBackground();
  const defaultSetTheme = createDefaultSetTheme();
  const defaultSetMovingUiPreset = createDefaultSetMovingUiPreset();
  const defaultSetCssVariable = createDefaultSetCssVariable();

  const syncHostDebug = (): void => {
    options.hostDebugState.setToolRegistrationCount(getRegisteredFunctionToolNames().length);
    options.hostDebugState.setEventListenerCount(getTotalListenerCount());
    options.syncHostDebug();
  };

  const resolveObservedPath = (sourceKey?: ScriptHostCapabilitySourceKey) => {
    if (!sourceKey) {
      return undefined;
    }

    return options.resolveHostCapabilitySources()[sourceKey];
  };

  const recordHostDebugCall = (script: string, outcome: "supported" | "fail-fast"): void => {
    const matchedCapability = getScriptHostCapabilityFromCall("triggerSlash", [script]);
    if (!matchedCapability) {
      syncHostDebug();
      return;
    }

    const resolvedCapability = resolveHostCapabilityState(matchedCapability.capability, {
      resolvedPath: resolveObservedPath(matchedCapability.sourceKey),
    });
    options.hostDebugState.recordApiCall({
      method: "triggerSlash",
      capability: matchedCapability.capability.id,
      resolvedPath: resolvedCapability.resolvedPath,
      outcome,
      timestamp: Date.now(),
    });
    syncHostDebug();
  };

  const executeQuickReplyByIndex = async (index: number): Promise<string> => {
    const entry = options.quickReplyStore.resolveVisibleQuickReply(options.sessionId || undefined, index);
    if (options.sessionId) {
      options.quickReplyStore.activateContextSets(options.sessionId, entry.reply);
    }

    const payload = entry.reply.message.trim();
    if (!payload) {
      return "";
    }
    if (entry.set.nosend) {
      options.setUserInput(payload);
      return payload;
    }
    if (entry.set.inject) {
      await executionContext.injectPrompt?.(payload, {
        position: entry.set.before ? "before" : "in_chat",
      });
      return payload;
    }
    if (payload.startsWith("/")) {
      return executionContext.runSlashCommand
        ? executionContext.runSlashCommand(payload)
        : "";
    }

    await options.dialogue.addUserMessage(payload, undefined);
    return payload;
  };

  executionContext = {
    characterId: options.characterId || undefined,
    dialogueId: options.sessionId || undefined,
    messages: options.dialogue.messages,
    onSend: async (text, sendOptions) => options.dialogue.addUserMessage(text, sendOptions),
    onTrigger: async () => options.dialogue.triggerGeneration(),
    onSendAs: async (role, text) => options.dialogue.addRoleMessage(role, text),
    onSendSystem: async (text, sendOptions) => options.dialogue.addRoleMessage("system", text, sendOptions),
    onImpersonate: async (text) => options.dialogue.addRoleMessage("assistant", text),
    onContinue: async () => options.dialogue.triggerGeneration(),
    onSwipe: options.dialogue.handleSwipe,
    getCurrentChatName: () => options.currentSessionName || options.sessionId || "",
    setInputText: async (text) => options.setUserInput(text),
    togglePanels: defaultTogglePanels,
    resetPanels: defaultResetPanels,
    toggleVisualNovelMode: defaultToggleVisualNovelMode,
    setBackground: defaultSetBackground,
    lockBackground: defaultLockBackground,
    unlockBackground: defaultUnlockBackground,
    autoBackground: defaultAutoBackground,
    setTheme: defaultSetTheme,
    setMovingUiPreset: defaultSetMovingUiPreset,
    setCssVariable: defaultSetCssVariable,
    setAverageBackgroundColor: defaultSetAverageBackgroundColor,
    setChatDisplayMode: defaultSetChatDisplayMode,
    showButtonsPopup: typeof window !== "undefined" ? defaultShowButtonsPopup : undefined,
    showPopup: typeof window !== "undefined" ? defaultShowPopup : undefined,
    pickIcon: typeof window !== "undefined" ? defaultPickIcon : undefined,
    isMobileDevice: defaultIsMobile,
    closeCurrentChat: typeof document !== "undefined" ? defaultCloseCurrentChat : undefined,
    ...options.callbacks,
    ...options.promptCallbacks,
    injectPrompt: async (prompt, promptOptions) => {
      upsertPromptInjection(
        {
          content: prompt,
          role: promptOptions?.role,
          position: promptOptions?.position || "in_chat",
          depth: promptOptions?.depth,
        },
        {
          characterId: options.characterId || undefined,
          dialogueId: options.sessionId || undefined,
        },
      );
    },
    listPromptInjections: async () => {
      return listPromptInjections({
        characterId: options.characterId || undefined,
        dialogueId: options.sessionId || undefined,
      });
    },
    executeQuickReplyByIndex,
    toggleGlobalQuickReplySet: options.quickReplyStore.toggleGlobalQuickReplySet,
    addGlobalQuickReplySet: options.quickReplyStore.addGlobalQuickReplySet,
    removeGlobalQuickReplySet: options.quickReplyStore.removeGlobalQuickReplySet,
    toggleChatQuickReplySet: options.quickReplyStore.toggleChatQuickReplySet,
    addChatQuickReplySet: options.quickReplyStore.addChatQuickReplySet,
    removeChatQuickReplySet: options.quickReplyStore.removeChatQuickReplySet,
    listQuickReplySets: options.quickReplyStore.listQuickReplySets,
    listQuickReplies: options.quickReplyStore.listQuickReplies,
    getQuickReply: options.quickReplyStore.getQuickReply,
    createQuickReply: options.quickReplyStore.createQuickReply,
    updateQuickReply: options.quickReplyStore.updateQuickReply,
    deleteQuickReply: options.quickReplyStore.deleteQuickReply,
    addQuickReplyContextSet: options.quickReplyStore.addQuickReplyContextSet,
    removeQuickReplyContextSet: options.quickReplyStore.removeQuickReplyContextSet,
    clearQuickReplyContextSets: options.quickReplyStore.clearQuickReplyContextSets,
    createQuickReplySet: options.quickReplyStore.createQuickReplySet,
    updateQuickReplySet: options.quickReplyStore.updateQuickReplySet,
    deleteQuickReplySet: options.quickReplyStore.deleteQuickReplySet,
    getVariable,
    setVariable,
    deleteVariable,
    listVariables: () => {
      const keys = new Set<string>(Object.keys(globalVariables));
      for (const key of Object.keys(characterVariables)) {
        keys.add(key);
      }
      return Array.from(keys);
    },
    dumpVariables: () => ({
      ...globalVariables,
      ...characterVariables,
    }),
    getScopedVariable: (scope, key) => {
      if (scope === "global") {
        return globalVariables[key];
      }
      return getVariable(key);
    },
    setScopedVariable: (scope, key, value) => {
      if (scope === "global") {
        globalVariables[key] = value;
        options.setScriptVariable(key, value, "global");
        return;
      }
      setVariable(key, value);
    },
    deleteScopedVariable: (scope, key) => {
      if (scope === "global") {
        delete globalVariables[key];
        options.deleteScriptVariable(key, "global");
        return;
      }
      deleteVariable(key);
    },
    listScopedVariables: (scope) => {
      if (scope === "global") {
        return Object.keys(globalVariables);
      }
      const keys = new Set<string>(Object.keys(globalVariables));
      for (const key of Object.keys(characterVariables)) {
        keys.add(key);
      }
      return Array.from(keys);
    },
    dumpScopedVariables: (scope) => {
      if (scope === "global") {
        return { ...globalVariables };
      }
      return {
        ...globalVariables,
        ...characterVariables,
      };
    },
  };

  executionContext.runSlashCommand = async (nestedScript: string) => {
    const nestedResult = await executeSlashCommandScript(nestedScript, executionContext);
    if (nestedResult.isError) {
      throw new Error(nestedResult.errorMessage || "runSlashCommand failed");
    }
    return nestedResult.pipe;
  };

  return {
    executeQuickReplyByIndex,
    executeSessionSlashInput: async (script: string): Promise<string> => {
      let hasRecordedHostDebug = false;
      try {
        const result = await executeSlashCommandScript(script, executionContext);
        if (result.isError) {
          recordHostDebugCall(script, "fail-fast");
          hasRecordedHostDebug = true;
          throw new Error(result.errorMessage || "Slash command execution failed");
        }
        recordHostDebugCall(script, "supported");
        hasRecordedHostDebug = true;
        return result.pipe;
      } catch (error) {
        if (!hasRecordedHostDebug) {
          recordHostDebugCall(script, "fail-fast");
        }
        throw error;
      }
    },
  };
}
