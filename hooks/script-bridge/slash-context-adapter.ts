/** Slash Context Adapter — 组装 ExecutionContext，领域模块位于 context-adapters/ */

import type { ApiCallContext } from "./types";
import type {
  ExecutionContext,
  SendOptions,
  PresetInfo,
  PersonaLockType,
} from "@/lib/slash-command/types";
import { executeSlashCommandScript } from "@/lib/slash-command/executor";
import {
  getPromptModelValue,
  getActivePromptPresetInfo,
  getPromptInstructState,
  getPromptPostProcessingValue,
  getPromptStopStrings,
  listPromptEntries,
  listPromptPresets,
  selectPromptContextPreset,
  selectPromptPresetByName,
  setPromptModelValue,
  setPromptEntriesEnabled,
  setPromptPostProcessingValue,
  setPromptStopStrings,
  updatePromptInstructState,
} from "@/lib/prompt-config/service";
import { createLoreRegexAdapters } from "./slash-context-lore-regex";
import {
  createDefaultAutoBackground,
  createDefaultLockBackground,
  createDefaultSetBackground,
  createDefaultResetPanels,
  createDefaultUnlockBackground,
  createDefaultSetCssVariable,
  createDefaultSetMovingUiPreset,
  createDefaultSetTheme,
  createDefaultTogglePanels,
  createDefaultToggleVisualNovelMode,
  createDefaultSetAverageBackgroundColor,
  createDefaultSetChatDisplayMode,
  defaultCloseCurrentChat,
  defaultIsMobile,
  defaultPickIcon,
  defaultShowButtonsPopup,
  defaultShowPopup,
} from "./default-ui-host";
import {
  syncAuthorNoteInjection,
  readPersonaLockStateFromStorage,
  writePersonaLockStateToStorage,
  createStorageDefaults,
} from "./context-adapters/storage-helpers";
import { createWorldBookAdapters } from "./context-adapters/worldbook-adapter";
import { createCharacterAdapters } from "./context-adapters/character-adapter";
import {
  createAudioAdapters,
  createToolAdapters,
  createPromptInjectionAdapters,
} from "./context-adapters/tool-prompt-adapter";

export function adaptSlashExecutionContext(ctx: ApiCallContext): ExecutionContext {
  const snapshot = ctx.getVariablesSnapshot();
  const globalVariables: Record<string, unknown> = { ...snapshot.global };
  const characterVariables: Record<string, unknown> = ctx.characterId && snapshot.character[ctx.characterId]
    ? { ...snapshot.character[ctx.characterId] }
    : {};

  /* ── 变量管理 ──────────────────────────────────────── */
  const hasCharacterVariable = (key: string): boolean =>
    Object.prototype.hasOwnProperty.call(characterVariables, key);

  const getLocalVariable = (key: string): unknown => {
    if (hasCharacterVariable(key)) return characterVariables[key];
    return globalVariables[key];
  };

  const setLocalVariable = (key: string, value: unknown): void => {
    if (ctx.characterId) {
      characterVariables[key] = value;
      ctx.setScriptVariable(key, value, "character", ctx.characterId);
      return;
    }
    globalVariables[key] = value;
    ctx.setScriptVariable(key, value, "global");
  };

  const deleteLocalVariable = (key: string): void => {
    if (ctx.characterId) {
      delete characterVariables[key];
      ctx.deleteScriptVariable(key, "character", ctx.characterId);
      return;
    }
    delete globalVariables[key];
    ctx.deleteScriptVariable(key, "global");
  };

  const setGlobalVariable = (key: string, value: unknown): void => {
    globalVariables[key] = value;
    ctx.setScriptVariable(key, value, "global");
  };

  const deleteGlobalVariable = (key: string): void => {
    delete globalVariables[key];
    ctx.deleteScriptVariable(key, "global");
  };

  const listLocalVariables = (): string[] => {
    const keys = new Set<string>(Object.keys(globalVariables));
    for (const key of Object.keys(characterVariables)) keys.add(key);
    return Array.from(keys);
  };

  const dumpLocalVariables = (): Record<string, unknown> => ({
    ...globalVariables,
    ...characterVariables,
  });

  /* ── 域回调解构 ─── */
  const _msg = ctx.messageCallbacks ?? {};
  const _chat = ctx.chatManagementCallbacks ?? {};
  const _cp = ctx.checkpointCallbacks ?? {};
  const _grp = ctx.groupMemberCallbacks ?? {};
  const _qr = ctx.quickReplyCallbacks ?? {};
  const _expr = ctx.expressionCallbacks ?? {};
  const _host = ctx.hostCapabilityCallbacks ?? {};
  const _wi = ctx.worldInfoCallbacks ?? {};
  const _ui = ctx.uiCallbacks ?? {};
  const _nav = ctx.navigationCallbacks ?? {};
  const onSend = _msg.onSend ?? (async (_text?: string, _options?: SendOptions) => {
    console.warn("[adaptContext] onSend 未提供");
  });
  const onTrigger = _msg.onTrigger ?? (async (_member?: string) => {
    console.warn("[adaptContext] onTrigger 未提供");
  });
  const onCloseChat = _chat.onCloseChat ?? (typeof document !== "undefined" ? defaultCloseCurrentChat : undefined);
  const storageDefaults = createStorageDefaults(ctx);
  const onGetInstructMode = ctx.onGetInstructMode ?? (() => getPromptInstructState());
  const onSetInstructMode = ctx.onSetInstructMode ?? ((p: { enabled?: boolean; preset?: string }) => updatePromptInstructState(p));
  const onGetStopStrings = ctx.onGetStopStrings ?? (() => getPromptStopStrings());
  const onSetStopStrings = ctx.onSetStopStrings ?? ((s: string[]) => setPromptStopStrings(s));
  const onGetModel = ctx.onGetModel ?? (() => getPromptModelValue());
  const onSetModel = ctx.onSetModel ?? ((m: string) => setPromptModelValue(m));
  const onGetAuthorNoteState = ctx.onGetAuthorNoteState ?? storageDefaults.getAuthorNoteState;
  const onSetAuthorNoteState = ctx.onSetAuthorNoteState ?? storageDefaults.setAuthorNoteState;
  const onGetPersonaName = ctx.onGetPersonaName ?? storageDefaults.getPersonaName;
  const onSetPersonaName = ctx.onSetPersonaName ?? storageDefaults.setPersonaName;
  const onGetCurrentProfileName = ctx.onGetCurrentProfileName ?? storageDefaults.getCurrentProfileName;
  const onSetCurrentProfileName = ctx.onSetCurrentProfileName ?? storageDefaults.setCurrentProfileName;
  const onListConnectionProfiles = ctx.onListConnectionProfiles ?? storageDefaults.listConnectionProfiles;
  const onCreateConnectionProfile = ctx.onCreateConnectionProfile ?? storageDefaults.createConnectionProfile;
  const onUpdateConnectionProfile = ctx.onUpdateConnectionProfile ?? storageDefaults.updateConnectionProfile;
  const onGetConnectionProfile = ctx.onGetConnectionProfile ?? storageDefaults.getConnectionProfile;
  const onGetPromptPostProcessing = ctx.onGetPromptPostProcessing ?? (() => getPromptPostProcessingValue());
  const onSetPromptPostProcessing = ctx.onSetPromptPostProcessing ?? ((v: string) => setPromptPostProcessingValue(v.trim()));
  const onSetPersonaLock = ctx.onSetPersonaLock
    ? async (
      state: "on" | "off" | "toggle",
      options?: { type?: PersonaLockType },
    ): Promise<boolean> => {
      const result = await Promise.resolve(ctx.onSetPersonaLock?.(state, options));
      if (typeof result === "boolean") {
        const lockType = options?.type || "chat";
        const snap = readPersonaLockStateFromStorage();
        snap[lockType] = result;
        writePersonaLockStateToStorage(snap);
      }
      return result as boolean;
    }
    : undefined;
  const onGetPersonaLockState = ctx.onGetPersonaLockState ?? ((
    options?: { type?: PersonaLockType },
  ) => readPersonaLockStateFromStorage()[options?.type || "chat"]);
  if (!ctx.onGetAuthorNoteState && !ctx.onSetAuthorNoteState) {
    syncAuthorNoteInjection(ctx, storageDefaults.getAuthorNoteState());
  }
  const resolvedTogglePanels = _ui.onTogglePanels ?? createDefaultTogglePanels();
  const onOpenTemporaryChat = _chat.onOpenTemporaryChat;
  const onJumpToMessage = _nav.onJumpToMessage;
  const onTranslateText = _host.onTranslateText;
  const onGetYouTubeTranscript = _host.onGetYouTubeTranscript;
  const onSelectProxyPreset = _host.onSelectProxyPreset;
  const onGetWorldInfoTimedEffect = _wi.onGetWorldInfoTimedEffect;
  const onSetWorldInfoTimedEffect = _wi.onSetWorldInfoTimedEffect;

  /* ── 领域适配器组装 ─── */
  const worldBook = createWorldBookAdapters(ctx.characterId);
  const character = createCharacterAdapters(ctx.characterId);
  const audio = createAudioAdapters();
  const promptInjection = createPromptInjectionAdapters(ctx, ctx.onRemovePromptInjections);
  const toolAdapters = createToolAdapters({
    characterId: ctx.characterId,
    characterVariables,
    globalVariables,
    setLocalVariable,
    deleteLocalVariable,
    getExecutionContext: () => executionContext,
  });
  const getPreset = async (): Promise<PresetInfo | undefined> => getActivePromptPresetInfo();
  const setPreset = async (name: string): Promise<void> => { await selectPromptPresetByName(name); };
  const listPresets = async (): Promise<PresetInfo[]> => listPromptPresets();
  const loreRegexAdapters = createLoreRegexAdapters(ctx);

  /* ── ExecutionContext 对象组装 ──────────────────────── */

  const executionContext: ExecutionContext = {
    characterId: ctx.characterId,
    dialogueId: ctx.dialogueId,
    messages: ctx.messages,
    onSend,
    onTrigger,
    onSendAs: _msg.onSendAs,
    onSendSystem: _msg.onSendSystem,
    onImpersonate: _msg.onImpersonate,
    onContinue: _msg.onContinue,
    onSwipe: _msg.onSwipe,
    closeCurrentChat: onCloseChat,
    getCurrentChatName: _chat.onGetChatName,
    renameCurrentChat: _chat.onRenameChat,
    setInputText: _chat.onSetInput,
    openTemporaryChat: onOpenTemporaryChat,
    forceSaveChat: _chat.onForceSaveChat,
    hideMessages: _chat.onHideMessages,
    unhideMessages: _chat.onUnhideMessages,
    createCheckpoint: _cp.onCreateCheckpoint,
    createBranch: _cp.onCreateBranch,
    getCheckpoint: _cp.onGetCheckpoint,
    listCheckpoints: _cp.onListCheckpoints,
    goCheckpoint: _cp.onGoCheckpoint,
    exitCheckpoint: _cp.onExitCheckpoint,
    getCheckpointParent: _cp.onGetCheckpointParent,
    duplicateCharacter: _chat.onDuplicateCharacter,
    createNewChat: _chat.onNewChat,
    generateImage: ctx.onGenerateImage,
    translateText: onTranslateText,
    getYouTubeTranscript: onGetYouTubeTranscript,
    getImageGenerationConfig: ctx.onGetImageGenerationConfig,
    setImageGenerationConfig: ctx.onSetImageGenerationConfig,
    getInstructMode: onGetInstructMode,
    setInstructMode: onSetInstructMode,
    getStopStrings: onGetStopStrings,
    setStopStrings: onSetStopStrings,
    getModel: onGetModel,
    setModel: onSetModel,
    selectProxyPreset: onSelectProxyPreset,
    narrateText: ctx.onNarrateText,
    getGroupMember: _grp.onGetGroupMember,
    getGroupMemberCount: _grp.onGetGroupMemberCount,
    addGroupMember: _grp.onAddGroupMember,
    removeGroupMember: _grp.onRemoveGroupMember,
    moveGroupMember: _grp.onMoveGroupMember,
    peekGroupMember: _grp.onPeekGroupMember,
    setGroupMemberEnabled: _grp.onSetGroupMemberEnabled,
    addSwipe: _msg.onAddSwipe,
    executeQuickReplyByIndex: _qr.onExecuteQuickReplyByIndex,
    toggleGlobalQuickReplySet: _qr.onToggleGlobalQuickReplySet,
    addGlobalQuickReplySet: _qr.onAddGlobalQuickReplySet,
    removeGlobalQuickReplySet: _qr.onRemoveGlobalQuickReplySet,
    toggleChatQuickReplySet: _qr.onToggleChatQuickReplySet,
    addChatQuickReplySet: _qr.onAddChatQuickReplySet,
    removeChatQuickReplySet: _qr.onRemoveChatQuickReplySet,
    listQuickReplySets: _qr.onListQuickReplySets,
    listQuickReplies: _qr.onListQuickReplies,
    getQuickReply: _qr.onGetQuickReply,
    createQuickReply: _qr.onCreateQuickReply,
    updateQuickReply: _qr.onUpdateQuickReply,
    deleteQuickReply: _qr.onDeleteQuickReply,
    addQuickReplyContextSet: _qr.onAddQuickReplyContextSet,
    removeQuickReplyContextSet: _qr.onRemoveQuickReplyContextSet,
    clearQuickReplyContextSets: _qr.onClearQuickReplyContextSets,
    createQuickReplySet: _qr.onCreateQuickReplySet,
    updateQuickReplySet: _qr.onUpdateQuickReplySet,
    deleteQuickReplySet: _qr.onDeleteQuickReplySet,
    askCharacter: ctx.onAskCharacter,
    getAuthorNoteState: onGetAuthorNoteState,
    setAuthorNoteState: onSetAuthorNoteState,
    getPersonaName: onGetPersonaName,
    setPersonaName: onSetPersonaName,
    getCurrentProfileName: onGetCurrentProfileName,
    setCurrentProfileName: onSetCurrentProfileName,
    listConnectionProfiles: onListConnectionProfiles,
    createConnectionProfile: onCreateConnectionProfile,
    updateConnectionProfile: onUpdateConnectionProfile,
    getConnectionProfile: onGetConnectionProfile,
    getPromptPostProcessing: onGetPromptPostProcessing,
    setPromptPostProcessing: onSetPromptPostProcessing,
    syncPersona: ctx.onSyncPersona,
    setPersonaLock: onSetPersonaLock,
    getPersonaLockState: onGetPersonaLockState,
    reloadPage: _nav.onReloadPage,
    ...toolAdapters,
    ...character,
    getClipboardText: _host.onGetClipboardText,
    setClipboardText: _host.onSetClipboardText,
    importVariables: _host.onImportVariables,
    openDataBank: ctx.onOpenDataBank,
    listDataBankEntries: ctx.onListDataBankEntries,
    getDataBankText: ctx.onGetDataBankText,
    addDataBankText: ctx.onAddDataBankText,
    updateDataBankText: ctx.onUpdateDataBankText,
    deleteDataBankEntry: ctx.onDeleteDataBankEntry,
    setDataBankEntryEnabled: ctx.onSetDataBankEntryEnabled,
    ingestDataBank: ctx.onIngestDataBank,
    purgeDataBank: ctx.onPurgeDataBank,
    searchDataBank: ctx.onSearchDataBank,
    isExtensionInstalled: _host.onIsExtensionInstalled,
    getExtensionEnabledState: _host.onGetExtensionEnabledState,
    setExtensionEnabled: _host.onSetExtensionEnabled,
    togglePanels: resolvedTogglePanels,
    resetPanels: _ui.onResetPanels ?? createDefaultResetPanels(),
    toggleVisualNovelMode: _ui.onToggleVisualNovelMode ?? createDefaultToggleVisualNovelMode(),
    setBackground: _ui.onSetBackground ?? createDefaultSetBackground(),
    lockBackground: _ui.onLockBackground ?? createDefaultLockBackground(),
    unlockBackground: _ui.onUnlockBackground ?? createDefaultUnlockBackground(),
    autoBackground: _ui.onAutoBackground ?? createDefaultAutoBackground(),
    setTheme: _ui.onSetTheme ?? createDefaultSetTheme(),
    setMovingUiPreset: _ui.onSetMovingUiPreset ?? createDefaultSetMovingUiPreset(),
    setCssVariable: _ui.onSetCssVariable ?? createDefaultSetCssVariable(),
    setAverageBackgroundColor: _ui.onSetAverageBackgroundColor ?? createDefaultSetAverageBackgroundColor(),
    setChatDisplayMode: _ui.onSetChatDisplayMode ?? createDefaultSetChatDisplayMode(),
    showButtonsPopup: _ui.onShowButtonsPopup ?? (typeof window !== "undefined" ? defaultShowButtonsPopup : undefined),
    showPopup: _ui.onShowPopup ?? (typeof window !== "undefined" ? defaultShowPopup : undefined),
    pickIcon: _ui.onPickIcon ?? (typeof window !== "undefined" ? defaultPickIcon : undefined),
    isMobileDevice: _ui.onIsMobile ?? defaultIsMobile,
    generateCaption: _ui.onGenerateCaption,
    playNotificationSound: _ui.onPlayNotificationSound,
    listGallery: _nav.onListGallery,
    showGallery: _nav.onShowGallery,
    uploadExpressionAsset: _expr.onUploadExpressionAsset,
    setExpression: _expr.onSetExpression,
    setExpressionFolderOverride: _expr.onSetExpressionFolderOverride,
    getLastExpression: _expr.onGetLastExpression,
    listExpressions: _expr.onListExpressions,
    classifyExpression: _expr.onClassifyExpression,
    jumpToMessage: onJumpToMessage,
    renderChatMessages: _nav.onRenderChatMessages,
    selectContextPreset: _nav.onSelectContextPreset ?? ((name?: string) => selectPromptContextPreset(name)),
    switchCharacter: _nav.onSwitchCharacter,
    renameCurrentCharacter: _nav.onRenameCurrentCharacter,
    ...worldBook,
    getVariable: getLocalVariable,
    setVariable: setLocalVariable,
    deleteVariable: deleteLocalVariable,
    listVariables: listLocalVariables,
    dumpVariables: dumpLocalVariables,
    getScopedVariable: (scope, key) => scope === "global" ? globalVariables[key] : getLocalVariable(key),
    setScopedVariable: (scope, key, value) => {
      if (scope === "global") { setGlobalVariable(key, value); return; }
      setLocalVariable(key, value);
    },
    deleteScopedVariable: (scope, key) => {
      if (scope === "global") { deleteGlobalVariable(key); return; }
      deleteLocalVariable(key);
    },
    listScopedVariables: (scope) => scope === "global"
      ? Object.keys(globalVariables)
      : listLocalVariables(),
    dumpScopedVariables: (scope) => scope === "global"
      ? { ...globalVariables }
      : dumpLocalVariables(),
    getPreset,
    setPreset,
    listPresets,
    listPromptEntries,
    setPromptEntriesEnabled,
    setMessageRole: async (index, role) => {
      const message = ctx.messages[index];
      if (!message) throw new Error(`/message-role message index out of range: ${index}`);
      message.role = role;
    },
    setMessageName: async (index, name) => {
      const message = ctx.messages[index];
      if (!message) throw new Error(`/message-name message index out of range: ${index}`);
      message.name = name;
    },
    getMessageReasoning: promptInjection.getMessageReasoning,
    setMessageReasoning: promptInjection.setMessageReasoning,
    parseReasoningBlock: _nav.onParseReasoningBlock,
    applyReasoningRegex: _nav.onApplyReasoningRegex,
    injectPrompt: promptInjection.injectPrompt,
    listPromptInjections: promptInjection.listInjectedPrompts,
    removePromptInjections: promptInjection.removeInjectedPrompts,
    ...audio,
    getWorldInfoTimedEffect: onGetWorldInfoTimedEffect,
    setWorldInfoTimedEffect: onSetWorldInfoTimedEffect,
    ...loreRegexAdapters,
  };

  executionContext.runSlashCommand = async (script: string) => {
    const result = await executeSlashCommandScript(script, executionContext);
    if (result.isError) {
      throw new Error(result.errorMessage || "runSlashCommand failed");
    }
    return result.pipe;
  };

  return executionContext;
}
