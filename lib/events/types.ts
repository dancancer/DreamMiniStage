/**
 * 事件系统类型定义
 *
 * 定义 SillyTavern 兼容的核心事件类型
 */

/* ═══════════════════════════════════════════════════════════════════════════
   事件名称常量
   ═══════════════════════════════════════════════════════════════════════════ */

export const EVENT_TYPES = {
  /** 生成开始 */
  GENERATION_STARTED: "generation_started",
  /** 生成结束 */
  GENERATION_ENDED: "generation_ended",
  /** 收到消息 */
  MESSAGE_RECEIVED: "message_received",
  /** 发送消息 */
  MESSAGE_SENT: "message_sent",
  /** 删除消息 */
  MESSAGE_DELETED: "message_deleted",
  /** 编辑消息 */
  MESSAGE_EDITED: "message_edited",
  /** 聊天切换 */
  CHAT_CHANGED: "chat_changed",
  /** 聊天完成设置就绪 */
  CHAT_COMPLETION_SETTINGS_READY: "chat_completion_settings_ready",
  /** World Info 条目加载完成 */
  WORLDINFO_ENTRIES_LOADED: "worldinfo_entries_loaded",
  /** 角色加载完成 */
  CHARACTER_LOADED: "character_loaded",
  /** 流式响应块 */
  STREAM_CHUNK: "stream_chunk",
  /** 流式响应结束 */
  STREAM_END: "stream_end",
  /** 用户输入 */
  USER_INPUT: "user_input",
  /** 变量更新 */
  VARIABLE_UPDATED: "variable_updated",
  /** 脚本执行 */
  SCRIPT_EXECUTED: "script_executed",
  /** 错误发生 */
  ERROR_OCCURRED: "error_occurred",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

/* ═══════════════════════════════════════════════════════════════════════════
   事件数据类型
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成开始事件数据
 */
export interface GenerationStartedEvent {
  type: typeof EVENT_TYPES.GENERATION_STARTED;
  /** 生成类型 */
  generationType: "normal" | "continue" | "quiet" | "impersonate" | "swipe" | "regenerate";
  /** 角色 ID */
  characterId?: string;
  /** 用户输入 */
  userInput?: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 生成结束事件数据
 */
export interface GenerationEndedEvent {
  type: typeof EVENT_TYPES.GENERATION_ENDED;
  /** 是否成功 */
  success: boolean;
  /** 生成的内容 */
  content?: string;
  /** 错误信息 */
  error?: string;
  /** 耗时 (ms) */
  duration: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 消息接收事件数据
 */
export interface MessageReceivedEvent {
  type: typeof EVENT_TYPES.MESSAGE_RECEIVED;
  /** 消息 ID */
  messageId: string;
  /** 消息内容 */
  content: string;
  /** 发送者 */
  sender: "user" | "assistant" | "system";
  /** 角色名 */
  characterName?: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 消息发送事件数据
 */
export interface MessageSentEvent {
  type: typeof EVENT_TYPES.MESSAGE_SENT;
  /** 消息 ID */
  messageId: string;
  /** 消息内容 */
  content: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 消息删除事件数据
 */
export interface MessageDeletedEvent {
  type: typeof EVENT_TYPES.MESSAGE_DELETED;
  /** 消息 ID */
  messageId: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 消息编辑事件数据
 */
export interface MessageEditedEvent {
  type: typeof EVENT_TYPES.MESSAGE_EDITED;
  /** 消息 ID */
  messageId: string;
  /** 旧内容 */
  oldContent: string;
  /** 新内容 */
  newContent: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 聊天切换事件数据
 */
export interface ChatChangedEvent {
  type: typeof EVENT_TYPES.CHAT_CHANGED;
  /** 旧聊天 ID */
  oldChatId?: string;
  /** 新聊天 ID */
  newChatId: string;
  /** 角色 ID */
  characterId?: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * World Info 加载事件数据
 */
export interface WorldInfoEntriesLoadedEvent {
  type: typeof EVENT_TYPES.WORLDINFO_ENTRIES_LOADED;
  /** 条目数量 */
  entryCount: number;
  /** 激活的条目 ID 列表 */
  activatedEntries: string[];
  /** 时间戳 */
  timestamp: number;
}

/**
 * 流式响应块事件数据
 */
export interface StreamChunkEvent {
  type: typeof EVENT_TYPES.STREAM_CHUNK;
  /** 块内容 */
  chunk: string;
  /** 累积内容 */
  accumulated: string;
  /** 是否完成 */
  done: boolean;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 变量更新事件数据
 */
export interface VariableUpdatedEvent {
  type: typeof EVENT_TYPES.VARIABLE_UPDATED;
  /** 变量名 */
  name: string;
  /** 旧值 */
  oldValue: unknown;
  /** 新值 */
  newValue: unknown;
  /** 作用域 */
  scope: "local" | "global";
  /** 时间戳 */
  timestamp: number;
}

/**
 * 错误事件数据
 */
export interface ErrorOccurredEvent {
  type: typeof EVENT_TYPES.ERROR_OCCURRED;
  /** 错误消息 */
  message: string;
  /** 错误代码 */
  code?: string;
  /** 错误来源 */
  source?: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 通用事件数据
 */
export interface GenericEvent {
  type: string;
  timestamp: number;
  [key: string]: unknown;
}

/**
 * 所有事件类型联合
 */
export type EventData =
  | GenerationStartedEvent
  | GenerationEndedEvent
  | MessageReceivedEvent
  | MessageSentEvent
  | MessageDeletedEvent
  | MessageEditedEvent
  | ChatChangedEvent
  | WorldInfoEntriesLoadedEvent
  | StreamChunkEvent
  | VariableUpdatedEvent
  | ErrorOccurredEvent
  | GenericEvent;

/* ═══════════════════════════════════════════════════════════════════════════
   事件处理器类型
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 事件处理器函数类型
 */
export type EventHandler<T extends EventData = EventData> = (event: T) => void | Promise<void>;

/**
 * 事件处理器配置
 */
export interface EventHandlerConfig {
  /** 处理器函数 */
  handler: EventHandler;
  /** 是否只执行一次 */
  once?: boolean;
  /** 优先级 (数字越大越先执行) */
  priority?: number;
}

/**
 * 事件订阅返回的取消函数
 */
export type Unsubscribe = () => void;
