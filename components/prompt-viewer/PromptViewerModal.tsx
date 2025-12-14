/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词查看器主弹窗组件                                 ║
 * ║                                                                           ║
 * ║  核心功能：弹窗管理、组件集成、状态协调                                    ║
 * ║  设计原则：消除特殊情况、统一处理逻辑、保持简洁实用                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import SearchToolbar from "./SearchToolbar";
import PromptContent from "./PromptContent";
import { COMPONENT_STYLES, getModalResponsiveStyles } from "./styles";
import PromptViewerErrorBoundary, { createErrorHandler } from "./PromptViewerErrorBoundary";
import { registerComponentCleanup, unregisterComponentCleanup } from "@/lib/prompt-viewer/resource-manager";
import {
  usePromptData,
  useViewerUIState,
  useModalActions,
  useSearchActions,
  useUIActions,
  useInterceptionActions,
  useCleanupActions,
} from "@/lib/store/prompt-viewer-store";
import { searchProcessor } from "@/lib/prompt-viewer/search-processor";
import type { PromptViewerModalProps } from "@/types/prompt-viewer";

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export function PromptViewerModal({
  isOpen,
  onClose,
  dialogueKey,
  characterId,
}: PromptViewerModalProps) {
  // ========== 状态管理 ==========
  const promptData = usePromptData(dialogueKey);
  const uiState = useViewerUIState(dialogueKey);
  const { closeModal } = useModalActions();
  const { setSearchInput, toggleMatchedOnly } = useSearchActions();
  const { toggleRegionExpansion, toggleImageGallery, setError } = useUIActions();
  const { refreshPrompt, stopInterception } = useInterceptionActions();
  const { cleanup } = useCleanupActions();

  // ========== 错误处理 ==========
  const errorHandler = createErrorHandler(`PromptViewerModal-${dialogueKey}`);

  // ========== 搜索处理 ==========
  const searchResult = useMemo(() => {
    if (!promptData?.fullPrompt || !uiState.searchInput.trim()) {
      return null;
    }

    try {
      const searchState = searchProcessor.createSearchState(
        uiState.searchInput,
        uiState.matchedOnly,
      );

      if (!searchState.isValid) {
        return null;
      }

      return searchProcessor.processSearch(promptData.fullPrompt, searchState);
    } catch (error) {
      console.error("[PromptViewerModal] 搜索处理失败:", error);
      return null;
    }
  }, [promptData?.fullPrompt, uiState.searchInput, uiState.matchedOnly]);

  // ========== 事件处理 ==========

  const handleClose = useCallback(() => {
    // 停止拦截
    stopInterception(dialogueKey);
    
    // 关闭弹窗
    closeModal(dialogueKey);
    onClose();
  }, [dialogueKey, stopInterception, closeModal, onClose]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(dialogueKey, value);
    },
    [dialogueKey, setSearchInput],
  );

  const handleMatchedOnlyChange = useCallback(
    (value: boolean) => {
      toggleMatchedOnly(dialogueKey);
    },
    [dialogueKey, toggleMatchedOnly],
  );

  const handleRefresh = useCallback(async () => {
    if (!characterId) return;
    
    try {
      await refreshPrompt(dialogueKey, characterId);
    } catch (error) {
      console.error("[PromptViewerModal] 刷新失败:", error);
    }
  }, [dialogueKey, characterId, refreshPrompt]);

  const handleToggleRegion = useCallback(
    (regionId: string) => {
      toggleRegionExpansion(dialogueKey, regionId);
    },
    [dialogueKey, toggleRegionExpansion],
  );

  const handleToggleImageGallery = useCallback(() => {
    toggleImageGallery(dialogueKey);
  }, [dialogueKey, toggleImageGallery]);

  // ========== 生命周期管理 ==========

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // 弹窗打开时的初始化逻辑
    console.log(`[PromptViewerModal] 弹窗打开: ${dialogueKey}`);

    // 清理函数：组件卸载或弹窗关闭时执行
    return () => {
      console.log(`[PromptViewerModal] 清理资源: ${dialogueKey}`);
      
      // 停止拦截（如果还在进行）
      stopInterception(dialogueKey).catch((error) => {
        console.error(`[PromptViewerModal] 停止拦截失败: ${dialogueKey}`, error);
      });
    };
  }, [isOpen, dialogueKey, stopInterception]);

  // 组件卸载时的全面清理
  useEffect(() => {
    // 注册到资源管理器
    registerComponentCleanup("PromptViewerModal", dialogueKey, async () => {
      console.log(`[PromptViewerModal] 资源管理器清理: ${dialogueKey}`);
      await stopInterception(dialogueKey);
      cleanup(dialogueKey);
    });

    return () => {
      // 组件完全卸载时清理所有相关资源
      console.log(`[PromptViewerModal] 组件卸载，清理所有资源: ${dialogueKey}`);
      
      // 从资源管理器取消注册
      unregisterComponentCleanup("PromptViewerModal", dialogueKey);
      
      // 异步清理，避免阻塞卸载过程
      setTimeout(() => {
        cleanup(dialogueKey);
      }, 0);
    };
  }, [dialogueKey, cleanup, stopInterception]);

  // ========== 渲染 ==========

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className={cn(
          COMPONENT_STYLES.modal.content,
          getModalResponsiveStyles(),
        )}
        hideCloseButton={false}
      >
        {/* 弹窗标题 */}
        <DialogHeader className={COMPONENT_STYLES.modal.header}>
          <DialogTitle className="text-lg font-semibold text-foreground">
            提示词查看器
            {promptData && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {new Date(promptData.timestamp).toLocaleString()}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* 主要内容区域 */}
        <div className={COMPONENT_STYLES.modal.body}>
          {/* 搜索工具栏 - 使用错误边界保护 */}
          <PromptViewerErrorBoundary
            onError={(error) => {
              errorHandler(error);
              setError(dialogueKey, `搜索工具栏错误: ${error.message}`);
            }}
            maxRetries={2}
          >
            <SearchToolbar
              searchInput={uiState.searchInput}
              onSearchChange={handleSearchChange}
              matchedOnly={uiState.matchedOnly}
              onMatchedOnlyChange={handleMatchedOnlyChange}
              onRefresh={handleRefresh}
              isLoading={uiState.isLoading}
            />
          </PromptViewerErrorBoundary>

          {/* 内容显示区域 - 使用错误边界保护 */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <PromptViewerErrorBoundary
              onError={(error) => {
                errorHandler(error);
                setError(dialogueKey, `内容显示错误: ${error.message}`);
              }}
              maxRetries={3}
            >
              <ContentArea
                promptData={promptData}
                searchResult={searchResult}
                uiState={uiState}
                onToggleRegion={handleToggleRegion}
                onToggleImageGallery={handleToggleImageGallery}
              />
            </PromptViewerErrorBoundary>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   内容区域组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface ContentAreaProps {
  promptData: ReturnType<typeof usePromptData>;
  searchResult: ReturnType<typeof searchProcessor.processSearch> | null;
  uiState: ReturnType<typeof useViewerUIState>;
  onToggleRegion: (regionId: string) => void;
  onToggleImageGallery: () => void;
}

function ContentArea({
  promptData,
  searchResult,
  uiState,
  onToggleRegion,
  onToggleImageGallery,
}: ContentAreaProps) {
  // ========== 状态判断 ==========

  if (uiState.isLoading) {
    return <LoadingState />;
  }

  if (uiState.error) {
    return <ErrorState error={uiState.error} />;
  }

  if (!promptData) {
    return <EmptyState />;
  }

  // ========== 正常内容渲染 ==========

  return (
    <div className="h-full overflow-y-auto">
      <PromptContent
        messages={promptData.messages}
        content={promptData.fullPrompt}
        searchResult={searchResult}
        expandedRegions={uiState.expandedRegions}
        onToggleRegion={onToggleRegion}
        images={promptData.images}
        imageGalleryExpanded={uiState.imageGalleryExpanded}
        onToggleImageGallery={onToggleImageGallery}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   状态组件
   ═══════════════════════════════════════════════════════════════════════════ */

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">正在获取提示词...</span>
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-6">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <span className="text-destructive text-xl">⚠</span>
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        获取提示词失败
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">
        {error}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-6">
      <div className="w-12 h-12 rounded-full bg-muted/10 flex items-center justify-center mb-4">
        <span className="text-muted-foreground text-xl">📝</span>
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        暂无提示词内容
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">
        请发送一条消息或点击刷新按钮来获取提示词内容
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出
   ═══════════════════════════════════════════════════════════════════════════ */

export default PromptViewerModal;
