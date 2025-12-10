/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Runner API Shim                              ║
 * ║                                                                            ║
 * ║  注入到 iframe 沙箱中，提供以下能力：                                         ║
 * ║  • window.DreamMiniStage - 新版 API                                        ║
 * ║  • window.TavernHelper - 兼容 SillyTavern 的 API                          ║
 * ║  • window.SillyTavern - 兼容层                                            ║
 * ║  • 高度自动更新                                                            ║
 * ║  • 父子窗口消息通信                                                        ║
 * ║                                                                            ║
 * ║  Requirements: 9.1, 9.2, 9.3, 9.4, 9.5                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

(function() {
  "use strict";

  // ════════════════════════════════════════════════════════════════════════
  //  基础设施
  // ════════════════════════════════════════════════════════════════════════

  var pending = new Map();
  var variableCache = {};
  var sessionContext = {
    characterId: null,
    sessionId: null,
    chatId: null
  };

  function createId() {
    return "sr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  function sendMessage(type, payload) {
    var msg = {
      type: type,
      payload: payload,
      id: payload && payload.id,
      timestamp: Date.now(),
      origin: window.location.origin
    };
    console.log("[SlashRunner:sendMessage] 发送消息到父窗口:", type, "id:", msg.id, "payload:", payload);
    window.parent.postMessage(msg, "*");
  }

  // ════════════════════════════════════════════════════════════════════════
  //  未实现方法警告（Requirements 9.4）
  // ════════════════════════════════════════════════════════════════════════

  function warnUnimplemented(methodName, returnValue) {
    console.warn("[TavernHelper] Method '" + methodName + "' is not implemented in DreamMiniStage. Returning default value.");
    return returnValue;
  }

  function createStub(methodName, defaultReturn) {
    return function() {
      return warnUnimplemented(methodName, defaultReturn);
    };
  }

  function createAsyncStub(methodName, defaultReturn) {
    return function() {
      return Promise.resolve(warnUnimplemented(methodName, defaultReturn));
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  高度更新：参考 JS-Slash-Runner 的实现
  //  核心策略：scheduled 锁 + rAF 去抖 + 纯 ResizeObserver（不用 MutationObserver subtree）
  // ════════════════════════════════════════════════════════════════════════

  var scheduled = false;
  var lastReportedHeight = 0;

  function measureAndPost() {
    scheduled = false;
    var body = document.body;
    if (!body) return;

    var h = body.scrollHeight || 0;
    if (h <= 0 || Math.abs(h - lastReportedHeight) < 5) return;

    lastReportedHeight = h;
    sendMessage("HEIGHT_UPDATE", { height: h });
  }

  function postHeight() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(measureAndPost);
  }

  function setupHeightObserver() {
    var body = document.body;

    function observe() {
      var resizeObserver = new ResizeObserver(postHeight);
      resizeObserver.observe(document.body);

      var mutationObserver = new MutationObserver(function() {
        resizeObserver.disconnect();
        resizeObserver.observe(document.body);
        for (var i = 0; i < document.body.children.length; i++) {
          resizeObserver.observe(document.body.children[i]);
        }
      });
      mutationObserver.observe(document.body, { childList: true, subtree: false, attributes: false });

      postHeight();
    }

    if (body) {
      observe();
    } else {
      document.addEventListener("DOMContentLoaded", observe);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  API 调用
  // ════════════════════════════════════════════════════════════════════════

  function callApi(method, args) {
    return new Promise(function(resolve, reject) {
      var id = createId();
      console.log("[SlashRunner:callApi] 发起调用:", method, "id:", id, "args:", args);
      pending.set(id, { resolve: resolve, reject: reject });
      sendMessage("API_CALL", { method: method, args: args, id: id });
      setTimeout(function() {
        if (pending.has(id)) {
          console.warn("[SlashRunner:callApi] 超时:", method, "id:", id);
          pending.delete(id);
          reject(new Error("API_CALL timeout: " + method));
        }
      }, 240000);
    });
  }

  function log() {
    var args = Array.prototype.slice.call(arguments);
    var message = args.map(function(arg) {
      return typeof arg === "object" ? JSON.stringify(arg) : String(arg);
    }).join(" ");
    console.log("[SlashRunner]", message);
    sendMessage("CONSOLE_LOG", { message: message, args: args });
  }

  function api(method) {
    return function() {
      return callApi(method, Array.prototype.slice.call(arguments));
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  事件系统：本地 handler 注册表
  //  设计：本地维护 handler 映射，通过 handlerId 与主应用通信
  // ════════════════════════════════════════════════════════════════════════

  var eventHandlers = new Map();
  var handlerIdCounter = 0;
  var iframeId = "iframe_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

  function generateHandlerId() {
    return "h_" + (++handlerIdCounter) + "_" + Date.now();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  DreamMiniStage API（新版）
  // ════════════════════════════════════════════════════════════════════════

  window.DreamMiniStage = {
    version: "1.0.0",
    variables: {
      get: function(key) { return variableCache[key]; },
      set: function(key, value) {
        variableCache[key] = value;
        sendMessage("API_CALL", { method: "setVariable", args: [key, value] });
      },
      delete: function(key) {
        delete variableCache[key];
        sendMessage("API_CALL", { method: "deleteVariable", args: [key] });
      },
      list: function() { return Object.keys(variableCache); }
    },
    events: {
      on: function(event, handler) {
        var handlerId = generateHandlerId();
        eventHandlers.set(handlerId, { event: event, handler: handler, once: false });
        window.addEventListener("DreamMiniStage:" + event, function(e) { handler(e.detail); });
        callApi("eventOn", [event, handlerId, iframeId]);
        return { stop: function() { window.DreamMiniStage.events.off(event, handlerId); } };
      },
      once: function(event, handler) {
        var handlerId = generateHandlerId();
        var wrapper = function(e) {
          handler(e.detail);
          window.removeEventListener("DreamMiniStage:" + event, wrapper);
          eventHandlers.delete(handlerId);
        };
        eventHandlers.set(handlerId, { event: event, handler: wrapper, once: true });
        window.addEventListener("DreamMiniStage:" + event, wrapper);
        callApi("eventOnce", [event, handlerId, iframeId]);
        return { stop: function() { window.DreamMiniStage.events.off(event, handlerId); } };
      },
      off: function(event, handlerId) {
        if (handlerId && eventHandlers.has(handlerId)) {
          eventHandlers.delete(handlerId);
          callApi("eventRemoveListener", [event, handlerId, iframeId]);
        }
      },
      emit: function(event, data) {
        window.dispatchEvent(new CustomEvent("DreamMiniStage:" + event, { detail: data }));
        return callApi("eventEmit", [event, data]);
      }
    },
    utils: {
      log: log,
      waitFor: function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  //  TavernHelper API（兼容层）
  //  Requirements: 9.1, 9.3
  // ════════════════════════════════════════════════════════════════════════

  window.TavernHelper = {
    // ──────────────────────────────────────────────────────────────────────
    //  变量 API（Requirements 2.1-2.5）
    // ──────────────────────────────────────────────────────────────────────
    variables: {
      get: function(key) { return window.DreamMiniStage.variables.get(key); },
      set: function(key, value) { window.DreamMiniStage.variables.set(key, value); },
      delete: function(key) { window.DreamMiniStage.variables.delete(key); },
      list: function() { return window.DreamMiniStage.variables.list(); }
    },
    getVariables: api("getVariables"),
    replaceVariables: api("replaceVariables"),
    insertOrAssignVariables: api("insertOrAssignVariables"),
    deleteVariable: api("deleteVariable"),
    getVariable: api("getVariable"),
    setVariable: api("setVariable"),

    // ──────────────────────────────────────────────────────────────────────
    //  事件 API（Requirements 3.1-3.5）
    // ──────────────────────────────────────────────────────────────────────
    events: {
      on: function(e, h) { return window.DreamMiniStage.events.on(e, h); },
      once: function(e, h) { return window.DreamMiniStage.events.once(e, h); },
      off: function(e, h) { window.DreamMiniStage.events.off(e, h); },
      emit: function(e, d) { return window.DreamMiniStage.events.emit(e, d); }
    },
    eventOn: function(event, handler) { return window.DreamMiniStage.events.on(event, handler); },
    eventOnce: function(event, handler) { return window.DreamMiniStage.events.once(event, handler); },
    eventRemoveListener: function(event, handlerId) { window.DreamMiniStage.events.off(event, handlerId); },
    eventEmit: function(event) {
      var data = Array.prototype.slice.call(arguments, 1);
      return callApi("eventEmit", [event].concat(data));
    },

    // ──────────────────────────────────────────────────────────────────────
    //  消息 API（Requirements 4.1-4.5）
    // ──────────────────────────────────────────────────────────────────────
    getChatMessages: api("getChatMessages"),
    setChatMessages: api("setChatMessages"),
    createChatMessages: api("createChatMessages"),
    deleteChatMessages: api("deleteChatMessages"),
    getCurrentMessageId: api("getCurrentMessageId"),

    // ──────────────────────────────────────────────────────────────────────
    //  生成控制 API（Requirements 6.1-6.5）
    // ──────────────────────────────────────────────────────────────────────
    generate: api("generate"),
    generateRaw: api("generateRaw"),
    stopGenerationById: api("stopGenerationById"),
    stopAllGeneration: api("stopAllGeneration"),

    // ──────────────────────────────────────────────────────────────────────
    //  Worldbook API（Requirements 5.1-5.5）
    // ──────────────────────────────────────────────────────────────────────
    getWorldbookNames: api("getWorldbookNames"),
    getGlobalWorldbookNames: api("getGlobalWorldbookNames"),
    rebindGlobalWorldbooks: api("worldbook.rebindGlobalWorldbooks"),
    getCharWorldbookNames: api("worldbook.getCharWorldbookNames"),
    rebindCharWorldbooks: api("worldbook.rebindCharWorldbooks"),
    getChatWorldbookName: api("worldbook.getChatWorldbookName"),
    rebindChatWorldbook: api("worldbook.rebindChatWorldbook"),
    getOrCreateChatWorldbook: api("worldbook.getOrCreateChatWorldbook"),
    createWorldbook: api("worldbook.createWorldbook"),
    createOrReplaceWorldbook: api("worldbook.createOrReplaceWorldbook"),
    deleteWorldbook: api("worldbook.deleteWorldbook"),
    replaceWorldbook: api("worldbook.replaceWorldbook"),
    updateWorldbookWith: api("worldbook.updateWorldbookWith"),
    createWorldbookEntries: api("worldbook.createWorldbookEntries"),
    deleteWorldbookEntries: api("worldbook.deleteWorldbookEntries"),
    importWorldbookFromJson: api("worldbook.importJson"),
    exportWorldbook: api("worldbook.export"),
    saveAsGlobalWorldbook: api("worldbook.saveAsGlobal"),
    importFromGlobalWorldbook: api("worldbook.importFromGlobal"),
    deleteGlobalWorldbook: api("worldbook.deleteGlobal"),

    // ──────────────────────────────────────────────────────────────────────
    //  Lorebook API（旧版兼容，Requirements 5.1-5.5）
    // ──────────────────────────────────────────────────────────────────────
    getLorebookNames: api("lorebook.getNames"),
    getLorebookEntries: api("lorebook.getEntries"),
    createLorebookEntry: api("lorebook.createEntry"),
    createLorebookEntries: api("lorebook.createEntries"),
    deleteLorebookEntry: api("lorebook.deleteEntry"),
    deleteLorebookEntries: api("lorebook.deleteEntries"),
    updateLorebookEntriesWith: api("lorebook.updateEntriesWith"),
    updateLorebookEntry: api("lorebook.updateEntry"),
    replaceLorebookEntries: api("lorebook.replaceEntries"),
    setLorebookEntries: api("lorebook.setEntries"),
    getLorebookSettings: api("lorebook.getSettings"),

    // ──────────────────────────────────────────────────────────────────────
    //  Preset API（Requirements 7.1-7.5）
    // ──────────────────────────────────────────────────────────────────────
    getPresetNames: api("preset.getPresetNames"),
    getPreset: api("preset.getPreset"),
    loadPreset: api("preset.loadPreset"),
    createPreset: api("preset.createPreset"),
    deletePreset: api("preset.deletePreset"),
    createOrReplacePreset: api("preset.createOrReplacePreset"),
    renamePreset: api("preset.renamePreset"),
    replacePreset: api("preset.replacePreset"),
    updatePresetWith: api("preset.updatePresetWith"),
    setPreset: api("preset.setPreset"),
    getOrderedPrompts: api("preset.getOrderedPrompts"),
    getLoadedPresetName: api("preset.getLoadedPresetName"),
    importPreset: api("preset.importPreset"),

    // ──────────────────────────────────────────────────────────────────────
    //  Slash Command API（Requirements 1.1-1.5, 8.1-8.4）
    // ──────────────────────────────────────────────────────────────────────
    triggerSlash: api("triggerSlash"),
    triggerSlashWithResult: api("triggerSlashWithResult"),

    // ──────────────────────────────────────────────────────────────────────
    //  Quick Reply API（Requirements 8.1-8.4）
    //  注：DreamMiniStage 中 Quick Reply 通过 Slash Command 实现
    // ──────────────────────────────────────────────────────────────────────
    getQuickReplySetNames: createAsyncStub("getQuickReplySetNames", []),
    getQuickReplySet: createAsyncStub("getQuickReplySet", null),
    createQuickReplySet: createAsyncStub("createQuickReplySet", null),
    deleteQuickReplySet: createAsyncStub("deleteQuickReplySet", false),
    updateQuickReplySet: createAsyncStub("updateQuickReplySet", false),
    executeQuickReply: function(setName, label) {
      // 映射到 triggerSlash
      return callApi("triggerSlash", ["/" + label]);
    },

    // ──────────────────────────────────────────────────────────────────────
    //  角色 API（部分实现）
    // ──────────────────────────────────────────────────────────────────────
    getCharacterNames: createAsyncStub("getCharacterNames", []),
    getCharacter: createAsyncStub("getCharacter", null),
    getCurrentCharacter: function() {
      return Promise.resolve(sessionContext.characterId ? { id: sessionContext.characterId } : null);
    },

    // ──────────────────────────────────────────────────────────────────────
    //  群聊 API（未实现，返回默认值）
    // ──────────────────────────────────────────────────────────────────────
    getGroupMembers: createAsyncStub("getGroupMembers", []),
    isGroupChat: createStub("isGroupChat", false),

    // ──────────────────────────────────────────────────────────────────────
    //  工具方法
    // ──────────────────────────────────────────────────────────────────────
    utils: { log: log, waitFor: function(ms) { return window.DreamMiniStage.utils.waitFor(ms); } },
    log: log,

    // ──────────────────────────────────────────────────────────────────────
    //  上下文获取
    // ──────────────────────────────────────────────────────────────────────
    getContext: function() {
      return {
        variables: Object.assign({}, variableCache),
        characterId: sessionContext.characterId,
        sessionId: sessionContext.sessionId,
        chatId: sessionContext.chatId,
        iframeId: iframeId
      };
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  //  全局兼容：直接挂到 window 的旧用法
  // ════════════════════════════════════════════════════════════════════════

  // 消息 API
  window.getChatMessages = window.TavernHelper.getChatMessages;
  window.setChatMessages = window.TavernHelper.setChatMessages;
  window.createChatMessages = window.TavernHelper.createChatMessages;
  window.deleteChatMessages = window.TavernHelper.deleteChatMessages;
  window.getCurrentMessageId = window.TavernHelper.getCurrentMessageId;

  // 事件 API
  window.eventEmit = window.TavernHelper.eventEmit;
  window.eventOn = window.TavernHelper.eventOn;
  window.eventOnce = window.TavernHelper.eventOnce;
  window.eventRemoveListener = window.TavernHelper.eventRemoveListener;

  // Slash API
  window.triggerSlash = window.TavernHelper.triggerSlash;
  window.triggerSlashWithResult = window.TavernHelper.triggerSlashWithResult;

  // 变量 API
  window.getVariables = window.TavernHelper.getVariables;
  window.replaceVariables = window.TavernHelper.replaceVariables;
  window.insertOrAssignVariables = window.TavernHelper.insertOrAssignVariables;
  window.deleteVariable = window.TavernHelper.deleteVariable;
  window.getVariable = window.TavernHelper.getVariable;
  window.setVariable = window.TavernHelper.setVariable;

  // ════════════════════════════════════════════════════════════════════════
  //  SillyTavern 兼容层（Requirements 9.2）
  // ════════════════════════════════════════════════════════════════════════

  window.SillyTavern = {
    /**
     * getContext - 返回当前会话上下文
     * Requirements 9.2: WHEN an iframe script accesses `window.SillyTavern.getContext()`
     * THEN the System SHALL return a context object with current session information
     */
    getContext: function() {
      return {
        // 变量
        variables: Object.assign({}, variableCache),
        // 会话信息
        characterId: sessionContext.characterId,
        sessionId: sessionContext.sessionId,
        chatId: sessionContext.chatId,
        // 兼容 SillyTavern 的字段名
        chat: sessionContext.chatId,
        characterName: sessionContext.characterId,
        // iframe 标识
        iframeId: iframeId,
        // API 版本
        apiVersion: "1.0.0"
      };
    },

    /**
     * registerFunctionTool - 注册函数工具（未实现）
     */
    registerFunctionTool: createStub("registerFunctionTool", undefined),

    /**
     * registerSlashCommand - 注册自定义 Slash 命令（未实现）
     */
    registerSlashCommand: createStub("registerSlashCommand", undefined),

    /**
     * getApiUrl - 获取 API URL（未实现）
     */
    getApiUrl: createStub("getApiUrl", ""),

    /**
     * getRequestHeaders - 获取请求头（未实现）
     */
    getRequestHeaders: createStub("getRequestHeaders", {})
  };

  // ════════════════════════════════════════════════════════════════════════
  //  消息监听
  // ════════════════════════════════════════════════════════════════════════

  window.addEventListener("message", function(e) {
    if (!e.data) return;

    switch (e.data.type) {
      case "EVENT_EMIT":
        var eventPayload = e.data.payload;
        window.dispatchEvent(new CustomEvent("DreamMiniStage:" + eventPayload.eventName, { detail: eventPayload.data }));
        break;

      case "UPDATE_VARIABLES":
        Object.assign(variableCache, e.data.payload);
        break;

      case "UPDATE_CONTEXT":
        // 更新会话上下文
        if (e.data.payload) {
          if (e.data.payload.characterId !== undefined) sessionContext.characterId = e.data.payload.characterId;
          if (e.data.payload.sessionId !== undefined) sessionContext.sessionId = e.data.payload.sessionId;
          if (e.data.payload.chatId !== undefined) sessionContext.chatId = e.data.payload.chatId;
        }
        break;

      case "API_RESPONSE":
        console.log("[SlashRunner:onMessage] 收到 API_RESPONSE:", "id:", e.data.id, "payload:", e.data.payload);
        if (e.data.id && pending.has(e.data.id)) {
          var handler = pending.get(e.data.id);
          pending.delete(e.data.id);
          if (e.data.payload && e.data.payload.error) {
            console.error("[SlashRunner:onMessage] API 调用失败:", e.data.payload.error);
            handler.reject(new Error(e.data.payload.error));
          } else {
            console.log("[SlashRunner:onMessage] API 调用成功:", e.data.payload && e.data.payload.result);
            handler.resolve(e.data.payload && e.data.payload.result);
          }
        } else {
          console.warn("[SlashRunner:onMessage] 收到未知 id 的响应:", e.data.id, "pending keys:", Array.from(pending.keys()));
        }
        break;
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  //  初始化
  // ════════════════════════════════════════════════════════════════════════

  setupHeightObserver();

  // 通知父窗口 shim 已加载
  sendMessage("SHIM_READY", { iframeId: iframeId, version: "1.0.0" });

})();
