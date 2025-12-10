/**
 * Event System Module
 * 
 * Provides a robust event emitter system for script execution environment.
 * Wraps the emittery library and extends it with cross-iframe event passing
 * capabilities for seamless communication between parent and sandbox.
 */

import Emittery from "emittery";
import type { EventEmitter, EventHandler, UnsubscribeFunction } from "@/types/script-runner";
import { MessageBridge } from "./message-bridge";

/**
 * Script Event Emitter
 * 
 * Enhanced event emitter that supports:
 * - Type-safe event handling
 * - Cross-iframe event propagation
 * - One-time listeners
 * - Event namespacing
 * - Async event handlers
 * 
 * @example
 * ```typescript
 * const events = new ScriptEventEmitter();
 * 
 * // Listen to event
 * events.on('message:received', (data) => {
 *   console.log('Message:', data);
 * });
 * 
 * // Emit event
 * events.emit('message:received', { text: 'Hello!' });
 * 
 * // One-time listener
 * events.once('ready', () => {
 *   console.log('Ready!');
 * });
 * ```
 */
export class ScriptEventEmitter implements EventEmitter {
  private emitter: Emittery;
  private messageBridge?: MessageBridge;
  private bridgeEnabled: boolean;
  private localOnly: Set<string>;
  
  constructor(options?: {
    messageBridge?: MessageBridge;
    enableBridge?: boolean;
    localOnlyEvents?: string[];
  }) {
    this.emitter = new Emittery();
    this.messageBridge = options?.messageBridge;
    this.bridgeEnabled = options?.enableBridge ?? true;
    this.localOnly = new Set(options?.localOnlyEvents || []);
    
    // Set up bridge listener if available
    if (this.messageBridge && this.bridgeEnabled) {
      this.setupBridgeListener();
    }
  }
  
  /**
   * Set up message bridge to receive events from other side
   */
  private setupBridgeListener(): void {
    if (!this.messageBridge) return;
    
    this.messageBridge.on("EVENT_EMIT", (message) => {
      const { eventName, data } = message.payload as { eventName: string; data: any };
      
      // Emit locally without propagating back through bridge
      this.emitLocal(eventName, data);
    });
  }
  
  /**
   * Register an event handler
   */
  on<T = any>(eventName: string, handler: EventHandler<T>): UnsubscribeFunction {
    const unsubscribe = this.emitter.on(eventName, handler as any);
    
    // Return unsubscribe function
    return () => {
      unsubscribe();
    };
  }
  
  /**
   * Register a one-time event handler
   */
  once<T = any>(eventName: string, handler: EventHandler<T>): UnsubscribeFunction {
    const unsubscribe = this.emitter.once(eventName).then(handler as any);
    
    // Return unsubscribe function (though it will auto-unsubscribe after first trigger)
    return () => {
      // Emittery doesn't provide a way to cancel .once(), 
      // so we just remove all listeners for this event
      this.emitter.clearListeners(eventName);
    };
  }
  
  /**
   * Unregister an event handler
   */
  off(eventName: string, handler?: EventHandler): void {
    if (handler) {
      this.emitter.off(eventName, handler as any);
    } else {
      this.emitter.clearListeners(eventName);
    }
  }
  
  /**
   * Emit an event
   * 
   * @param eventName - Name of the event
   * @param data - Event data to pass to handlers
   */
  async emit(eventName: string, data?: any): Promise<void> {
    // Check if this should be local only
    const isLocalOnly = this.localOnly.has(eventName);
    
    // Emit locally
    await this.emitLocal(eventName, data);
    
    // Propagate through bridge if enabled and not local-only
    if (
      this.messageBridge &&
      this.bridgeEnabled &&
      !isLocalOnly &&
      this.messageBridge.isValid()
    ) {
      try {
        this.messageBridge.send("EVENT_EMIT", {
          eventName,
          data,
        });
      } catch (error) {
        console.error("[ScriptEventEmitter] Failed to propagate event through bridge:", error);
      }
    }
  }
  
  /**
   * Emit event locally only (no bridge propagation)
   */
  private async emitLocal(eventName: string, data?: any): Promise<void> {
    try {
      await this.emitter.emit(eventName, data);
    } catch (error) {
      console.error(`[ScriptEventEmitter] Error in event handler for "${eventName}":`, error);
    }
  }
  
  /**
   * Get the number of listeners for an event
   */
  listenerCount(eventName?: string): number {
    if (eventName) {
      return this.emitter.listenerCount(eventName);
    }
    
    // Return total count across all events
    return this.emitter.listenerCount();
  }
  
  /**
   * Clear all listeners for an event or all events
   */
  clearListeners(eventName?: string): void {
    if (eventName) {
      this.emitter.clearListeners(eventName);
    } else {
      this.emitter.clearListeners();
    }
  }
  
  /**
   * Wait for an event to be emitted
   * 
   * @param eventName - Name of the event to wait for
   * @param timeout - Timeout in milliseconds (optional)
   * @returns Promise that resolves with event data
   */
  async waitFor<T = any>(eventName: string, timeout?: number): Promise<T> {
    if (timeout) {
      return Promise.race([
        this.emitter.once(eventName),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout waiting for event: ${eventName}`)), timeout),
        ),
      ]) as Promise<T>;
    }
    
    return this.emitter.once(eventName) as Promise<T>;
  }
  
  /**
   * Enable or disable bridge event propagation
   */
  setBridgeEnabled(enabled: boolean): void {
    this.bridgeEnabled = enabled;
  }
  
  /**
   * Mark an event as local-only (won't propagate through bridge)
   */
  setLocalOnly(eventName: string, localOnly: boolean = true): void {
    if (localOnly) {
      this.localOnly.add(eventName);
    } else {
      this.localOnly.delete(eventName);
    }
  }
  
  /**
   * Get all event names that have listeners
   */
  eventNames(): string[] {
    // Emittery doesn't expose this, so we track manually
    // For now, return empty array
    return [];
  }
  
  /**
   * Destroy the event emitter and clean up
   */
  destroy(): void {
    this.emitter.clearListeners();
    this.localOnly.clear();
  }
}

/**
 * Create a global event emitter instance
 * This can be shared across the application
 */
let globalEventEmitter: ScriptEventEmitter | null = null;

/**
 * Get or create the global event emitter
 */
export function getGlobalEventEmitter(): ScriptEventEmitter {
  if (!globalEventEmitter) {
    globalEventEmitter = new ScriptEventEmitter();
  }
  return globalEventEmitter;
}

/**
 * Set the global event emitter
 * Useful when you want to use a custom configured instance
 */
export function setGlobalEventEmitter(emitter: ScriptEventEmitter): void {
  globalEventEmitter = emitter;
}

/**
 * Create an event emitter with message bridge support
 * 
 * @param messageBridge - MessageBridge instance for cross-iframe events
 * @param options - Additional options
 * @returns ScriptEventEmitter instance
 */
export function createEventEmitterWithBridge(
  messageBridge: MessageBridge,
  options?: {
    enableBridge?: boolean;
    localOnlyEvents?: string[];
  },
): ScriptEventEmitter {
  return new ScriptEventEmitter({
    messageBridge,
    ...options,
  });
}

/**
 * Utility function to create a namespaced event name
 * 
 * @example
 * ```typescript
 * const eventName = namespaceEvent('chat', 'message:received');
 * // Returns: 'chat:message:received'
 * ```
 */
export function namespaceEvent(namespace: string, eventName: string): string {
  return `${namespace}:${eventName}`;
}

/**
 * Utility function to parse a namespaced event name
 * 
 * @example
 * ```typescript
 * const { namespace, event } = parseEventName('chat:message:received');
 * // Returns: { namespace: 'chat', event: 'message:received' }
 * ```
 */
export function parseEventName(eventName: string): { namespace?: string; event: string } {
  const parts = eventName.split(":");
  if (parts.length > 1) {
    return {
      namespace: parts[0],
      event: parts.slice(1).join(":"),
    };
  }
  return { event: eventName };
}

/**
 * Event emitter decorator for classes
 * Adds event emitter capabilities to any class
 * 
 * @example
 * ```typescript
 * @WithEventEmitter
 * class MyComponent {
 *   // Now has: on, once, off, emit methods via this.events
 * }
 * ```
 */
export function withEventEmitter<T extends { new (...args: any[]): {} }>(constructor: T) {
  return class extends constructor {
    events: ScriptEventEmitter = new ScriptEventEmitter();
    
    on = this.events.on.bind(this.events);
    once = this.events.once.bind(this.events);
    off = this.events.off.bind(this.events);
    emit = this.events.emit.bind(this.events);
  };
}
