/**
 * @input  React, UI 基础组件, lib/model-runtime
 * @output LLMType, APIConfig, SidebarState, SidebarActions, SidebarHelpers, SidebarViewProps
 * @pos    模型配置侧边栏组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

import type { KeyboardEvent, MouseEvent } from "react";
import type {
  APIConfig,
  BooleanModelSettingKey,
  LLMType,
  ModelAdvancedSettings,
  NumericModelSettingKey,
} from "@/lib/model-runtime";

// ╔════════════════════════════════════════╗
// ║ Model Sidebar 视图层共享类型定义        ║
// ╚════════════════════════════════════════╝

export type { APIConfig, LLMType } from "@/lib/model-runtime";

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
  advancedSettings: ModelAdvancedSettings;
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
  setAdvancedNumberSetting: (key: NumericModelSettingKey, value: string) => void;
  setAdvancedBooleanSetting: (key: BooleanModelSettingKey, value: boolean) => void;
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
