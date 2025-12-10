/**
 * Sandbox Context Module
 * 
 * Provides a secure, controlled environment for scripts running in the iframe sandbox.
 * Exposes a limited API to scripts with rate limiting, permissions, and audit logging.
 */

import type {
  ScriptContext,
  SandboxAPI,
  SecurityPolicy,
  RateLimiter,
} from "@/types/script-runner";
import { ScriptEventEmitter } from "./event-emitter";
import { MessageBridge } from "./message-bridge";

/**
 * Simple rate limiter implementation
 */
class SimpleRateLimiter implements RateLimiter {
  private counts: Map<string, { count: number; resetAt: number }>;
  private limit: number;
  private window: number; // in milliseconds
  
  constructor(limit: number = 100, windowMs: number = 1000) {
    this.counts = new Map();
    this.limit = limit;
    this.window = windowMs;
  }
  
  checkLimit(key: string): boolean {
    const now = Date.now();
    const entry = this.counts.get(key);
    
    if (!entry || now > entry.resetAt) {
      // New window
      this.counts.set(key, {
        count: 1,
        resetAt: now + this.window,
      });
      return true;
    }
    
    if (entry.count >= this.limit) {
      return false;
    }
    
    entry.count++;
    return true;
  }
  
  reset(key?: string): void {
    if (key) {
      this.counts.delete(key);
    } else {
      this.counts.clear();
    }
  }
}

/**
 * Sandbox Context
 * 
 * Creates a controlled execution environment for scripts with:
 * - Limited API surface
 * - Rate limiting
 * - Permission checks
 * - Audit logging
 */
export class SandboxContext {
  private context: ScriptContext;
  private eventEmitter: ScriptEventEmitter;
  private messageBridge?: MessageBridge;
  private rateLimiter: RateLimiter;
  private policy: SecurityPolicy;
  private logs: string[];
  
  constructor(
    context: ScriptContext,
    eventEmitter: ScriptEventEmitter,
    options?: {
      messageBridge?: MessageBridge;
      policy?: Partial<SecurityPolicy>;
    },
  ) {
    this.context = context;
    this.eventEmitter = eventEmitter;
    this.messageBridge = options?.messageBridge;
    this.logs = [];
    
    // Initialize security policy
    this.policy = {
      allowedOrigins: [window.location.origin],
      maxExecutionTime: 30000,
      maxApiCallsPerSecond: 100,
      strictCSP: true,
      ...options?.policy,
    };
    
    // Initialize rate limiter
    this.rateLimiter = new SimpleRateLimiter(
      this.policy.maxApiCallsPerSecond,
    );
  }
  
  /**
   * Create the sandbox API object to be exposed to scripts
   */
  createAPI(): SandboxAPI {
    return {
      variables: {
        get: this.wrapAPI("variables.get", this.getVariable.bind(this)),
        set: this.wrapAPI("variables.set", this.setVariable.bind(this)),
        delete: this.wrapAPI("variables.delete", this.deleteVariable.bind(this)),
        list: this.wrapAPI("variables.list", this.listVariables.bind(this)),
      },
      
      events: {
        on: this.wrapAPI("events.on", this.addEventListener.bind(this)),
        once: this.wrapAPI("events.once", this.addEventListenerOnce.bind(this)),
        off: this.wrapAPI("events.off", this.removeEventListener.bind(this)),
        emit: this.wrapAPI("events.emit", this.emitEvent.bind(this)),
      },
      
      worldbook: {
        get: this.wrapAPI("worldbook.get", this.getWorldbookEntry.bind(this)),
        search: this.wrapAPI("worldbook.search", this.searchWorldbook.bind(this)),
      },
      
      utils: {
        log: this.log.bind(this),
        waitFor: this.waitFor.bind(this),
        getContext: this.getContext.bind(this),
      },
      
      version: "1.0.0",
    };
  }
  
  /**
   * Wrap an API method with rate limiting and error handling
   */
  private wrapAPI<T extends (...args: any[]) => any>(
    methodName: string,
    fn: T,
  ): T {
    return ((...args: any[]) => {
      // Check if method is blocked
      if (this.policy.blockedMethods?.includes(methodName)) {
        throw new Error(`Method ${methodName} is blocked by security policy`);
      }
      
      // Rate limiting
      if (!this.rateLimiter.checkLimit(methodName)) {
        throw new Error(`Rate limit exceeded for ${methodName}`);
      }
      
      try {
        this.log(`[API] ${methodName}(${JSON.stringify(args)})`);
        return fn(...args);
      } catch (error) {
        this.log(`[API Error] ${methodName}: ${error}`);
        throw error;
      }
    }) as T;
  }
  
  /**
   * Variable API methods
   */
  private getVariable(key: string): any {
    return this.context.variables?.[key];
  }
  
  private setVariable(key: string, value: any): void {
    if (!this.context.variables) {
      this.context.variables = {};
    }
    this.context.variables[key] = value;
    
    // Notify parent if bridge available
    if (this.messageBridge) {
      this.messageBridge.send("API_CALL", {
        method: "setVariable",
        args: [key, value],
      });
    }
  }
  
  private deleteVariable(key: string): void {
    if (this.context.variables) {
      delete this.context.variables[key];
    }
    
    // Notify parent if bridge available
    if (this.messageBridge) {
      this.messageBridge.send("API_CALL", {
        method: "deleteVariable",
        args: [key],
      });
    }
  }
  
  private listVariables(): string[] {
    return Object.keys(this.context.variables || {});
  }
  
  /**
   * Event API methods
   */
  private addEventListener(eventName: string, handler: Function): void {
    this.eventEmitter.on(eventName, handler as any);
  }
  
  private addEventListenerOnce(eventName: string, handler: Function): void {
    this.eventEmitter.once(eventName, handler as any);
  }
  
  private removeEventListener(eventName: string, handler?: Function): void {
    this.eventEmitter.off(eventName, handler as any);
  }
  
  private emitEvent(eventName: string, data?: any): void {
    this.eventEmitter.emit(eventName, data);
  }
  
  /**
   * World book API methods (placeholder)
   */
  private getWorldbookEntry(id: string): any {
    // TODO: Implement world book integration
    this.log(`[Worldbook] Get entry: ${id} (not implemented)`);
    return null;
  }
  
  private searchWorldbook(query: string): any[] {
    // TODO: Implement world book search
    this.log(`[Worldbook] Search: ${query} (not implemented)`);
    return [];
  }
  
  /**
   * Utility methods
   */
  private log(...args: any[]): void {
    const message = args.map(arg =>
      typeof arg === "object" ? JSON.stringify(arg) : String(arg),
    ).join(" ");
    
    this.logs.push(`[${new Date().toISOString()}] ${message}`);
    console.log("[Sandbox]", ...args);
  }
  
  private async waitFor(ms: number): Promise<void> {
    if (ms > 60000) {
      throw new Error("Wait time cannot exceed 60 seconds");
    }
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private getContext(): ScriptContext {
    // Return a copy to prevent modification
    return {
      ...this.context,
      variables: { ...this.context.variables },
      metadata: { ...this.context.metadata },
    };
  }
  
  /**
   * Get all logs
   */
  getLogs(): string[] {
    return [...this.logs];
  }
  
  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }
  
  /**
   * Get the security policy
   */
  getPolicy(): SecurityPolicy {
    return { ...this.policy };
  }
  
  /**
   * Update the context
   */
  updateContext(updates: Partial<ScriptContext>): void {
    this.context = {
      ...this.context,
      ...updates,
    };
  }
}

/**
 * Create a sandbox context with default configuration
 */
export function createSandboxContext(
  context: ScriptContext,
  eventEmitter: ScriptEventEmitter,
  options?: {
    messageBridge?: MessageBridge;
    policy?: Partial<SecurityPolicy>;
  },
): SandboxContext {
  return new SandboxContext(context, eventEmitter, options);
}
