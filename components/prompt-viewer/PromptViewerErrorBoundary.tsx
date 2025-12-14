/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词查看器错误边界组件                                ║
 * ║                                                                            ║
 * ║  捕获提示词查看器内部的所有错误，提供优雅降级UI                              ║
 * ║  设计原则：错误隔离、优雅降级、不影响主应用功能                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { Component, ReactNode, ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PromptViewerError, PromptViewerErrorType } from "@/types/prompt-viewer";

/* ═══════════════════════════════════════════════════════════════════════════
   错误边界状态接口
   ═══════════════════════════════════════════════════════════════════════════ */

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
}

interface PromptViewerErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: PromptViewerError) => void;
  maxRetries?: number;
  className?: string;
}

/**
 * 错误详情上报数据结构
 */
interface ErrorReportDetails {
  message: string;
  stack: string | undefined;
  componentStack: string | undefined;
  errorId: string;
  timestamp: string;
  userAgent: string;
  url: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   错误边界组件实现
   ═══════════════════════════════════════════════════════════════════════════ */

export class PromptViewerErrorBoundary extends Component<
  PromptViewerErrorBoundaryProps,
  ErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: PromptViewerErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
      retryCount: 0,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     React 错误边界生命周期方法
     ═══════════════════════════════════════════════════════════════════════════ */

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 更新状态以显示错误UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 更新错误信息
    this.setState({
      errorInfo,
    });

    // 记录错误日志
    this.logError(error, errorInfo);

    // 通知外部错误处理器
    this.notifyErrorHandler(error, errorInfo);
  }

  componentWillUnmount() {
    // 清理定时器
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     错误处理方法
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * 记录错误日志
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * 错误日志处理
   * - 规范化 componentStack 类型（将 null 转换为 undefined）
   * - 记录到控制台
   * - 上报到错误监控服务
   * ═══════════════════════════════════════════════════════════════════════════
   */
  private logError = (error: Error, errorInfo: ErrorInfo) => {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "unknown",
      url: typeof window !== "undefined" ? window.location.href : "unknown",
    };

    // 控制台错误日志
    console.group(`🚨 [PromptViewerErrorBoundary] 错误捕获 - ${this.state.errorId}`);
    console.error("错误信息:", error.message);
    console.error("错误堆栈:", error.stack);
    console.error("组件堆栈:", errorInfo.componentStack);
    console.error("完整错误详情:", errorDetails);
    console.groupEnd();

    // 可以在这里添加错误上报逻辑
    // 例如发送到错误监控服务
    this.reportErrorToService(errorDetails);
  };

  /**
   * 通知外部错误处理器
   */
  private notifyErrorHandler = (error: Error, errorInfo: ErrorInfo) => {
    if (this.props.onError) {
      const promptViewerError: PromptViewerError = {
        type: this.categorizeError(error),
        message: error.message,
        details: {
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          errorId: this.state.errorId,
        },
        timestamp: Date.now(),
      };

      try {
        this.props.onError(promptViewerError);
      } catch (handlerError) {
        console.error("[PromptViewerErrorBoundary] 错误处理器执行失败:", handlerError);
      }
    }
  };

  /**
   * 错误分类
   */
  private categorizeError = (error: Error): PromptViewerErrorType => {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || "";

    // 拦截相关错误
    if (message.includes("interception") || message.includes("拦截")) {
      return "INTERCEPTION_FAILED" as PromptViewerErrorType;
    }

    // 搜索相关错误
    if (message.includes("search") || message.includes("regex") || message.includes("搜索")) {
      return "SEARCH_INVALID" as PromptViewerErrorType;
    }

    // 内容过大错误
    if (message.includes("too large") || message.includes("memory") || message.includes("过大")) {
      return "CONTENT_TOO_LARGE" as PromptViewerErrorType;
    }

    // 图片加载错误
    if (message.includes("image") || message.includes("图片") || stack.includes("imagegallery")) {
      return "IMAGE_LOAD_FAILED" as PromptViewerErrorType;
    }

    return "UNKNOWN" as PromptViewerErrorType;
  };

  /**
   * 上报错误到监控服务
   */
  private reportErrorToService = (errorDetails: ErrorReportDetails) => {
    // 这里可以集成错误监控服务
    // 例如 Sentry、LogRocket 等
    try {
      // 示例：发送到自定义错误收集端点
      if (typeof window !== "undefined") {
        // 异步发送，不阻塞UI
        setTimeout(() => {
          fetch("/api/errors", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              component: "PromptViewerErrorBoundary",
              ...errorDetails,
            }),
          }).catch((reportError) => {
            console.warn("[PromptViewerErrorBoundary] 错误上报失败:", reportError);
          });
        }, 0);
      }
    } catch (reportError) {
      console.warn("[PromptViewerErrorBoundary] 错误上报失败:", reportError);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     用户操作处理
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * 重试操作
   */
  private handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      console.warn("[PromptViewerErrorBoundary] 已达到最大重试次数");
      return;
    }

    console.log(`[PromptViewerErrorBoundary] 重试 ${retryCount + 1}/${maxRetries}`);

    // 重置错误状态
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: retryCount + 1,
    });

    // 延迟重试，给组件时间恢复
    this.retryTimeoutId = setTimeout(() => {
      // 强制重新渲染
      this.forceUpdate();
    }, 100);
  };

  /**
   * 重置错误状态
   */
  private handleReset = () => {
    console.log("[PromptViewerErrorBoundary] 重置错误状态");

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
      retryCount: 0,
    });
  };

  /**
   * 关闭错误提示
   */
  private handleDismiss = () => {
    console.log("[PromptViewerErrorBoundary] 关闭错误提示");
    this.handleReset();
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     渲染方法
     ═══════════════════════════════════════════════════════════════════════════ */

  render() {
    const { hasError, error, retryCount } = this.state;
    const { children, fallback, maxRetries = 3, className } = this.props;

    // 正常渲染子组件
    if (!hasError) {
      return children;
    }

    // 如果提供了自定义降级UI，使用它
    if (fallback) {
      return fallback;
    }

    // 渲染默认错误UI
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center",
          "min-h-64 p-6 bg-background border border-border rounded-lg",
          "text-center space-y-4",
          className,
        )}
      >
        {/* 错误图标 */}
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>

        {/* 错误标题 */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            提示词查看器出现错误
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {this.getErrorMessage(error)}
          </p>
        </div>

        {/* 错误详情（开发环境） */}
        {process.env.NODE_ENV === "development" && error && (
          <details className="w-full max-w-md">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              查看技术详情
            </summary>
            <div className="mt-2 p-3 bg-muted rounded text-xs text-left font-mono">
              <div className="text-destructive font-semibold mb-1">
                {error.name}: {error.message}
              </div>
              {error.stack && (
                <pre className="whitespace-pre-wrap text-muted-foreground">
                  {error.stack.split("\n").slice(0, 5).join("\n")}
                </pre>
              )}
            </div>
          </details>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          {/* 重试按钮 */}
          {retryCount < maxRetries && (
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              重试 ({retryCount}/{maxRetries})
            </Button>
          )}

          {/* 重置按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            重置
          </Button>
        </div>

        {/* 帮助信息 */}
        <p className="text-xs text-muted-foreground max-w-md">
          此错误不会影响其他功能的正常使用。如果问题持续存在，请尝试刷新页面。
        </p>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     辅助方法
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * 获取用户友好的错误消息
   */
  private getErrorMessage = (error: Error | null): string => {
    if (!error) return "未知错误";

    const message = error.message.toLowerCase();

    // 根据错误类型返回友好的消息
    if (message.includes("interception") || message.includes("拦截")) {
      return "无法获取提示词内容，请尝试刷新或重新发送消息";
    }

    if (message.includes("search") || message.includes("regex") || message.includes("搜索")) {
      return "搜索功能出现问题，请检查搜索条件或清空搜索框";
    }

    if (message.includes("too large") || message.includes("memory") || message.includes("过大")) {
      return "提示词内容过大，可能导致显示问题";
    }

    if (message.includes("image") || message.includes("图片")) {
      return "图片加载失败，但文本内容仍可正常查看";
    }

    if (message.includes("network") || message.includes("fetch")) {
      return "网络连接问题，请检查网络状态";
    }

    // 默认消息
    return "组件内部出现错误，但不会影响其他功能";
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   便捷包装组件
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 提示词查看器错误边界包装器
 * 提供默认配置和样式
 */
export function withPromptViewerErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: {
    fallback?: ReactNode;
    onError?: (error: PromptViewerError) => void;
    maxRetries?: number;
  },
) {
  const WithErrorBoundary = (props: P) => (
    <PromptViewerErrorBoundary
      fallback={options?.fallback}
      onError={options?.onError}
      maxRetries={options?.maxRetries}
    >
      <WrappedComponent {...props} />
    </PromptViewerErrorBoundary>
  );

  WithErrorBoundary.displayName = `withPromptViewerErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name
  })`;

  return WithErrorBoundary;
}

/* ═══════════════════════════════════════════════════════════════════════════
   错误处理工具函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 创建错误处理器
 */
export function createErrorHandler(context: string) {
  return (error: PromptViewerError) => {
    console.group(`🚨 [${context}] 提示词查看器错误`);
    console.error("错误类型:", error.type);
    console.error("错误消息:", error.message);
    console.error("错误详情:", error.details);
    console.error("发生时间:", new Date(error.timestamp).toLocaleString());
    console.groupEnd();

    // 可以在这里添加更多的错误处理逻辑
    // 例如发送到错误监控服务、显示用户通知等
  };
}

/**
 * 安全执行函数，捕获并处理错误
 */
export function safeExecute<T>(
  fn: () => T,
  fallback: T,
  context: string = "unknown",
): T {
  try {
    return fn();
  } catch (error) {
    console.error(`[${context}] 安全执行失败:`, error);
    return fallback;
  }
}

/**
 * 异步安全执行函数
 */
export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  context: string = "unknown",
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[${context}] 异步安全执行失败:`, error);
    return fallback;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出
   ═══════════════════════════════════════════════════════════════════════════ */

export default PromptViewerErrorBoundary;
