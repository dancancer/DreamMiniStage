/**
 * Script Executor Module
 * 
 * Core script execution engine that manages iframe lifecycle,
 * injects scripts, handles execution, and provides results.
 */

import type {
  ScriptContext,
  ScriptExecutorOptions,
  ScriptExecutionResult,
  ScriptExecutePayload,
  ScriptResultPayload,
  ScriptErrorPayload,
} from "@/types/script-runner";
import { MessageBridge, createIframeBridge } from "./message-bridge";
import { ScriptEventEmitter, createEventEmitterWithBridge } from "./event-emitter";
import { SandboxContext, createSandboxContext } from "./sandbox-context";
import { GlobalEventBridge, createGlobalEventBridge } from "./global-event-bridge";
import { createTavernHelper, type TavernHelperAPI } from "./tavern-helper";

/**
 * Default executor options
 */
const DEFAULT_OPTIONS: Required<ScriptExecutorOptions> = {
  timeout: 30000,
  allowConsole: true,
  allowLibraries: false,
  allowedLibraries: [],
  allowVariableAccess: true,
  allowWorldBookAccess: false,
  allowEvents: true,
  sandboxUrl: "/iframe-libs/script-runner.html",
  cspPolicy: "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
};

/**
 * Script Executor
 * 
 * Manages the execution of user scripts in a sandboxed iframe environment.
 * Provides isolation, security, and communication with the main application.
 * 
 * @example
 * ```typescript
 * const executor = new ScriptExecutor({
 *   timeout: 5000,
 *   allowConsole: true,
 * });
 * 
 * const result = await executor.execute(
 *   'return 1 + 1',
 *   { variables: { x: 10 } }
 * );
 * 
 * console.log(result.result); // 2
 * ```
 */
export class ScriptExecutor {
  private options: Required<ScriptExecutorOptions>;
  private iframe: HTMLIFrameElement | null = null;
  private bridge: MessageBridge | null = null;
  private eventEmitter: ScriptEventEmitter | null = null;
  private sandboxContext: SandboxContext | null = null;
  private globalEventBridge: GlobalEventBridge | null = null;
  private tavernHelper: TavernHelperAPI | null = null;
  private isReady: boolean = false;
  private readyPromise: Promise<void> | null = null;
  
  constructor(options?: ScriptExecutorOptions) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }
  
  /**
   * Initialize the iframe and sandbox environment
   */
  private async initializeIframe(): Promise<void> {
    if (this.iframe && this.isReady) {
      return this.readyPromise!;
    }
    
    // Create promise for ready state
    this.readyPromise = new Promise<void>((resolve, reject) => {
      // Create iframe
      this.iframe = document.createElement("iframe");
      this.iframe.style.display = "none";
      this.iframe.setAttribute("sandbox", "allow-scripts");
      this.iframe.src = this.options.sandboxUrl;
      
      // Set up ready listener
      const readyTimeout = setTimeout(() => {
        reject(new Error("Iframe initialization timeout"));
      }, 10000);
      
      this.iframe.onload = async () => {
        clearTimeout(readyTimeout);
        
        try {
          // Create message bridge
          this.bridge = createIframeBridge(this.iframe!, {
            debug: false,
            timeout: this.options.timeout,
          });

          // TavernHelper API 调用处理
          this.bridge.on("API_CALL", (message) => {
            const payload = message.payload as Record<string, unknown>;
            const method = payload?.method as string | undefined;
            const args = (payload?.args as unknown[] | undefined) || [];
            const reply = (result: unknown) => {
              if (!message.id) return;
              this.bridge?.send("API_RESPONSE", { result }, message.id);
            };

            // 如果还没有 TavernHelper 实例,返回错误
            if (!this.tavernHelper) {
              reply({ error: "TavernHelper not initialized" });
              return;
            }

            // 调用 TavernHelper 方法
            const helperMethod = this.tavernHelper[method as keyof TavernHelperAPI];
            if (typeof helperMethod !== "function") {
              reply({ error: `Unknown API method: ${method}` });
              return;
            }

            try {
              const result = (helperMethod as (...args: unknown[]) => unknown)(...args);

              // 处理异步结果
              if (result instanceof Promise) {
                result
                  .then((res) => reply(res))
                  .catch((err) => reply({ error: err instanceof Error ? err.message : String(err) }));
              } else {
                reply(result);
              }
            } catch (err: unknown) {
              reply({ error: err instanceof Error ? err.message : String(err) });
            }
          });
          
          // Create event emitter
          this.eventEmitter = createEventEmitterWithBridge(this.bridge);
          
          // Create global event bridge (connects sandbox events to global event system)
          if (this.options.allowEvents) {
            this.globalEventBridge = createGlobalEventBridge(this.eventEmitter);
          }
          
          // Wait for iframe to signal ready
          await new Promise<void>((resolveReady, rejectReady) => {
            const readyHandler = this.bridge!.once("READY", () => {
              resolveReady();
            });
            
            setTimeout(() => {
              rejectReady(new Error("Iframe ready timeout"));
            }, 5000);
          });
          
          this.isReady = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      this.iframe.onerror = () => {
        clearTimeout(readyTimeout);
        reject(new Error("Failed to load iframe"));
      };
      
      // Append to body
      document.body.appendChild(this.iframe);
    });
    
    return this.readyPromise;
  }
  
  /**
   * Execute a script
   * 
   * @param code - The JavaScript code to execute
   * @param context - Execution context (variables, metadata, etc.)
   * @returns Execution result
   */
  async execute(
    code: string,
    context?: ScriptContext,
  ): Promise<ScriptExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Initialize if not ready
      if (!this.isReady) {
        await this.initializeIframe();
      }
      
      if (!this.bridge || !this.eventEmitter) {
        throw new Error("Executor not properly initialized");
      }
      
      // Create TavernHelper instance
      const sandboxCtx = context || {};
      const scriptId = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.tavernHelper = createTavernHelper(scriptId, sandboxCtx);

      // Create sandbox context
      this.sandboxContext = createSandboxContext(
        sandboxCtx,
        this.eventEmitter,
        { messageBridge: this.bridge },
      );
      
      // Prepare execute payload
      const payload: ScriptExecutePayload = {
        code,
        context: sandboxCtx,
        timeout: this.options.timeout,
      };
      
      // Send execution request and wait for result
      const resultPromise = new Promise<ScriptResultPayload>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Script execution timeout"));
        }, this.options.timeout);
        
        // Listen for result
        const resultHandler = this.bridge!.once("SCRIPT_RESULT", (message) => {
          clearTimeout(timeout);
          resolve(message.payload as ScriptResultPayload);
        });
        
        // Listen for error
        const errorHandler = this.bridge!.once("SCRIPT_ERROR", (message) => {
          clearTimeout(timeout);
          reject(new Error((message.payload as ScriptErrorPayload).error));
        });
      });
      
      // Send script
      this.bridge.send("SCRIPT_EXECUTE", payload);
      
      // Wait for result
      const result = await resultPromise;
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        result: result.result,
        executionTime,
        consoleOutput: this.sandboxContext.getLogs(),
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
        executionTime,
        consoleOutput: this.sandboxContext?.getLogs() || [],
      };
    } finally {
      // 清理 TavernHelper 资源
      if (this.tavernHelper) {
        this.tavernHelper._cleanup();
      }
    }
  }
  
  /**
   * Execute multiple scripts sequentially
   */
  async executeMany(
    scripts: Array<{ code: string; context?: ScriptContext }>,
  ): Promise<ScriptExecutionResult[]> {
    const results: ScriptExecutionResult[] = [];
    
    for (const script of scripts) {
      const result = await this.execute(script.code, script.context);
      results.push(result);
      
      // Stop on first error
      if (!result.success) {
        break;
      }
    }
    
    return results;
  }
  
  /**
   * Check if the executor is ready
   */
  ready(): boolean {
    return this.isReady;
  }
  
  /**
   * Get the event emitter for listening to events
   */
  getEventEmitter(): ScriptEventEmitter | null {
    return this.eventEmitter;
  }
  
  /**
   * Get the message bridge for direct communication
   */
  getMessageBridge(): MessageBridge | null {
    return this.bridge;
  }
  
  /**
   * Get sandbox context logs
   */
  getLogs(): string[] {
    return this.sandboxContext?.getLogs() || [];
  }
  
  /**
   * Clear logs
   */
  clearLogs(): void {
    this.sandboxContext?.clearLogs();
  }
  
  /**
   * Clean up and destroy the executor
   */
  destroy(): void {
    this.isReady = false;
    this.readyPromise = null;

    // Cleanup TavernHelper
    if (this.tavernHelper) {
      this.tavernHelper._cleanup();
      this.tavernHelper = null;
    }

    // Destroy global event bridge
    if (this.globalEventBridge) {
      this.globalEventBridge.destroy();
      this.globalEventBridge = null;
    }

    // Destroy message bridge
    if (this.bridge) {
      this.bridge.destroy();
      this.bridge = null;
    }

    // Destroy event emitter
    if (this.eventEmitter) {
      this.eventEmitter.destroy();
      this.eventEmitter = null;
    }

    // Remove iframe
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
      this.iframe = null;
    }

    // Clear sandbox context
    this.sandboxContext = null;
  }
}

/**
 * Create a script executor with options
 */
export function createExecutor(options?: ScriptExecutorOptions): ScriptExecutor {
  return new ScriptExecutor(options);
}

/**
 * Execute a script with a one-time executor
 * Useful for quick one-off script execution
 */
export async function executeScript(
  code: string,
  context?: ScriptContext,
  options?: ScriptExecutorOptions,
): Promise<ScriptExecutionResult> {
  const executor = new ScriptExecutor(options);
  try {
    return await executor.execute(code, context);
  } finally {
    executor.destroy();
  }
}
