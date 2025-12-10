/**
 * Script Runner Type Definitions
 * 
 * TypeScript type definitions for the iframe-based script execution system.
 * These types ensure type safety across the script runner, message bridge,
 * event system, and sandbox environment.
 */

// ============================================================================
// Message Bridge Types
// ============================================================================

/**
 * Message types for postMessage communication between parent and iframe
 */
export type MessageType = 
  | 'API_CALL' 
  | 'API_RESPONSE' 
  | 'EVENT_EMIT' 
  | 'CONSOLE_LOG' 
  | 'ERROR' 
  | 'BROADCAST_TO_EMBEDS'
  | 'SCRIPT_EXECUTE'
  | 'SCRIPT_RESULT'
  | 'SCRIPT_ERROR'
  | 'HEIGHT_UPDATE'
  | 'EVENT_LISTEN'
  | 'READY';

export interface WorldBookEntry {
  entry_id?: string;
  id?: number;
  content: string;
  keys: string[];
  secondary_keys?: string[];
  selective: boolean;
  constant: boolean;
  position: string | number;
  insertion_order?: number;
  enabled?: boolean;
  use_regex?: boolean;
  depth?: number;
  comment?: string;
  tokens?: number;
  extensions?: Record<string, any>;
}

/**
 * Base message structure for postMessage communication
 */
export interface MessageBridgeData<T = any> {
  type: MessageType;
  id?: string;
  payload?: T;
  timestamp?: number;
  origin?: string;
}

/**
 * Script execution message payload
 */
export interface ScriptExecutePayload {
  code: string;
  context?: Record<string, any>;
  timeout?: number;
}

/**
 * Script result message payload
 */
export interface ScriptResultPayload {
  result: any;
  executionTime: number;
}

/**
 * Script error message payload
 */
export interface ScriptErrorPayload {
  error: string;
  stack?: string;
  line?: number;
  column?: number;
}

/**
 * Height update message payload
 */
export interface HeightUpdatePayload {
  height: number;
}

/**
 * Event message payload
 */
export interface EventMessagePayload {
  eventName: string;
  data?: any;
}

/**
 * API call message payload
 */
export interface APICallPayload {
  method: string;
  args: any[];
}

/**
 * API response message payload
 */
export interface APIResponsePayload {
  result?: any;
  error?: string;
}

// ============================================================================
// Script Executor Types
// ============================================================================

/**
 * Script execution context
 * Provides environment and state information to the executing script
 */
export interface ScriptContext {
  /** Character ID associated with this script execution */
  characterId?: string;
  
  /** Chat session ID */
  sessionId?: string;
  
  /** Message ID that triggered this script */
  messageId?: string;
  
  /** User-defined variables accessible to the script */
  variables?: Record<string, any>;
  
  /** Read-only metadata */
  metadata?: {
    userName?: string;
    characterName?: string;
    timestamp?: number;
  };
}

/**
 * Options for script executor initialization
 */
export interface ScriptExecutorOptions {
  /** Timeout for script execution in milliseconds */
  timeout?: number;
  
  /** Enable console.log output */
  allowConsole?: boolean;
  
  /** Enable third-party library loading */
  allowLibraries?: boolean;
  
  /** List of allowed third-party libraries */
  allowedLibraries?: string[];
  
  /** Enable variable access */
  allowVariableAccess?: boolean;
  
  /** Enable world book access */
  allowWorldBookAccess?: boolean;
  
  /** Enable event system */
  allowEvents?: boolean;
  
  /** Sandbox iframe URL */
  sandboxUrl?: string;
  
  /** CSP policy override */
  cspPolicy?: string;
}

/**
 * Script execution result
 */
export interface ScriptExecutionResult {
  /** Whether the script executed successfully */
  success: boolean;
  
  /** The return value of the script (if successful) */
  result?: any;
  
  /** Error information (if failed) */
  error?: {
    message: string;
    stack?: string;
    line?: number;
    column?: number;
  };
  
  /** Execution time in milliseconds */
  executionTime: number;
  
  /** Console output (if enabled) */
  consoleOutput?: string[];
}

// ============================================================================
// Sandbox API Types
// ============================================================================

/**
 * API exposed to scripts running in the sandbox iframe
 */
export interface SandboxAPI {
  /** Variable access API */
  variables: {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
    delete: (key: string) => void;
    list: () => string[];
  };
  
  /** Event system API */
  events: {
    on: (eventName: string, handler: Function) => void;
    once: (eventName: string, handler: Function) => void;
    off: (eventName: string, handler?: Function) => void;
    emit: (eventName: string, data?: any) => void;
  };
  
  /** World book access API (placeholder) */
  worldbook?: {
    get: (id: string) => any;
    search: (query: string) => any[];
  };
  
  /** Utility functions */
  utils: {
    log: (...args: any[]) => void;
    waitFor: (ms: number) => Promise<void>;
    getContext: () => ScriptContext;
  };
  
  /** Version information */
  version: string;
}

// ============================================================================
// Event System Types
// ============================================================================

/**
 * Event handler function type
 */
export type EventHandler<T = any> = (data: T) => void | Promise<void>;

/**
 * Event unsubscribe function
 */
export type UnsubscribeFunction = () => void;

/**
 * Event emitter interface
 */
export interface EventEmitter {
  on<T = any>(eventName: string, handler: EventHandler<T>): UnsubscribeFunction;
  once<T = any>(eventName: string, handler: EventHandler<T>): UnsubscribeFunction;
  off(eventName: string, handler?: EventHandler): void;
  emit(eventName: string, data?: any): void;
  listenerCount(eventName?: string): number;
  clearListeners(eventName?: string): void;
}

// ============================================================================
// Security Types
// ============================================================================

/**
 * Security policy for script execution
 */
export interface SecurityPolicy {
  /** Allowed origins for postMessage */
  allowedOrigins: string[];
  
  /** Maximum script execution time */
  maxExecutionTime: number;
  
  /** Maximum number of API calls per second */
  maxApiCallsPerSecond: number;
  
  /** Blocked API methods */
  blockedMethods?: string[];
  
  /** Enable strict CSP */
  strictCSP: boolean;
}

/**
 * API call rate limiter
 */
export interface RateLimiter {
  checkLimit(key: string): boolean;
  reset(key?: string): void;
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Enhanced ChatHtmlBubble component props
 */
export interface ChatHtmlBubbleProps {
  /** HTML content to render */
  content: string;
  
  /** Enable script execution in iframe */
  enableScript?: boolean;
  
  /** Script execution context */
  scriptContext?: ScriptContext;
  
  /** Script executor options */
  scriptOptions?: ScriptExecutorOptions;
  
  /** Callback when script sends a message */
  onScriptMessage?: (data: MessageBridgeData) => void;
  
  /** Callback when script execution completes */
  onScriptComplete?: (result: ScriptExecutionResult) => void;
  
  /** Callback when script execution fails */
  onScriptError?: (error: ScriptErrorPayload) => void;
  
  /** Other existing props */
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ScriptExecutor component props
 */
export interface ScriptExecutorProps {
  /** Script code to execute */
  code: string;
  
  /** Execution context */
  context?: ScriptContext;
  
  /** Executor options */
  options?: ScriptExecutorOptions;
  
  /** Callback when execution completes */
  onComplete?: (result: ScriptExecutionResult) => void;
  
  /** Callback when execution fails */
  onError?: (error: ScriptErrorPayload) => void;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Deep partial type for configuration objects
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Promise or value type
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Nullable type
 */
export type Nullable<T> = T | null | undefined;
