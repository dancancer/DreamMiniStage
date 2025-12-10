/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词查看器触发按钮                                    ║
 * ║                                                                            ║
 * ║  集成到控制面板的触发按钮：启动提示词查看器弹窗                              ║
 * ║  设计原则：与现有控制面板样式一致，简洁的交互逻辑                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback, useEffect } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackButtonClick } from "@/utils/google-analytics";
import PromptViewerModal from "./PromptViewerModal";
import PromptViewerErrorBoundary, { createErrorHandler } from "./PromptViewerErrorBoundary";
import { getButtonStateStyles, getButtonResponsiveStyles } from "./styles";
import { registerComponentCleanup, unregisterComponentCleanup } from "@/lib/prompt-viewer/resource-manager";
import {
  useModalActions,
  useInterceptionActions,
  useViewerUIState,
  useInterceptionState,
  useCleanupActions,
} from "@/lib/store/prompt-viewer-store";
import type { PromptViewerButtonProps } from "@/types/prompt-viewer";

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export default function PromptViewerButton({
  dialogueKey,
  characterId,
  className = "",
  disabled = false,
}: PromptViewerButtonProps) {
  // ========== 状态管理 ==========
  const { openModal } = useModalActions();
  const { startInterception } = useInterceptionActions();
  const { cleanup } = useCleanupActions();
  const uiState = useViewerUIState(dialogueKey);
  const isIntercepting = useInterceptionState(dialogueKey);

  // ========== 错误处理 ==========
  const errorHandler = createErrorHandler(`PromptViewerButton-${dialogueKey}`);

  // ========== 事件处理 ==========

  const handleClick = useCallback(async () => {
    if (disabled || !dialogueKey || !characterId) return;

    try {
      // 分析追踪
      trackButtonClick("page", "打开提示词查看器");

      // 打开弹窗
      openModal(dialogueKey);

      // 如果还没有开始拦截，则启动拦截
      if (!isIntercepting) {
        await startInterception(dialogueKey);
      }

      console.log(`[PromptViewerButton] 打开查看器: ${dialogueKey}`);
    } catch (error) {
      console.error("[PromptViewerButton] 打开查看器失败:", error);
    }
  }, [
    disabled,
    dialogueKey,
    characterId,
    openModal,
    startInterception,
    isIntercepting,
  ]);

  // ========== 样式计算 ==========

  const isActive = uiState.isOpen;
  const isLoading = uiState.isLoading;
  const hasError = !!uiState.error;

  // 根据状态确定按钮样式
  const getButtonClassName = () => {
    return getButtonStateStyles({
      isActive,
      isLoading,
      hasError,
      disabled,
    });
  };

  // ========== 生命周期管理 ==========

  useEffect(() => {
    // 注册到资源管理器
    registerComponentCleanup("PromptViewerButton", dialogueKey, async () => {
      console.log(`[PromptViewerButton] 资源管理器清理: ${dialogueKey}`);
      cleanup(dialogueKey);
    });

    // 组件卸载时清理资源
    return () => {
      console.log(`[PromptViewerButton] 组件卸载，清理资源: ${dialogueKey}`);
      
      // 从资源管理器取消注册
      unregisterComponentCleanup("PromptViewerButton", dialogueKey);
      
      // 异步清理，避免阻塞卸载过程
      setTimeout(() => {
        cleanup(dialogueKey);
      }, 0);
    };
  }, [dialogueKey, cleanup]);

  // 获取按钮文本
  const getButtonText = () => {
    if (isLoading) return "加载中...";
    if (hasError) return "查看器错误";
    if (isActive) return "提示词查看器";
    return "查看提示词";
  };

  // 获取图标
  const getIcon = () => {
    return (
      <Eye 
        size={12} 
        className={`mr-1 ${isLoading ? "animate-pulse" : ""}`} 
      />
    );
  };

  // ========== 渲染 ==========

  return (
    <PromptViewerErrorBoundary
      onError={errorHandler}
      maxRetries={2}
      className="inline-block"
    >
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={`${getButtonClassName()} ${className}`}
        title={hasError ? uiState.error || "查看器出现错误" : "查看发送给AI的完整提示词"}
      >
        <span className="flex items-center">
          {getIcon()}
          <span className="text-2xs sm:text-xs">
            {getButtonText()}
          </span>
        </span>
      </Button>

      {/* 提示词查看器弹窗 - 使用错误边界保护 */}
      <PromptViewerErrorBoundary
        onError={errorHandler}
        maxRetries={3}
      >
        <PromptViewerModal
          isOpen={isActive}
          onClose={() => {}}
          dialogueKey={dialogueKey}
          characterId={characterId}
        />
      </PromptViewerErrorBoundary>
    </PromptViewerErrorBoundary>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出
   ═══════════════════════════════════════════════════════════════════════════ */

export { PromptViewerButton };
