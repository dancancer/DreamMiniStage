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
    chatId: null,
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
      origin: window.location.origin,
    };
    console.log("[SlashRunner:sendMessage] 发送消息到父窗口:", type, "id:", msg.id, "payload:", payload);
    window.parent.postMessage(msg, "*");
  }

  // ════════════════════════════════════════════════════════════════════════
  //  显式失败：开发期不做静默兜底
  // ════════════════════════════════════════════════════════════════════════

  function unsupportedSync(methodName) {
    return function() {
      throw new Error("[TavernHelper] Unsupported API in DreamMiniStage: " + methodName);
    };
  }

  function unsupportedAsync(methodName) {
    return function() {
      return Promise.reject(new Error("[TavernHelper] Unsupported API in DreamMiniStage: " + methodName));
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

  function ensureNonEmptyString(value, apiName, argName) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error("[" + apiName + "] " + argName + " must be a non-empty string");
    }
    return value.trim();
  }

  function normalizeLorebookBinding(value) {
    if (!value || typeof value !== "object") {
      return {
        primary: null,
        additional: [],
      };
    }

    var primary = typeof value.primary === "string" && value.primary.length > 0
      ? value.primary
      : null;
    var additional = Array.isArray(value.additional)
      ? value.additional.filter(function(item) {
        return typeof item === "string" && item.length > 0;
      })
      : [];

    return {
      primary: primary,
      additional: additional,
    };
  }

  function normalizeWorldbookEntries(worldbookName, rawWorldbook) {
    if (!rawWorldbook || typeof rawWorldbook !== "object") {
      throw new Error("[getWorldbook] worldbook not found: " + worldbookName);
    }

    var entryIds = Object.keys(rawWorldbook).sort(function(left, right) {
      var leftOrder = Number.parseInt(String(left).replace(/^entry_/, ""), 10);
      var rightOrder = Number.parseInt(String(right).replace(/^entry_/, ""), 10);
      if (Number.isFinite(leftOrder) && Number.isFinite(rightOrder)) {
        return leftOrder - rightOrder;
      }
      return String(left).localeCompare(String(right));
    });

    return entryIds.map(function(entryId) {
      var value = rawWorldbook[entryId];
      if (!value || typeof value !== "object") {
        return {
          entry_id: entryId,
          content: "",
          keys: [],
        };
      }

      return Object.assign(
        {
          entry_id: entryId,
        },
        value,
      );
    });
  }

  var macroLikeRegistry = [];

  function ensureRegExp(value, apiName, argName) {
    if (!(value instanceof RegExp)) {
      throw new Error("[" + apiName + "] " + argName + " must be RegExp");
    }
    return value;
  }

  function normalizeMacroLikeContext(value) {
    if (!value || typeof value !== "object") {
      return {};
    }
    return value;
  }

  function applyRegisteredMacroLikes(text, context) {
    return macroLikeRegistry.reduce(function(acc, macro) {
      var runtimeRegex = new RegExp(macro.source, macro.flags);
      return acc.replace(runtimeRegex, function() {
        var replaceArgs = Array.prototype.slice.call(arguments);
        var matchedText = replaceArgs[0];
        var captureEnd = replaceArgs.length - 2;
        var lastArg = replaceArgs[replaceArgs.length - 1];
        if (lastArg && typeof lastArg === "object") {
          captureEnd -= 1;
        }
        var captures = replaceArgs.slice(1, captureEnd);
        var replaced = macro.replaceFn.apply(null, [context, matchedText].concat(captures));
        return replaced == null ? "" : String(replaced);
      });
    }, text);
  }

  function normalizeCharacterQueryName(name, apiName) {
    if (name === undefined || name === null || name === "") {
      return "current";
    }
    if (typeof name !== "string") {
      throw new Error("[" + apiName + "] name must be string");
    }
    return name;
  }

  function ensureOptionalBoolean(value, apiName, argName) {
    if (value !== undefined && typeof value !== "boolean") {
      throw new Error("[" + apiName + "] " + argName + " must be boolean");
    }
  }

  function loadCharacterDataByName(name) {
    if (name === "current") {
      return callApi("getCurrentCharacter", []);
    }
    return callApi("getCharacter", [name]);
  }

  function readCharacterAvatarPath(characterData) {
    if (!characterData || typeof characterData !== "object") {
      return null;
    }

    var candidates = [
      characterData.avatar,
      characterData.avatarPath,
      characterData.avatar_path,
      characterData.imagePath,
      characterData.image_path,
    ];

    for (var i = 0; i < candidates.length; i++) {
      var value = candidates[i];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }

    return null;
  }

  function RawCharacter(characterData) {
    if (!characterData || typeof characterData !== "object") {
      throw new Error("[RawCharacter] characterData must be object");
    }
    this.characterData = characterData;
  }

  RawCharacter.find = function(options) {
    var normalizedOptions = options || {};
    var targetName = normalizeCharacterQueryName(normalizedOptions.name, "RawCharacter.find");
    var allowAvatar = normalizedOptions.allow_avatar;
    ensureOptionalBoolean(allowAvatar, "RawCharacter.find", "allow_avatar");
    return loadCharacterDataByName(targetName);
  };

  RawCharacter.getChatsFromFiles = function(data, isGroupChat) {
    if (!Array.isArray(data)) {
      throw new Error("[RawCharacter.getChatsFromFiles] data must be array");
    }
    ensureOptionalBoolean(isGroupChat, "RawCharacter.getChatsFromFiles", "isGroupChat");
    return window.TavernHelper.getChatHistoryDetail(data, Boolean(isGroupChat));
  };

  RawCharacter.prototype.getCardData = function() {
    return this.characterData;
  };

  RawCharacter.prototype.getAvatarId = function() {
    var avatarPath = readCharacterAvatarPath(this.characterData);
    return avatarPath || "";
  };

  RawCharacter.prototype.getRegexScripts = function() {
    var data = this.characterData && this.characterData.data;
    var extensions = data && data.extensions;
    var regexScripts = extensions && extensions.regex_scripts;
    return Array.isArray(regexScripts) ? regexScripts : [];
  };

  RawCharacter.prototype.getCharacterBook = function() {
    var data = this.characterData && this.characterData.data;
    var characterBook = data && data.character_book;
    return characterBook && typeof characterBook === "object" ? characterBook : null;
  };

  RawCharacter.prototype.getWorldName = function() {
    var data = this.characterData && this.characterData.data;
    var extensions = data && data.extensions;
    var worldName = extensions && extensions.world;
    return typeof worldName === "string" ? worldName : "";
  };

  // ════════════════════════════════════════════════════════════════════════
  //  事件系统：本地 handler 注册表
  //  设计：本地维护 handler 映射，通过 handlerId 与主应用通信
  // ════════════════════════════════════════════════════════════════════════

  var eventHandlers = new Map();
  var handlerIdCounter = 0;
  var iframeId = "iframe_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

  // ════════════════════════════════════════════════════════════════════════
  //  Function Tool 本地回调注册表
  // ════════════════════════════════════════════════════════════════════════

  var functionToolCallbacks = {};
  var slashCommandBridge = createSlashCommandBridge({
    callApi: callApi,
    iframeId: iframeId,
    sendMessage: sendMessage,
  });

  function generateHandlerId() {
    return "h_" + (++handlerIdCounter) + "_" + Date.now();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Slash 回调桥接：注册与执行解耦
  // ════════════════════════════════════════════════════════════════════════

  function getSlashCommandCallbacks() {
    if (!window._slashCommandCallbacks) {
      window._slashCommandCallbacks = {};
    }
    return window._slashCommandCallbacks;
  }

  function createSlashCommandBridge(options) {
    function register(definition) {
      if (definition && typeof definition.callback === "function") {
        var cmdName = definition.name;
        var callback = definition.callback;
        var callbacks = getSlashCommandCallbacks();
        callbacks[cmdName] = callback;

        if (Array.isArray(definition.aliases)) {
          definition.aliases.forEach(function(alias) {
            if (typeof alias === "string" && alias.length > 0) {
              callbacks[alias] = callback;
            }
          });
        }

        var defCopy = Object.assign({}, definition);
        delete defCopy.callback;
        defCopy.hasCallback = true;
        defCopy.iframeId = options.iframeId;
        return options.callApi("registerSlashCommand", [defCopy]);
      }

      if (definition && !definition.iframeId) {
        var plainDef = Object.assign({}, definition);
        plainDef.iframeId = options.iframeId;
        return options.callApi("registerSlashCommand", [plainDef]);
      }

      return options.callApi("registerSlashCommand", [definition]);
    }

    function handleCall(payload) {
      var scPayload = payload || {};
      var commandName = scPayload.name;
      var slashCallbackId = scPayload.callbackId;
      var slashArgs = scPayload.args || "";
      var slashUnnamedArgs = Array.isArray(scPayload.unnamedArgs) ? scPayload.unnamedArgs : [];
      var slashNamedArgs = scPayload.namedArgs || {};
      var slashContext = scPayload.context || {};
      var slashNamedArgumentList = Array.isArray(scPayload.namedArgumentList)
        ? scPayload.namedArgumentList
        : Object.keys(slashNamedArgs).map(function(name) {
          return {
            name: name,
            value: slashNamedArgs[name],
            isRequired: false,
          };
        });
      var slashUnnamedArgumentList = Array.isArray(scPayload.unnamedArgumentList)
        ? scPayload.unnamedArgumentList
        : slashUnnamedArgs.map(function(value) {
          return {
            value: value,
            isRequired: false,
          };
        });
      var slashRuntimeContext = Object.assign({}, slashContext, {
        pipe: scPayload.pipe || "",
        unnamedArgs: slashUnnamedArgs,
        namedArgumentList: slashNamedArgumentList,
        unnamedArgumentList: slashUnnamedArgumentList,
      });

      var slashCallbacks = getSlashCommandCallbacks();
      var slashCallback = slashCallbacks[commandName];
      if (!slashCallback) {
        options.sendMessage("SLASH_COMMAND_RESULT", {
          callbackId: slashCallbackId,
          error: "Slash command callback not found: " + commandName,
        });
        return;
      }

      try {
        var slashResult = slashCallback(slashArgs, slashNamedArgs, slashRuntimeContext);
        Promise.resolve(slashResult).then(function(res) {
          options.sendMessage("SLASH_COMMAND_RESULT", { callbackId: slashCallbackId, result: res });
        }).catch(function(err) {
          options.sendMessage("SLASH_COMMAND_RESULT", { callbackId: slashCallbackId, error: err.message || String(err) });
        });
      } catch (err) {
        options.sendMessage("SLASH_COMMAND_RESULT", { callbackId: slashCallbackId, error: err.message || String(err) });
      }
    }

    return {
      register: register,
      handleCall: handleCall,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  消息分发：按类型路由，避免单个巨型 switch 继续膨胀
  // ════════════════════════════════════════════════════════════════════════

  function handleFunctionToolCallMessage(payload, callbacks, sendMessageFn) {
    var ftPayload = payload || {};
    var toolName = ftPayload.name;
    var toolArgs = ftPayload.args || {};
    var callbackId = ftPayload.callbackId;

    console.log("[SlashRunner] FUNCTION_TOOL_CALL:", toolName, "callbackId:", callbackId);

    var callback = callbacks[toolName];
    if (!callback) {
      sendMessageFn("FUNCTION_TOOL_RESULT", { callbackId: callbackId, error: "Function tool not found: " + toolName });
      return;
    }

    try {
      var result = callback(toolArgs);
      Promise.resolve(result).then(function(res) {
        sendMessageFn("FUNCTION_TOOL_RESULT", { callbackId: callbackId, result: res });
      }).catch(function(err) {
        sendMessageFn("FUNCTION_TOOL_RESULT", { callbackId: callbackId, error: err.message || String(err) });
      });
    } catch (err) {
      sendMessageFn("FUNCTION_TOOL_RESULT", { callbackId: callbackId, error: err.message || String(err) });
    }
  }

  function createMessageDispatcher(options) {
    var handlers = {
      EVENT_EMIT: function(data) {
        var eventPayload = data.payload;
        window.dispatchEvent(new CustomEvent("DreamMiniStage:" + eventPayload.eventName, { detail: eventPayload.data }));
      },
      UPDATE_VARIABLES: function(data) {
        Object.assign(options.variableCache, data.payload);
      },
      UPDATE_CONTEXT: function(data) {
        if (!data.payload) {
          return;
        }
        if (data.payload.characterId !== undefined) options.sessionContext.characterId = data.payload.characterId;
        if (data.payload.sessionId !== undefined) options.sessionContext.sessionId = data.payload.sessionId;
        if (data.payload.chatId !== undefined) options.sessionContext.chatId = data.payload.chatId;
      },
      FUNCTION_TOOL_CALL: function(data) {
        handleFunctionToolCallMessage(data.payload, options.functionToolCallbacks, options.sendMessage);
      },
      SLASH_COMMAND_CALL: function(data) {
        options.slashCommandBridge.handleCall(data.payload);
      },
      API_RESPONSE: function(data) {
        console.log("[SlashRunner:onMessage] 收到 API_RESPONSE:", "id:", data.id, "payload:", data.payload);
        if (data.id && options.pending.has(data.id)) {
          var handler = options.pending.get(data.id);
          options.pending.delete(data.id);
          if (data.payload && data.payload.error) {
            console.error("[SlashRunner:onMessage] API 调用失败:", data.payload.error);
            handler.reject(new Error(data.payload.error));
          } else {
            console.log("[SlashRunner:onMessage] API 调用成功:", data.payload && data.payload.result);
            handler.resolve(data.payload && data.payload.result);
          }
        } else {
          console.warn("[SlashRunner:onMessage] 收到未知 id 的响应:", data.id, "pending keys:", Array.from(options.pending.keys()));
        }
      },
    };

    return function onMessage(e) {
      if (!e.data || !e.data.type) {
        return;
      }
      var handler = handlers[e.data.type];
      if (handler) {
        handler(e.data);
      }
    };
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
      list: function() { return Object.keys(variableCache); },
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
      },
    },
    utils: {
      log: log,
      waitFor: function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); },
    },
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
      list: function() { return window.DreamMiniStage.variables.list(); },
    },
    getVariables: api("getVariables"),
    replaceVariables: api("replaceVariables"),
    registerVariableSchema: api("registerVariableSchema"),
    updateVariablesWith: function(updater, option) {
      if (typeof updater !== "function") {
        throw new Error("updateVariablesWith 需要 updater 函数参数");
      }

      return callApi("getVariables", [option]).then(function(currentVariables) {
        return Promise.resolve(updater(currentVariables)).then(function(nextVariables) {
          if (!nextVariables || typeof nextVariables !== "object" || Array.isArray(nextVariables)) {
            throw new Error("updateVariablesWith 的 updater 必须返回 plain object");
          }
          return callApi("updateVariablesWith", [nextVariables, option]);
        });
      });
    },
    insertOrAssignVariables: api("insertOrAssignVariables"),
    insertVariables: api("insertVariables"),
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
      emit: function(e, d) { return window.DreamMiniStage.events.emit(e, d); },
    },
    eventOn: function(event, handler) { return window.DreamMiniStage.events.on(event, handler); },
    eventOnce: function(event, handler) { return window.DreamMiniStage.events.once(event, handler); },
    eventRemoveListener: function(event, handlerId) { window.DreamMiniStage.events.off(event, handlerId); },
    eventEmit: function(event) {
      var data = Array.prototype.slice.call(arguments, 1);
      return callApi("eventEmit", [event].concat(data));
    },

    // ──────────────────────────────────────────────────────────────────────
    //  全局共享 API（JS-Slash-Runner 兼容）
    // ──────────────────────────────────────────────────────────────────────
    initializeGlobal: function(globalName, value) {
      var normalizedName = ensureNonEmptyString(globalName, "initializeGlobal", "globalName");
      window[normalizedName] = value;
      window.dispatchEvent(
        new CustomEvent("DreamMiniStage:global_initialized:" + normalizedName, {
          detail: value,
        }),
      );
    },
    waitGlobalInitialized: function(globalName) {
      var normalizedName = ensureNonEmptyString(globalName, "waitGlobalInitialized", "globalName");
      if (Object.prototype.hasOwnProperty.call(window, normalizedName)) {
        return Promise.resolve(window[normalizedName]);
      }

      return new Promise(function(resolve) {
        var eventName = "DreamMiniStage:global_initialized:" + normalizedName;
        var listener = function() {
          window.removeEventListener(eventName, listener);
          resolve(window[normalizedName]);
        };
        window.addEventListener(eventName, listener);
      });
    },

    // ──────────────────────────────────────────────────────────────────────
    //  消息 API（Requirements 4.1-4.5）
    // ──────────────────────────────────────────────────────────────────────
    getChatMessages: api("getChatMessages"),
    setChatMessages: api("setChatMessages"),
    createChatMessages: api("createChatMessages"),
    deleteChatMessages: api("deleteChatMessages"),
    getCurrentMessageId: api("getCurrentMessageId"),
    formatAsDisplayedMessage: api("formatAsDisplayedMessage"),
    retrieveDisplayedMessage: api("retrieveDisplayedMessage"),

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
    setLorebookSettings: function(settings) {
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        throw new Error("[setLorebookSettings] settings must be a plain object");
      }

      if (!Object.prototype.hasOwnProperty.call(settings, "selected_global_lorebooks")) {
        throw new Error(
          "[setLorebookSettings] only selected_global_lorebooks is supported in host mode",
        );
      }

      var selectedGlobalLorebooks = settings.selected_global_lorebooks;
      if (!Array.isArray(selectedGlobalLorebooks)) {
        throw new Error("[setLorebookSettings] selected_global_lorebooks must be an array");
      }

      var normalizedNames = selectedGlobalLorebooks.map(function(item) {
        return ensureNonEmptyString(item, "setLorebookSettings", "selected_global_lorebooks[]");
      });
      return callApi("worldbook.rebindGlobalWorldbooks", [normalizedNames]).then(function() {
        return void 0;
      });
    },
    getLorebooks: api("getWorldbookNames"),
    createLorebook: function(lorebookName) {
      var normalizedName = ensureNonEmptyString(lorebookName, "createLorebook", "lorebookName");
      return callApi("worldbook.createWorldbook", [normalizedName, []]).then(function(result) {
        return typeof result === "string" && result.length > 0;
      });
    },
    deleteLorebook: function(lorebookName) {
      var normalizedName = ensureNonEmptyString(lorebookName, "deleteLorebook", "lorebookName");
      return callApi("worldbook.deleteWorldbook", [normalizedName]).then(function(result) {
        return !!result;
      });
    },
    getCharLorebooks: function(options) {
      var optionObject = options && typeof options === "object" && !Array.isArray(options)
        ? options
        : {};
      var target = optionObject.name === undefined ? "current" : optionObject.name;
      if (target !== "current") {
        target = ensureNonEmptyString(target, "getCharLorebooks", "options.name");
      }

      return callApi("worldbook.getCharWorldbookNames", [target]).then(function(binding) {
        return normalizeLorebookBinding(binding);
      });
    },
    setCurrentCharLorebooks: function(lorebooks) {
      if (!lorebooks || typeof lorebooks !== "object" || Array.isArray(lorebooks)) {
        throw new Error("[setCurrentCharLorebooks] lorebooks must be a plain object");
      }

      var payload = {};
      if (Object.prototype.hasOwnProperty.call(lorebooks, "primary")) {
        if (lorebooks.primary === null) {
          payload.primary = null;
        } else {
          payload.primary = ensureNonEmptyString(
            lorebooks.primary,
            "setCurrentCharLorebooks",
            "lorebooks.primary",
          );
        }
      }
      if (Object.prototype.hasOwnProperty.call(lorebooks, "additional")) {
        if (!Array.isArray(lorebooks.additional)) {
          throw new Error("[setCurrentCharLorebooks] lorebooks.additional must be an array");
        }
        payload.additional = lorebooks.additional.map(function(item) {
          return ensureNonEmptyString(item, "setCurrentCharLorebooks", "lorebooks.additional[]");
        });
      }

      return callApi("worldbook.rebindCharWorldbooks", ["current", payload]).then(function() {
        return void 0;
      });
    },
    getCurrentCharPrimaryLorebook: function() {
      return callApi("worldbook.getCharWorldbookNames", ["current"]).then(function(binding) {
        var normalized = normalizeLorebookBinding(binding);
        return normalized.primary;
      });
    },
    getChatLorebook: function() {
      return callApi("worldbook.getChatWorldbookName", ["current"]).then(function(lorebookName) {
        return typeof lorebookName === "string" && lorebookName.length > 0 ? lorebookName : null;
      });
    },
    setChatLorebook: function(lorebookName) {
      if (lorebookName !== null) {
        lorebookName = ensureNonEmptyString(lorebookName, "setChatLorebook", "lorebookName");
      }
      return callApi("worldbook.rebindChatWorldbook", ["current", lorebookName]).then(function() {
        return void 0;
      });
    },
    getOrCreateChatLorebook: function(lorebookName) {
      if (lorebookName !== undefined) {
        lorebookName = ensureNonEmptyString(
          lorebookName,
          "getOrCreateChatLorebook",
          "lorebookName",
        );
      }
      return callApi("worldbook.getOrCreateChatWorldbook", ["current", lorebookName]);
    },
    getWorldbook: function(worldbookName) {
      var normalizedName = ensureNonEmptyString(worldbookName, "getWorldbook", "worldbookName");
      return callApi("worldbook.export", [normalizedName]).then(function(rawWorldbook) {
        return normalizeWorldbookEntries(normalizedName, rawWorldbook);
      });
    },

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
    //  import_raw API（P3 高频迁移路径）
    // ──────────────────────────────────────────────────────────────────────
    importRawCharacter: api("importRawCharacter"),
    importRawPreset: api("importRawPreset"),
    importRawChat: api("importRawChat"),
    importRawWorldbook: api("importRawWorldbook"),
    importRawTavernRegex: api("importRawTavernRegex"),
    injectPrompts: unsupportedAsync("injectPrompts"),
    uninjectPrompts: unsupportedAsync("uninjectPrompts"),

    // ──────────────────────────────────────────────────────────────────────
    //  tavern_regex API（长尾兼容最小子集）
    // ──────────────────────────────────────────────────────────────────────
    formatAsTavernRegexedString: api("formatAsTavernRegexedString"),
    isCharacterTavernRegexesEnabled: api("isCharacterTavernRegexesEnabled"),
    getTavernRegexes: api("getTavernRegexes"),
    replaceTavernRegexes: api("replaceTavernRegexes"),
    updateTavernRegexesWith: function(updater, option) {
      if (typeof updater !== "function") {
        throw new Error("updateTavernRegexesWith 需要 updater 函数参数");
      }

      return callApi("getTavernRegexes", [option]).then(function(currentRegexes) {
        return Promise.resolve(updater(currentRegexes)).then(function(nextRegexes) {
          if (!Array.isArray(nextRegexes)) {
            throw new Error("updateTavernRegexesWith 的 updater 必须返回数组");
          }
          return callApi("replaceTavernRegexes", [nextRegexes, option]).then(function() {
            return nextRegexes;
          });
        });
      });
    },

    // ──────────────────────────────────────────────────────────────────────
    //  Slash Command API（Requirements 1.1-1.5, 8.1-8.4）
    // ──────────────────────────────────────────────────────────────────────
    triggerSlash: api("triggerSlash"),
    triggerSlashWithResult: api("triggerSlashWithResult"),

    // ──────────────────────────────────────────────────────────────────────
    //  Quick Reply API（Requirements 8.1-8.4）
    //  映射到服务端 handler，复用 Slash Command 基础设施
    // ──────────────────────────────────────────────────────────────────────
    getQuickReplySetNames: api("getQuickReplySetNames"),
    getQuickReplySet: api("getQuickReplySet"),
    createQuickReplySet: api("createQuickReplySet"),
    deleteQuickReplySet: api("deleteQuickReplySet"),
    updateQuickReplySet: api("updateQuickReplySet"),
    executeQuickReply: function(setName, label) {
      // 映射到 triggerSlash
      return callApi("triggerSlash", ["/" + label]);
    },

    // ──────────────────────────────────────────────────────────────────────
    //  角色 API
    // ──────────────────────────────────────────────────────────────────────
    getCharacterNames: api("getCharacterNames"),
    getCharacter: api("getCharacter"),
    getCurrentCharacter: api("getCurrentCharacter"),
    getCharacterById: api("getCharacterById"),
    getAllEnabledScriptButtons: api("getAllEnabledScriptButtons"),
    Character: RawCharacter,
    RawCharacter: RawCharacter,
    getCharData: function(name, allowAvatar) {
      var targetName = normalizeCharacterQueryName(name, "getCharData");
      ensureOptionalBoolean(allowAvatar, "getCharData", "allowAvatar");
      return loadCharacterDataByName(targetName);
    },
    getCharAvatarPath: function(name, allowAvatar) {
      var targetName = normalizeCharacterQueryName(name, "getCharAvatarPath");
      ensureOptionalBoolean(allowAvatar, "getCharAvatarPath", "allowAvatar");
      return window.TavernHelper.getCharData(targetName, allowAvatar).then(function(character) {
        if (!character) {
          return null;
        }
        return readCharacterAvatarPath(character);
      });
    },
    getChatHistoryBrief: function(name, allowAvatar) {
      var targetName = normalizeCharacterQueryName(name, "getChatHistoryBrief");
      ensureOptionalBoolean(allowAvatar, "getChatHistoryBrief", "allowAvatar");

      return window.TavernHelper.getCharData(targetName, allowAvatar).then(function(character) {
        if (!character) {
          return null;
        }
        return callApi("getChatMessages", []).then(function(messages) {
          var normalizedMessages = Array.isArray(messages) ? messages : [];
          var chatFileName = (sessionContext.chatId || sessionContext.sessionId || "current-chat") + ".jsonl";
          return [{
            file_name: chatFileName,
            message_count: normalizedMessages.length,
            character_name: character.name || targetName,
            is_current_chat: true,
          }];
        });
      });
    },
    getChatHistoryDetail: function(data, isGroupChat) {
      if (!Array.isArray(data)) {
        throw new Error("[getChatHistoryDetail] data must be array");
      }
      if (isGroupChat !== undefined && typeof isGroupChat !== "boolean") {
        throw new Error("[getChatHistoryDetail] isGroupChat must be boolean");
      }
      return callApi("getChatMessages", []).then(function(messages) {
        var normalizedMessages = Array.isArray(messages) ? messages : [];
        var mappedMessages = normalizedMessages.map(function(message) {
          return {
            role: message.role,
            name: message.name || "",
            content: message.content || "",
          };
        });
        var detail = {};
        data.forEach(function(item, index) {
          var fileName = item && typeof item.file_name === "string" && item.file_name.length > 0
            ? item.file_name
            : "chat-" + String(index) + ".jsonl";
          detail[fileName] = mappedMessages;
        });
        return detail;
      });
    },

    // ──────────────────────────────────────────────────────────────────────
    //  Extension API（宿主模式：读接口可用，写接口 fail-fast）
    // ──────────────────────────────────────────────────────────────────────
    isAdmin: api("isAdmin"),
    getTavernHelperExtensionId: api("getTavernHelperExtensionId"),
    getExtensionType: api("getExtensionType"),
    getExtensionStatus: api("getExtensionStatus"),
    isInstalledExtension: api("isInstalledExtension"),
    installExtension: api("installExtension"),
    uninstallExtension: api("uninstallExtension"),
    reinstallExtension: api("reinstallExtension"),
    updateExtension: api("updateExtension"),

    // ──────────────────────────────────────────────────────────────────────
    //  版本 API（JS-Slash-Runner 兼容）
    // ──────────────────────────────────────────────────────────────────────
    getTavernHelperVersion: api("getTavernHelperVersion"),
    getFrontendVersion: api("getFrontendVersion"),
    updateTavernHelper: api("updateTavernHelper"),
    updateFrontendVersion: api("updateFrontendVersion"),
    getTavernVersion: api("getTavernVersion"),

    // ──────────────────────────────────────────────────────────────────────
    //  群聊 API（显式未支持）
    // ──────────────────────────────────────────────────────────────────────
    getGroupMembers: unsupportedAsync("getGroupMembers"),
    isGroupChat: unsupportedSync("isGroupChat"),

    // ──────────────────────────────────────────────────────────────────────
    //  工具方法
    // ──────────────────────────────────────────────────────────────────────
    registerMacroLike: function(regex, replaceFn) {
      var normalizedRegex = ensureRegExp(regex, "registerMacroLike", "regex");
      if (typeof replaceFn !== "function") {
        throw new Error("[registerMacroLike] replace must be function");
      }

      var existed = macroLikeRegistry.some(function(item) {
        return item.source === normalizedRegex.source;
      });
      if (existed) {
        return false;
      }

      macroLikeRegistry.push({
        source: normalizedRegex.source,
        flags: normalizedRegex.flags,
        replaceFn: replaceFn,
      });
      return true;
    },
    unregisterMacroLike: function(regex) {
      var normalizedRegex = ensureRegExp(regex, "unregisterMacroLike", "regex");
      var index = macroLikeRegistry.findIndex(function(item) {
        return item.source === normalizedRegex.source;
      });
      if (index < 0) {
        return false;
      }
      macroLikeRegistry.splice(index, 1);
      return true;
    },
    substitudeMacros: function(text, context) {
      if (typeof text !== "string") {
        throw new Error("substitudeMacros requires text string");
      }
      var macroContext = normalizeMacroLikeContext(context);
      var resolvedText = applyRegisteredMacroLikes(text, macroContext);
      return callApi("substitudeMacros", [resolvedText]);
    },
    getLastMessageId: api("getLastMessageId"),
    getMessageId: api("getMessageId"),
    errorCatched: function(fn) {
      if (typeof fn !== "function") {
        throw new Error("errorCatched requires function");
      }

      return function() {
        var args = Array.prototype.slice.call(arguments);
        try {
          var result = fn.apply(this, args);
          if (result && typeof result.then === "function") {
            return result.catch(function(error) {
              throw error;
            });
          }
          return result;
        } catch (error) {
          throw error;
        }
      };
    },
    utils: { log: log, waitFor: function(ms) { return window.DreamMiniStage.utils.waitFor(ms); } },
    log: log,

    // ──────────────────────────────────────────────────────────────────────
    //  音频 API
    // ──────────────────────────────────────────────────────────────────────
    playAudio: api("playAudio"),
    pauseAudio: api("pauseAudio"),
    stopAudio: api("stopAudio"),
    getAudioList: api("getAudioList"),
    replaceAudioList: api("replaceAudioList"),
    appendAudioList: api("appendAudioList"),
    getAudioSettings: api("getAudioSettings"),
    setAudioSettings: api("setAudioSettings"),
    setAudioEnabled: api("setAudioEnabled"),
    setAudioMode: api("setAudioMode"),
    setGlobalVolume: api("setGlobalVolume"),
    muteAll: api("muteAll"),

    // ──────────────────────────────────────────────────────────────────────
    //  上下文获取
    // ──────────────────────────────────────────────────────────────────────
    getContext: function() {
      return {
        variables: Object.assign({}, variableCache),
        characterId: sessionContext.characterId,
        sessionId: sessionContext.sessionId,
        chatId: sessionContext.chatId,
        iframeId: iframeId,
      };
    },
  };

  // 开发版约束：不再注入 window.getVariables/window.triggerSlash 等顶层别名。
  // 统一通过 window.TavernHelper 与 window.SillyTavern 命名空间访问 API。

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
        apiVersion: "1.0.0",
      };
    },

    /**
     * registerFunctionTool - 注册函数工具供 LLM 调用
     * @param {string} name - 工具名称
     * @param {string} description - 工具描述
     * @param {object} parameters - 参数 schema（OpenAI function calling 格式）
     * @param {boolean} required - 是否必需（保留参数）
     * @param {function} callback - 回调函数，接收参数对象，返回结果
     * @returns {Promise<boolean>} 注册成功返回 true
     */
    registerFunctionTool: function(name, description, parameters, required, callback) {
      // 存储回调到本地注册表
      if (typeof callback === "function") {
        functionToolCallbacks[name] = callback;
      }

      var requiredFlag = typeof required === "boolean" ? required : false;
      return callApi("registerFunctionTool", [name, description, parameters, requiredFlag, iframeId]);
    },

    /**
     * registerSlashCommand - 注册自定义 Slash 命令
     * @param {object} definition - 命令定义对象
     *   - name: 命令名称（不含 /）
     *   - callback: 回调函数 (args, namedArgs, context) => result
     *   - aliases: 别名数组（可选）
     *   - helpString: 帮助文本（可选）
     *   - namedArgumentList: 命名参数列表（可选）
     *   - unnamedArgumentList: 位置参数列表（可选）
     * @returns {Promise<boolean>} 注册成功返回 true
     */
    registerSlashCommand: function(definition) {
      return slashCommandBridge.register(definition);
    },

    /**
     * getApiUrl - 获取当前 LLM API 地址
     * @returns {Promise<string>} API 基础 URL
     */
    getApiUrl: function() {
      return callApi("getApiUrl", []);
    },

    /**
     * getRequestHeaders - 获取 LLM 请求头
     * @returns {Promise<object>} 请求头对象
     */
    getRequestHeaders: function() {
      return callApi("getRequestHeaders", []);
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  //  消息监听
  // ════════════════════════════════════════════════════════════════════════

  var onIframeMessage = createMessageDispatcher({
    pending: pending,
    variableCache: variableCache,
    sessionContext: sessionContext,
    functionToolCallbacks: functionToolCallbacks,
    slashCommandBridge: slashCommandBridge,
    sendMessage: sendMessage,
  });
  window.addEventListener("message", onIframeMessage);

  // ════════════════════════════════════════════════════════════════════════
  //  初始化
  // ════════════════════════════════════════════════════════════════════════

  setupHeightObserver();

  // 通知父窗口 shim 已加载
  sendMessage("SHIM_READY", { iframeId: iframeId, version: "1.0.0" });

})();
