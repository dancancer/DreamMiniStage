/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                          Toast Store                                     ║
 * ║                                                                          ║
 * ║  全局 Toast 通知管理 - 基于 Zustand + Sonner                              ║
 * ║  消除重复的 errorToast 状态，统一管理所有通知                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { create } from "zustand";
import { toast as sonnerToast } from "sonner";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Store 定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface ToastStore {
  // ─── 基础方法 ───
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  loading: (message: string, options?: ToastOptions) => string | number;
  
  // ─── 高级方法 ───
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => Promise<T>;
  
  dismiss: (toastId?: string | number) => void;
  dismissAll: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Store 实现
   ═══════════════════════════════════════════════════════════════════════════ */

export const useToast = create<ToastStore>(() => ({
  // ─── 成功通知 ───
  success: (message, options) => {
    sonnerToast.success(options?.title || message, {
      description: options?.description || (options?.title ? message : undefined),
      duration: options?.duration,
      action: options?.action,
    });
  },

  // ─── 错误通知 ───
  error: (message, options) => {
    sonnerToast.error(options?.title || message, {
      description: options?.description || (options?.title ? message : undefined),
      duration: options?.duration,
      action: options?.action,
    });
  },

  // ─── 警告通知 ───
  warning: (message, options) => {
    sonnerToast.warning(options?.title || message, {
      description: options?.description || (options?.title ? message : undefined),
      duration: options?.duration,
      action: options?.action,
    });
  },

  // ─── 信息通知 ───
  info: (message, options) => {
    sonnerToast.info(options?.title || message, {
      description: options?.description || (options?.title ? message : undefined),
      duration: options?.duration,
      action: options?.action,
    });
  },

  // ─── 加载通知 ───
  loading: (message, options) => {
    return sonnerToast.loading(options?.title || message, {
      description: options?.description || (options?.title ? message : undefined),
    });
  },

  // ─── Promise 通知 ───
  // 注意：Sonner 的 promise 返回带 unwrap 方法的特殊对象，不是纯 Promise
  // 如果需要原始 Promise 结果，使用 .unwrap() 或直接 await 原始 promise
  promise: (promise, messages) => {
    sonnerToast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    });
    return promise; // 返回原始 promise，保持类型一致
  },

  // ─── 关闭通知 ───
  dismiss: (toastId) => {
    sonnerToast.dismiss(toastId);
  },

  // ─── 关闭所有通知 ───
  dismissAll: () => {
    sonnerToast.dismiss();
  },
}));

/* ═══════════════════════════════════════════════════════════════════════════
   便捷导出 - 可以直接使用而不需要 hook
   ═══════════════════════════════════════════════════════════════════════════ */

export const toast = {
  success: (message: string, options?: ToastOptions) => 
    useToast.getState().success(message, options),
  
  error: (message: string, options?: ToastOptions) => 
    useToast.getState().error(message, options),
  
  warning: (message: string, options?: ToastOptions) => 
    useToast.getState().warning(message, options),
  
  info: (message: string, options?: ToastOptions) => 
    useToast.getState().info(message, options),
  
  loading: (message: string, options?: ToastOptions) => 
    useToast.getState().loading(message, options),
  
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    },
  ) => useToast.getState().promise(promise, messages),
  
  dismiss: (toastId?: string | number) => 
    useToast.getState().dismiss(toastId),
  
  dismissAll: () => 
    useToast.getState().dismissAll(),
};
