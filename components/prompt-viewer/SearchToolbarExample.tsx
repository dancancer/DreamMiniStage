/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    搜索工具栏使用示例                                      ║
 * ║                                                                           ║
 * ║  展示如何在提示词查看器中集成搜索工具栏                                     ║
 * ║  演示与状态管理的正确集成方式                                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback } from "react";
import { SearchToolbar } from "./SearchToolbar";
import { useViewerUIState, useSearchActions, useInterceptionActions } from "@/lib/store/prompt-viewer-store";

/* ═══════════════════════════════════════════════════════════════════════════
   示例组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface SearchToolbarExampleProps {
  dialogueKey: string;
  characterId: string;
}

export function SearchToolbarExample({ dialogueKey, characterId }: SearchToolbarExampleProps) {
  // ========== 状态获取 ==========
  
  const uiState = useViewerUIState(dialogueKey);
  const { setSearchInput, toggleMatchedOnly } = useSearchActions();
  const { refreshPrompt } = useInterceptionActions();

  // ========== 事件处理 ==========

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(dialogueKey, value);
    },
    [dialogueKey, setSearchInput],
  );

  const handleMatchedOnlyChange = useCallback(
    (checked: boolean) => {
      toggleMatchedOnly(dialogueKey);
    },
    [dialogueKey, toggleMatchedOnly],
  );

  const handleRefresh = useCallback(
    async () => {
      await refreshPrompt(dialogueKey, characterId);
    },
    [dialogueKey, characterId, refreshPrompt],
  );

  // ========== 渲染 ==========

  return (
    <div className="w-full max-w-4xl mx-auto">
      <SearchToolbar
        searchInput={uiState.searchInput}
        onSearchChange={handleSearchChange}
        matchedOnly={uiState.matchedOnly}
        onMatchedOnlyChange={handleMatchedOnlyChange}
        onRefresh={handleRefresh}
        isLoading={uiState.isLoading}
      />
      
      {/* 状态显示（仅用于演示） */}
      <div className="mt-4 p-4 bg-muted rounded-md text-sm">
        <h3 className="font-medium mb-2">当前状态：</h3>
        <ul className="space-y-1 text-muted-foreground">
          <li>搜索输入: &quot;{uiState.searchInput}&quot;</li>
          <li>仅显示匹配: {uiState.matchedOnly ? "是" : "否"}</li>
          <li>加载中: {uiState.isLoading ? "是" : "否"}</li>
          <li>错误: {uiState.error || "无"}</li>
        </ul>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出
   ═══════════════════════════════════════════════════════════════════════════ */

export default SearchToolbarExample;
