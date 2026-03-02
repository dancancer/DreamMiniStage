/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词拦截器实现                                        ║
 * ║                                                                            ║
 * ║  拦截对话生成请求，获取完整提示词内容                                        ║
 * ║  设计原则：非侵入式、可靠拦截、不影响正常对话流程                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { PromptInterceptor, PromptData } from "@/types/prompt-viewer";
import { generateId } from "@/lib/prompt-viewer/constants";
import { resourceManager } from "@/lib/prompt-viewer/resource-manager";
import { buildPromptFromDialogue, extractImages, buildFullPromptText } from "./prompt-builder";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface InterceptorConfig {
  dialogueKey: string;
  isActive: boolean;
  lastPrompt: PromptData | null;
  callbacks: Set<(prompt: PromptData) => void>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   提示词拦截器实现
   ═══════════════════════════════════════════════════════════════════════════ */

export class PromptInterceptorImpl implements PromptInterceptor {
  private interceptors = new Map<string, InterceptorConfig>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isDestroyed = false;
  private boundEventHandler: ((e: Event) => void) | null = null;

  constructor() {
    this.startCleanupTimer();
    this.registerWithResourceManager();
    this.setupPromptCaptureListener();
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     公开 API
     ═══════════════════════════════════════════════════════════════════════════ */

  startInterception(dialogueKey: string): void {
    if (!dialogueKey) return;
    this.interceptors.set(dialogueKey, {
      dialogueKey,
      isActive: true,
      lastPrompt: null,
      callbacks: new Set(),
    });
    console.log(`[PromptInterceptor] 开始拦截: ${dialogueKey}`);
  }

  stopInterception(dialogueKey: string): void {
    if (!dialogueKey) return;
    const config = this.interceptors.get(dialogueKey);
    if (config) {
      config.isActive = false;
      config.callbacks.clear();
    }
    this.interceptors.delete(dialogueKey);
    console.log(`[PromptInterceptor] 停止拦截: ${dialogueKey}`);
  }

  async triggerInterception(dialogueKey: string, characterId: string): Promise<PromptData> {
    if (!dialogueKey || !characterId) {
      throw new Error("缺少必要参数：dialogueKey 和 characterId 不能为空");
    }

    try {
      console.log(`[PromptInterceptor] 手动触发: ${dialogueKey}, ${characterId}`);
      const promptData = await buildPromptFromDialogue(dialogueKey, characterId);
      this.updateAndNotify(dialogueKey, promptData);
      console.log(`[PromptInterceptor] 拦截成功: ${promptData.id}`);
      return promptData;
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  getLatestPrompt(dialogueKey: string): PromptData | null {
    return dialogueKey ? this.interceptors.get(dialogueKey)?.lastPrompt || null : null;
  }

  isIntercepting(dialogueKey: string): boolean {
    return dialogueKey ? this.interceptors.get(dialogueKey)?.isActive || false : false;
  }

  addInterceptionCallback(dialogueKey: string, callback: (prompt: PromptData) => void): void {
    if (!dialogueKey || !callback) return;
    this.interceptors.get(dialogueKey)?.callbacks.add(callback);
  }

  removeInterceptionCallback(dialogueKey: string, callback: (prompt: PromptData) => void): void {
    if (!dialogueKey || !callback) return;
    this.interceptors.get(dialogueKey)?.callbacks.delete(callback);
  }

  destroy(): void {
    if (this.isDestroyed) return;
    console.log("[PromptInterceptor] 销毁实例");
    this.isDestroyed = true;

    // 移除事件监听
    if (typeof window !== "undefined" && this.boundEventHandler) {
      window.removeEventListener("llm-prompt-captured", this.boundEventHandler);
      this.boundEventHandler = null;
    }

    // 停止所有拦截
    for (const key of this.interceptors.keys()) {
      this.stopInterception(key);
    }
    this.interceptors.clear();
    this.stopCleanupTimer();
    console.log("[PromptInterceptor] 销毁完成");
  }

  isInstanceDestroyed(): boolean {
    return this.isDestroyed;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     私有方法
     ═══════════════════════════════════════════════════════════════════════════ */

  /** 监听 LLM 实际发送的提示词事件 */
  private setupPromptCaptureListener(): void {
    if (typeof window === "undefined") return;

    this.boundEventHandler = (e: Event) => {
      const { dialogueKey, characterId, modelName, timestamp, messages } =
        (e as CustomEvent).detail;
      
      const config = this.interceptors.get(dialogueKey);
      if (!config?.isActive) return;

      const eventMessages = Array.isArray(messages) ? messages : [];
      if (eventMessages.length === 0) {
        console.warn("[PromptInterceptor] 忽略空 messages 事件", { dialogueKey });
        return;
      }

      const promptMessages = eventMessages.map((m: { role: string; content: string }) => ({
        id: generateId("msg"),
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }));

      const systemMessage = promptMessages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");
      const userMessage = [...promptMessages].reverse().find((m) => m.role === "user")?.content || "";
      const fullPrompt = buildFullPromptText(
        systemMessage,
        userMessage,
        promptMessages.map(({ role, content }) => ({ role, content })),
      );

      const promptData: PromptData = {
        id: generateId("prompt"),
        timestamp,
        systemMessage,
        userMessage,
        fullPrompt,
        images: extractImages(fullPrompt),
        metadata: { characterId, dialogueKey, modelName, temperature: 0.7 },
        messages: promptMessages,
      };

      this.updateAndNotify(dialogueKey, promptData);
      console.log(`[PromptInterceptor] 捕获实际提示词: ${dialogueKey}`);
    };

    window.addEventListener("llm-prompt-captured", this.boundEventHandler);
    console.log("[PromptInterceptor] 已注册事件监听器");
  }

  /** 更新缓存并通知回调 */
  private updateAndNotify(dialogueKey: string, promptData: PromptData): void {
    const config = this.interceptors.get(dialogueKey);
    if (!config) return;
    
    config.lastPrompt = promptData;
    config.callbacks.forEach(cb => {
      try { cb(promptData); } catch (err) { console.error("[PromptInterceptor] 回调失败:", err); }
    });
  }

  /** 包装错误信息 */
  private wrapError(error: unknown): Error {
    const msg = error instanceof Error ? error.message : "未知错误";
    console.error("[PromptInterceptor] 拦截失败:", error);
    
    if (msg.includes("角色不存在")) return new Error(`角色加载失败: ${msg}`);
    if (msg.includes("对话不存在")) return new Error(`对话数据获取失败: ${msg}`);
    if (msg.includes("网络") || msg.includes("fetch")) return new Error(`网络连接失败: ${msg}`);
    return new Error(`拦截提示词失败: ${msg}`);
  }

  /** 清理过期拦截器 */
  private cleanupExpiredInterceptors(): void {
    const now = Date.now();
    const EXPIRY = 30 * 60 * 1000; // 30分钟

    for (const [key, config] of this.interceptors.entries()) {
      if (config.lastPrompt && now - config.lastPrompt.timestamp > EXPIRY) {
        console.log(`[PromptInterceptor] 清理过期: ${key}`);
        this.stopInterception(key);
      }
    }
  }

  private startCleanupTimer(): void {
    if (typeof window === "undefined" || this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      if (this.isDestroyed) { this.stopCleanupTimer(); return; }
      try { this.cleanupExpiredInterceptors(); } catch (e) { console.error("[PromptInterceptor] 清理出错:", e); }
    }, 5 * 60 * 1000);
    console.log("[PromptInterceptor] 启动清理定时器");
  }

  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private registerWithResourceManager(): void {
    resourceManager.registerCleanup("prompt-interceptor", () => this.destroy());
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   单例导出与全局事件处理
   ═══════════════════════════════════════════════════════════════════════════ */

export const promptInterceptor = new PromptInterceptorImpl();

if (typeof window !== "undefined") {
  const cleanup = () => promptInterceptor.destroy();
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      promptInterceptor["cleanupExpiredInterceptors"]();
    }
  };

  window.addEventListener("beforeunload", cleanup);
  document.addEventListener("visibilitychange", onVisibilityChange);

  (window as unknown as Record<string, unknown>).__promptInterceptorCleanup = () => {
    window.removeEventListener("beforeunload", cleanup);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    promptInterceptor.destroy();
  };
}

// 重新导出构建器工具
export { createPromptDataBuilder } from "./prompt-builder";
