/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                     useModelSidebarConfig Hook                           ║
 * ║                                                                          ║
 * ║  ModelSidebar 配置管理核心逻辑                                             ║
 * ║  【重构】使用 Zustand Store 替代 localStorage + window 事件                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { callGeminiOnce } from "@/lib/core/gemini-client";
import type { SidebarState, SidebarActions } from "@/components/model-sidebar/types";
import { useModelStore, type APIConfig, type LLMType } from "@/lib/store/model-store";
import { setString } from "@/lib/storage/client-storage";

/* ═══════════════════════════════════════════════════════════════════════════
   常量定义
   ═══════════════════════════════════════════════════════════════════════════ */

const DEFAULT_API_KEY = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_KEY || "" : "";
const DEFAULT_API_URL = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL || "" : "";

const STORAGE_KEYS: Record<LLMType, { model: string; baseUrl: string; apiKey?: string }> = {
  openai: { model: "openaiModel", baseUrl: "openaiBaseUrl", apiKey: "openaiApiKey" },
  ollama: { model: "ollamaModel", baseUrl: "ollamaBaseUrl", apiKey: "" },
  gemini: { model: "geminiModel", baseUrl: "geminiBaseUrl", apiKey: "geminiApiKey" },
};

/* ═══════════════════════════════════════════════════════════════════════════
   工具函数 - 纯函数，无副作用
   ═══════════════════════════════════════════════════════════════════════════ */

export const describeLlmType = (type: LLMType): string => {
  const map: Record<LLMType, string> = { ollama: "Ollama API", gemini: "Gemini API", openai: "OpenAI API" };
  return map[type];
};

export const getBaseUrlPlaceholder = (type: LLMType): string => {
  const map: Record<LLMType, string> = { ollama: "http://localhost:11434", gemini: "", openai: "https://api.openai.com/v1" };
  return map[type];
};

export const getModelPlaceholder = (type: LLMType): string => {
  const map: Record<LLMType, string> = {
    ollama: "llama3, mistral, mixtral...",
    gemini: "gemini-1.5-flash, gemini-1.5-pro...",
    openai: "gpt-4-turbo, claude-3-opus-20240229...",
  };
  return map[type];
};

const getStorageKeys = (type: LLMType) => STORAGE_KEYS[type] || STORAGE_KEYS.openai;
const generateId = () => `api_${Date.now()}`;

/* ═══════════════════════════════════════════════════════════════════════════
   配置存储工具
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   主 Hook
   ═══════════════════════════════════════════════════════════════════════════ */

export function useModelSidebarConfig() {
  // 配置列表状态
  const [configs, setConfigs] = useState<APIConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState("");
  const [showNewConfigForm, setShowNewConfigForm] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [showEditHint] = useState(true);
  const [isConfigHovered, setIsConfigHovered] = useState(false);

  // 表单状态
  const [llmType, setLlmTypeState] = useState<LLMType>("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [newConfigName, setNewConfigName] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelListEmpty, setModelListEmpty] = useState(false);

  // 反馈状态
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [getModelListSuccess, setGetModelListSuccess] = useState(false);
  const [getModelListError, setGetModelListError] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testModelSuccess, setTestModelSuccess] = useState(false);
  const [testModelError, setTestModelError] = useState(false);

  // ========== Zustand Store ==========
  const storeConfigs = useModelStore((state) => state.configs);
  const storeActiveConfigId = useModelStore((state) => state.activeConfigId);
  const setStoreConfigs = useModelStore((state) => state.setConfigs);
  const updateStoreConfig = useModelStore((state) => state.updateConfig);
  const deleteStoreConfig = useModelStore((state) => state.deleteConfig);
  const setStoreActiveConfig = useModelStore((state) => state.setActiveConfig);

  // 持久化（同步到 Store）
  const persistConfigs = useCallback((next: APIConfig[]) => {
    const normalized = Array.isArray(next) ? next : [];
    setConfigs(normalized);
    setStoreConfigs(normalized);
    return normalized;
  }, [setStoreConfigs]);

  // 获取模型列表
  const handleGetModelList = useCallback(async (type: LLMType, targetUrl: string, targetKey: string) => {
    if (type === "ollama") return;
    setGetModelListError(false); setGetModelListSuccess(false); setModelListEmpty(false);

    if ((type === "openai" && (!targetUrl || !targetKey)) || (type === "gemini" && !targetKey)) {
      setAvailableModels([]); setGetModelListError(true); setModelListEmpty(true);
      setTimeout(() => setGetModelListError(false), 2000);
      return;
    }

    try {
      let list: string[] = [];
      if (type === "openai") {
        const res = await fetch(`${targetUrl}/models`, { headers: { Authorization: `Bearer ${targetKey}` } });
        list = (await res.json()).data?.map((i: { id: string }) => i.id) || [];
      } else if (type === "gemini") {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${targetKey}`);
        const data = await res.json();
        list = data.models?.map((i: { name?: string }) => i.name?.replace(/^models\//, "") || "").filter(Boolean) || [];
      }
      setAvailableModels(list);
      setModelListEmpty(list.length === 0);
      setGetModelListSuccess(true);
      setTimeout(() => setGetModelListSuccess(false), 2000);
    } catch {
      setAvailableModels([]); setGetModelListError(true); setModelListEmpty(true);
      setTimeout(() => setGetModelListError(false), 2000);
    }
  }, []);

  // 切换 LLM 类型
  const handleLlmTypeChange = useCallback((type: LLMType) => {
    setLlmTypeState(type);
    if (type === "gemini") setBaseUrl("");
    setAvailableModels([]);
    setModelListEmpty(false);
  }, []);

  // 加载配置到表单
  // 【优化】分离数据加载和 API 调用，避免每次加载都触发网络请求
  const loadConfigToForm = useCallback((config: APIConfig, skipApiCall = false) => {
    handleLlmTypeChange(config.type);
    const url = config.type === "gemini" ? "" : config.baseUrl;
    setBaseUrl(url);
    setModel(config.model);
    setApiKey(config.apiKey || "");
    setAvailableModels(config.availableModels || []);
    setModelListEmpty(false);

    // 只在明确需要时才调用 API（如用户主动切换配置）
    if (!skipApiCall) {
      if (config.type === "openai" && url && config.apiKey) handleGetModelList("openai", url, config.apiKey);
      else if (config.type === "gemini" && config.apiKey) handleGetModelList("gemini", "", config.apiKey);
    }
  }, [handleGetModelList, handleLlmTypeChange]);

  // 生成配置名称
  const generateConfigName = useCallback((type: LLMType, modelName: string): string => {
    let name = modelName?.trim() || (type === "gemini" ? "Gemini" : type === "ollama" ? "Ollama" : "OpenAI");
    if (name.length > 15) name = name.substring(0, 15);
    const same = configs.filter(c => c.model === modelName || new RegExp(`【\\d+】${name}`).test(c.name));
    if (same.length === 0) return `new model`;
    const max = same.reduce((m, c) => {
      const match = c.name.match(/【(\d+)】/);
      return match ? Math.max(m, parseInt(match[1], 10)) : m;
    }, 0);
    return `${name}(${max + 1})`;
  }, [configs]);

  // 【移除】不再需要派发 window 事件，Store 自动通知订阅者

  // CRUD 操作
  const handleCreateConfig = useCallback(() => {
    handleLlmTypeChange("openai");
    setModel(""); setApiKey("");
    setNewConfigName(generateConfigName("openai", ""));
    setShowNewConfigForm(true);
    setActiveConfigId("");
  }, [generateConfigName, handleLlmTypeChange]);

  const handleCancelCreate = useCallback(() => {
    setShowNewConfigForm(false);
    setNewConfigName("");
    if (configs.length > 0) {
      const c = configs.find(x => x.id === activeConfigId) || configs[0];
      setActiveConfigId(c.id);
      loadConfigToForm(c);
    }
  }, [activeConfigId, configs, loadConfigToForm]);

  const handleSave = useCallback(() => {
    const url = llmType === "gemini" ? "" : baseUrl;
    if (showNewConfigForm) {
      const newConfig: APIConfig = {
        id: generateId(),
        name: newConfigName.trim() || generateConfigName(llmType, model),
        type: llmType, baseUrl: url, model,
        availableModels: llmType === "ollama" ? [] : availableModels,
        apiKey: llmType === "ollama" ? undefined : apiKey,
      };
      persistConfigs([...configs, newConfig]);
      setStoreActiveConfig(newConfig.id);
      setActiveConfigId(newConfig.id);
      setShowNewConfigForm(false);
      setNewConfigName("");
    } else {
      const updated = configs.map(c => c.id === activeConfigId ? {
        ...c, type: llmType, baseUrl: url, model,
        availableModels: llmType === "ollama" ? [] : availableModels,
        apiKey: llmType === "ollama" ? undefined : apiKey,
      } : c);
      persistConfigs(updated);
    }

    const keys = getStorageKeys(llmType);
    setString("llmType", llmType);
    setString("modelName", model);
    setString(keys.model, model);
    if (llmType !== "gemini") {
      setString(keys.baseUrl, url);
      setString("modelBaseUrl", url);
    }
    if (llmType !== "ollama" && keys.apiKey) {
      setString(keys.apiKey, apiKey);
      setString("apiKey", apiKey);
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }, [activeConfigId, apiKey, availableModels, baseUrl, configs, generateConfigName, llmType, model, newConfigName, persistConfigs, setStoreActiveConfig, showNewConfigForm]);

  const handleDeleteConfig = useCallback((id: string) => {
    const merged = Array.from(new Map(configs.map(c => [c.id, c])).values());
    const updated = merged.filter(c => c.id !== id);
    persistConfigs(updated);
    if (id === activeConfigId) {
      if (updated.length > 0) { setActiveConfigId(updated[0].id); loadConfigToForm(updated[0]); }
      else { setActiveConfigId(""); setLlmTypeState("openai"); setBaseUrl(""); setModel(""); setApiKey(""); setAvailableModels([]); }
      setStoreActiveConfig(updated[0]?.id || "");
    }
  }, [activeConfigId, configs, loadConfigToForm, persistConfigs, setStoreActiveConfig]);

  const handleSwitchConfig = useCallback((id: string) => {
    if (id === activeConfigId) return;
    setActiveConfigId(id);
    const config = configs.find(c => c.id === id);
    if (config) {
      loadConfigToForm(config);
      setStoreActiveConfig(id);
      setShowNewConfigForm(false);
    }
  }, [activeConfigId, configs, loadConfigToForm, setStoreActiveConfig]);

  // 名称编辑
  const handleStartEditName = useCallback((config: APIConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConfigId(config.id);
    setEditingName(config.name);
  }, []);

  const handleSaveName = useCallback(() => {
    if (!editingName.trim()) return;
    const merged = Array.from(new Map(configs.map(c => [c.id, c])).values());
    const updated = merged.map(c => c.id === editingConfigId ? { ...c, name: editingName.trim() } : c);
    persistConfigs(updated);
    setEditingConfigId("");
  }, [configs, editingConfigId, editingName, persistConfigs]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSaveName();
    else if (e.key === "Escape") setEditingConfigId("");
  }, [handleSaveName]);

  // 内联模型变更
  const handleInlineModelChange = useCallback((newModel: string) => {
    setModel(newModel);
    if (!activeConfigId) return;
    const updated = configs.map(c => c.id === activeConfigId ? { ...c, model: newModel } : c);
    persistConfigs(updated);
    const keys = getStorageKeys(llmType);
    setString(keys.model, newModel);
    setString("modelName", newModel);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }, [activeConfigId, configs, llmType, persistConfigs]);

  // 模型测试
  const handleTestModel = useCallback(async () => {
    if (!model) return;
    setIsTesting(true); setTestModelSuccess(false); setTestModelError(false);
    try {
      if (llmType === "gemini") {
        if (!apiKey) throw new Error("Gemini requires API Key");
        const reply = await callGeminiOnce({ system: "You are a helpful AI assistant.", user: "Ping", config: { apiKey, model, temperature: 0.1 } });
        if (!reply.trim()) throw new Error("Empty response");
      } else {
        let url = baseUrl || getBaseUrlPlaceholder(llmType);
        if (llmType === "ollama" && !url.startsWith("http")) url = "http://" + url;
        if (url.endsWith("/")) url = url.slice(0, -1);

        const chatModel = llmType === "openai"
          ? new ChatOpenAI({ modelName: model, openAIApiKey: apiKey, configuration: { baseURL: url }, timeout: 30000 })
          : new ChatOllama({ baseUrl: url, model, temperature: 0.1 });

        const msgs = llmType === "ollama"
          ? [{ role: "user", content: "Hi" }]
          : [{ role: "system", content: "You are a helpful AI assistant." }, { role: "user", content: "Hello" }];
        const res = await chatModel.invoke(msgs);
        if (!res.content.toString().trim()) throw new Error("Empty response");
      }
      setTestModelSuccess(true);
      setTimeout(() => setTestModelSuccess(false), 2000);
    } catch (err) {
      console.error("Model test failed:", err);
      setTestModelError(true);
      setTimeout(() => setTestModelError(false), 2000);
    } finally { setIsTesting(false); }
  }, [apiKey, baseUrl, llmType, model]);

  // 初始化（从 Store 加载）
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    let merged = storeConfigs;
    if (merged.length === 0 && (DEFAULT_API_URL || DEFAULT_API_KEY)) {
      const def: APIConfig = { 
        id: generateId(), 
        name: `【1】${DEFAULT_API_URL ? "API" : "OpenAI"}`, 
        type: "openai", 
        baseUrl: DEFAULT_API_URL, 
        model: "", 
        apiKey: DEFAULT_API_KEY 
      };
      merged = [def];
      persistConfigs(merged);
      setStoreActiveConfig(def.id);
    }
    
    const activeId = storeActiveConfigId && merged.some(c => c.id === storeActiveConfigId) 
      ? storeActiveConfigId 
      : (merged[0]?.id || "");
    
    setConfigs(merged);
    setActiveConfigId(activeId);
    
    // 初始化时跳过 API 调用（skipApiCall = true）
    if (merged.length > 0) {
      const config = merged.find(c => c.id === activeId);
      if (config) loadConfigToForm(config, true);
    }
  }, [loadConfigToForm, persistConfigs, setStoreActiveConfig, storeActiveConfigId, storeConfigs]);

  // 【移除】不再需要监听 window 事件，Store 变化会自动触发重渲染

  // 返回状态和操作
  const state: SidebarState = {
    configs, activeConfigId, showNewConfigForm, showEditHint, isConfigHovered,
    editingConfigId, editingName, newConfigName, llmType, baseUrl, model, apiKey,
    availableModels, modelListEmpty, saveSuccess, getModelListSuccess, getModelListError,
    isTesting, testModelSuccess, testModelError,
  };

  const actions: Omit<SidebarActions, "toggleSidebar"> = {
    handleCreateConfig, handleSwitchConfig, handleStartEditName, setEditingName,
    handleSaveName, handleKeyDown, handleDeleteConfig, setIsConfigHovered,
    handleGetModelList, handleSave, handleCancelCreate, setLlmType: handleLlmTypeChange,
    setBaseUrl, setApiKey, setNewConfigName, setModel, handleInlineModelChange, handleTestModel,
  };

  return { state, actions };
}
