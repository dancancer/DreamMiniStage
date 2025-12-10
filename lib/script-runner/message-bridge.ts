/**
 * Message Bridge Module
 * 
 * Provides type-safe, secure postMessage communication between the parent window
 * and iframe sandbox. Handles message validation, origin checking, and provides
 * a clean API for bidirectional communication.
 */

import type {
  MessageBridgeData,
  MessageType,
  ScriptExecutePayload,
  ScriptResultPayload,
  ScriptErrorPayload,
  HeightUpdatePayload,
  EventMessagePayload,
  APICallPayload,
  APIResponsePayload,
} from "@/types/script-runner";

/**
 * Message handler function type
 */
type MessageHandler<T = any> = (data: MessageBridgeData<T>) => void | Promise<void>;

/**
 * Message Bridge Configuration
 */
export interface MessageBridgeConfig {
  /** Target window (iframe.contentWindow or parent) */
  targetWindow: Window;
  
  /** Allowed origins for security (default: same origin) */
  allowedOrigins?: string[];
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** Message timeout in ms */
  timeout?: number;
}

/**
 * MessageBridge
 * 
 * Handles secure postMessage communication between parent and iframe.
 * Provides type-safe message sending/receiving with origin validation.
 * 
 * @example
 * ```typescript
 * // In parent window
 * const bridge = new MessageBridge({
 *   targetWindow: iframe.contentWindow,
 *   allowedOrigins: ['http://localhost:3303']
 * });
 * 
 * bridge.on('SCRIPT_RESULT', (data) => {
 *   console.log('Script result:', data.payload);
 * });
 * 
 * bridge.send('SCRIPT_EXECUTE', {
 *   code: 'console.log("Hello")',
 *   context: {}
 * });
 * ```
 */
export class MessageBridge {
  private targetWindow: Window;
  private allowedOrigins: string[];
  private debug: boolean;
  private timeout: number;
  private handlers: Map<MessageType, Set<MessageHandler>>;
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>;
  private messageListener: ((event: MessageEvent) => void) | null = null;
  
  constructor(config: MessageBridgeConfig) {
    this.targetWindow = config.targetWindow;
    this.allowedOrigins = config.allowedOrigins || [window.location.origin];
    this.debug = config.debug ?? false;
    this.timeout = config.timeout ?? 30000; // 30 seconds default
    this.handlers = new Map();
    this.pendingRequests = new Map();
    
    this.setupMessageListener();
  }
  
  /**
   * Set up the message event listener
   */
  private setupMessageListener(): void {
    this.messageListener = (event: MessageEvent) => {
      this.handleMessage(event);
    };
    
    window.addEventListener("message", this.messageListener);
  }
  
  /**
   * Handle incoming postMessage events
   */
  private handleMessage(event: MessageEvent): void {
    // Validate origin
    if (!this.isOriginAllowed(event.origin)) {
      if (this.debug) {
        console.warn("[MessageBridge] Message from unauthorized origin:", event.origin);
      }
      return;
    }
    
    // Parse and validate message
    const message = this.parseMessage(event.data);
    if (!message) {
      if (this.debug) {
        console.warn("[MessageBridge] Invalid message format:", event.data);
      }
      return;
    }
    
    if (this.debug) {
      console.log("[MessageBridge] Received:", message.type, message);
    }
    
    // Handle response to pending request
    if (message.id && this.pendingRequests.has(message.id)) {
      this.handlePendingResponse(message);
      return;
    }
    
    // Dispatch to handlers
    this.dispatchToHandlers(message);
  }
  
  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(origin: string): boolean {
    // Allow same origin
    if (origin === window.location.origin) {
      return true;
    }
    
    // Check against allowed origins
    return this.allowedOrigins.some(allowed => {
      // Support wildcard matching
      if (allowed === "*") return true;
      if (allowed.endsWith("*")) {
        const prefix = allowed.slice(0, -1);
        return origin.startsWith(prefix);
      }
      return origin === allowed;
    });
  }
  
  /**
   * Parse and validate message data
   */
  private parseMessage(data: any): MessageBridgeData | null {
    try {
      // If already an object with type, return it
      if (typeof data === "object" && data !== null && "type" in data) {
        return data as MessageBridgeData;
      }
      
      // Try to parse as JSON string
      if (typeof data === "string") {
        const parsed = JSON.parse(data);
        if (typeof parsed === "object" && "type" in parsed) {
          return parsed as MessageBridgeData;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Handle response to a pending request
   */
  private handlePendingResponse(message: MessageBridgeData): void {
    const pending = this.pendingRequests.get(message.id!);
    if (!pending) return;
    
    // Clear timeout
    clearTimeout(pending.timeout);
    
    // Remove from pending
    this.pendingRequests.delete(message.id!);
    
    // Check for error
    if (message.type === "SCRIPT_ERROR" || message.type === "API_RESPONSE") {
      const errorPayload = message.payload as ScriptErrorPayload | APIResponsePayload;
      if ("error" in errorPayload && errorPayload.error) {
        pending.reject(new Error(errorPayload.error));
        return;
      }
    }
    
    // Resolve with payload
    pending.resolve(message.payload);
  }
  
  /**
   * Dispatch message to registered handlers
   */
  private dispatchToHandlers(message: MessageBridgeData): void {
    const handlers = this.handlers.get(message.type);
    if (!handlers || handlers.size === 0) {
      if (this.debug) {
        console.warn("[MessageBridge] No handlers for message type:", message.type);
      }
      return;
    }
    
    // Call all registered handlers
    handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error("[MessageBridge] Handler error:", error);
      }
    });
  }
  
  /**
   * Send a message to the target window
   */
  public send<T = any>(type: MessageType, payload?: T, id?: string): void {
    const message: MessageBridgeData<T> = {
      type,
      payload,
      id: id || this.generateId(),
      timestamp: Date.now(),
      origin: window.location.origin,
    };
    
    if (this.debug) {
      console.log("[MessageBridge] Sending:", type, message);
    }
    
    try {
      const targetOrigin = this.allowedOrigins.includes("*")
        ? "*"
        : (this.allowedOrigins[0] || window.location.origin);
      this.targetWindow.postMessage(message, targetOrigin);
    } catch (error) {
      console.error("[MessageBridge] Failed to send message:", error);
      throw error;
    }
  }
  
  /**
   * Send a message and wait for a response
   */
  public async request<TRequest = any, TResponse = any>(
    type: MessageType,
    payload?: TRequest,
    timeoutMs?: number,
  ): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      const id = this.generateId();
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${type}`));
      }, timeoutMs || this.timeout);
      
      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.send(type, payload, id);
    });
  }
  
  /**
   * Register a message handler
   */
  public on<T = any>(type: MessageType, handler: MessageHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    
    this.handlers.get(type)!.add(handler as MessageHandler);
    
    // Return unsubscribe function
    return () => this.off(type, handler);
  }
  
  /**
   * Register a one-time message handler
   */
  public once<T = any>(type: MessageType, handler: MessageHandler<T>): () => void {
    const wrappedHandler = (data: MessageBridgeData<T>) => {
      handler(data);
      this.off(type, wrappedHandler);
    };
    
    return this.on(type, wrappedHandler);
  }
  
  /**
   * Unregister a message handler
   */
  public off(type: MessageType, handler?: MessageHandler): void {
    if (!this.handlers.has(type)) return;
    
    if (handler) {
      this.handlers.get(type)!.delete(handler);
    } else {
      this.handlers.delete(type);
    }
  }
  
  /**
   * Remove all handlers for all message types
   */
  public clearHandlers(): void {
    this.handlers.clear();
  }
  
  /**
   * Destroy the message bridge and clean up
   */
  public destroy(): void {
    // Remove event listener
    if (this.messageListener) {
      window.removeEventListener("message", this.messageListener);
      this.messageListener = null;
    }
    
    // Reject all pending requests
    this.pendingRequests.forEach(pending => {
      clearTimeout(pending.timeout);
      pending.reject(new Error("MessageBridge destroyed"));
    });
    
    // Clear all data
    this.pendingRequests.clear();
    this.handlers.clear();
  }
  
  /**
   * Generate a unique message ID
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get the number of registered handlers for a message type
   */
  public getHandlerCount(type?: MessageType): number {
    if (type) {
      return this.handlers.get(type)?.size || 0;
    }
    
    let total = 0;
    this.handlers.forEach(handlers => {
      total += handlers.size;
    });
    return total;
  }
  
  /**
   * Check if the target window is still valid
   */
  public isValid(): boolean {
    try {
      return this.targetWindow && !this.targetWindow.closed;
    } catch {
      return false;
    }
  }
}

/**
 * Create a message bridge for iframe communication
 * 
 * @param iframe - The iframe element
 * @param config - Additional configuration options
 * @returns MessageBridge instance
 */
export function createIframeBridge(
  iframe: HTMLIFrameElement,
  config?: Partial<MessageBridgeConfig>,
): MessageBridge {
  if (!iframe.contentWindow) {
    throw new Error("Iframe contentWindow is not available");
  }
  
  return new MessageBridge({
    targetWindow: iframe.contentWindow,
    ...config,
  });
}

/**
 * Create a message bridge for parent window communication (from inside iframe)
 * 
 * @param config - Configuration options
 * @returns MessageBridge instance
 */
export function createParentBridge(
  config?: Partial<MessageBridgeConfig>,
): MessageBridge {
  if (!window.parent || window.parent === window) {
    throw new Error("No parent window available");
  }
  
  return new MessageBridge({
    targetWindow: window.parent,
    ...config,
  });
}
