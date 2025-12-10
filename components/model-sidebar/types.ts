import type { KeyboardEvent, MouseEvent } from "react";

// ╔════════════════════════════════════════╗
// ║ Model Sidebar 视图层共享类型定义        ║
// ╚════════════════════════════════════════╝

export type LLMType = "openai" | "ollama" | "gemini";

export interface APIConfig {
  id: string;
  name: string;
  type: LLMType;
  baseUrl: string;
  model: string;
  apiKey?: string;
  availableModels?: string[];
}

export interface SidebarState {
  configs: APIConfig[];
  activeConfigId: string;
  showNewConfigForm: boolean;
  showEditHint: boolean;
  isConfigHovered: boolean;
  editingConfigId: string;
  editingName: string;
  newConfigName: string;
  llmType: LLMType;
  baseUrl: string;
  model: string;
  apiKey: string;
  availableModels: string[];
  modelListEmpty: boolean;
  saveSuccess: boolean;
  getModelListSuccess: boolean;
  getModelListError: boolean;
  isTesting: boolean;
  testModelSuccess: boolean;
  testModelError: boolean;
}

export interface SidebarActions {
  toggleSidebar: () => void;
  handleCreateConfig: () => void;
  handleSwitchConfig: (id: string) => void;
  handleStartEditName: (config: APIConfig, e: MouseEvent) => void;
  setEditingName: (name: string) => void;
  handleSaveName: () => void;
  handleKeyDown: (e: KeyboardEvent) => void;
  handleDeleteConfig: (id: string) => void;
  setIsConfigHovered: (hovered: boolean) => void;
  handleGetModelList: (type: LLMType, baseUrl: string, apiKey: string) => Promise<void> | void;
  handleSave: () => void;
  handleCancelCreate: () => void;
  setLlmType: (type: LLMType) => void;
  setBaseUrl: (value: string) => void;
  setApiKey: (value: string) => void;
  setNewConfigName: (value: string) => void;
  setModel: (value: string) => void;
  handleInlineModelChange: (value: string) => void;
  handleTestModel: () => void;
}

export interface SidebarHelpers {
  describeLlmType: (type: LLMType) => string;
  getBaseUrlPlaceholder: (type: LLMType) => string;
  getModelPlaceholder: (type: LLMType) => string;
}

export interface SidebarViewProps {
  isOpen: boolean;
  fontClass: string;
  serifFontClass: string;
  t: (key: string) => string;
  trackButtonClick: (category: string, action: string) => void;
  state: SidebarState;
  actions: SidebarActions;
  helpers: SidebarHelpers;
  variant?: "sidebar" | "panel";
}
