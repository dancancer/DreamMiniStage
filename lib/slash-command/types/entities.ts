/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    Slash Command 实体 / 数据快照类型                        ║
 * ║                                                                            ║
 * ║  独立的数据结构，不依赖执行上下文                                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { DataBankSource } from "./options";

// ============================================================================
//                              角色实体
// ============================================================================

export interface CharacterSummary {
  id: string;
  name: string;
  tags?: string[];
}

export interface CharacterSwitchResult {
  target: string;
  characterId: string;
  characterName: string;
  sessionId: string;
  sessionName: string;
}

// ============================================================================
//                              Lorebook 绑定
// ============================================================================

export interface LorebookBindings {
  primary: string | null;
  additional: string[];
}

// ============================================================================
//                              Prompt 条目状态
// ============================================================================

export interface PromptEntryState {
  identifier: string;
  name: string;
  enabled: boolean;
}

export interface PromptEntryStateUpdate {
  identifier: string;
  enabled: boolean;
}

export interface PromptInjectionState {
  id: string;
  content: string;
  role: "system" | "assistant" | "user";
  position: "before" | "after" | "in_chat" | "none";
  depth: number;
  should_scan: boolean;
  createdAt: string;
}

// ============================================================================
//                              Data Bank 实体
// ============================================================================

export interface DataBankEntrySnapshot {
  name: string;
  url: string;
  source?: DataBankSource;
  enabled?: boolean;
}

// ============================================================================
//                              工具注册
// ============================================================================

export interface SlashToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties?: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface SlashToolRegistration {
  name: string;
  description: string;
  parameters: SlashToolDefinition["parameters"];
  action: string;
  displayName?: string;
  formatMessage?: string;
  shouldRegister?: boolean;
  stealth?: boolean;
}

// ============================================================================
//                              Quick Reply 快照
// ============================================================================

export interface QuickReplySnapshot {
  label: string;
  [key: string]: unknown;
}

export interface QuickReplySetSnapshot {
  name: string;
  [key: string]: unknown;
}

// ============================================================================
//                              Preset & Regex 实体
// ============================================================================

/** Preset 信息 */
export interface PresetInfo {
  name: string;
  type?: "openai" | "context" | "sysprompt";
}

/** Regex 脚本信息 */
export interface RegexScriptInfo {
  name: string;
  enabled: boolean;
  pattern?: string;
  replacement?: string;
}

// ============================================================================
//                              音频实体
// ============================================================================

/** 音频通道类型 */
export type AudioChannelType = "bgm" | "ambient";

/** 音频通道运行时快照 */
export interface AudioChannelSnapshot {
  enabled: boolean;
  mode: "repeat" | "random" | "single" | "stop";
  currentUrl: string | null;
  playlist: Array<{ url: string; title?: string }>;
  isPlaying: boolean;
}

// ============================================================================
//                              变量 & World Book 实体
// ============================================================================

/** 变量作用域 */
export type VariableScope = "local" | "global";

/** World Book 条目数据 */
export interface WorldBookEntryData {
  id: string;
  keys: string[];
  content: string;
  enabled: boolean;
  comment?: string;
  priority?: number;
  depth?: number;
}

// ============================================================================
//                              分组成员
// ============================================================================

export type GroupMemberField = "name" | "index" | "id" | "avatar";
export type GroupMemberMoveDirection = "up" | "down";
