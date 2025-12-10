/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                   Import Regex Script Modal                               ║
 * ║                                                                          ║
 * ║  正则脚本导入弹窗 - 已迁移至 Radix UI Dialog                                 ║
 * ║  使用 import-modal 共享组件，支持批量导入                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "@/lib/store/toast-store";
import { useLanguage } from "@/app/i18n";
import { importRegexScriptFromJson } from "@/function/regex/import";
import { listGlobalRegexScripts, importFromGlobalRegexScript, GlobalRegexScript, deleteGlobalRegexScript } from "@/function/regex/global";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DragDropZone,
  ImportModalHeader,
  GlobalItemSelector,
  GlobalItem,
  ImportResultDisplay,
  ImportResult,
  SaveAsGlobalCheckbox,
  ImportModalFooter,
} from "@/components/import-modal";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface ImportRegexScriptModalProps {
  isOpen: boolean;
  characterId: string;
  onClose: () => void;
  onImportSuccess: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   工具函数
   ═══════════════════════════════════════════════════════════════════════════ */

function mapToGlobalItem(script: GlobalRegexScript): GlobalItem {
  return {
    id: script.id,
    name: script.name,
    description: script.description,
    count: script.scriptCount,
    createdAt: new Date(script.createdAt).toISOString(),
    sourceCharacterName: script.sourceCharacterName,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   批量导入处理
   ═══════════════════════════════════════════════════════════════════════════ */

interface BatchImportContext {
  characterId: string;
  saveAsGlobal: boolean;
}

async function processBatchImport(files: File[], ctx: BatchImportContext): Promise<ImportResult> {
  const jsonFiles = files.filter(f => f.type.includes("json"));
  if (jsonFiles.length === 0) throw new Error("Please select at least one JSON file");

  let totalImported = 0, totalSkipped = 0;
  const allErrors: string[] = [], successfulFiles: string[] = [], failedFiles: string[] = [];

  for (const file of jsonFiles) {
    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      const options = ctx.saveAsGlobal ? { saveAsGlobal: true, globalName: file.name.replace(".json", ""), globalDescription: "", sourceCharacterName: undefined } : undefined;
      const result = await importRegexScriptFromJson(ctx.characterId, jsonData, options);

      if (result.success) {
        totalImported += result.importedCount;
        totalSkipped += result.skippedCount;
        successfulFiles.push(file.name);
        if (result.errors?.length) allErrors.push(...result.errors.map(e => `${file.name}: ${e}`));
      } else {
        failedFiles.push(file.name);
        allErrors.push(`${file.name}: ${result.message}`);
        if (result.errors?.length) allErrors.push(...result.errors.map(e => `${file.name}: ${e}`));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      failedFiles.push(file.name);
      allErrors.push(`${file.name}: Failed to parse - ${msg}`);
    }
  }

  return {
    success: successfulFiles.length > 0,
    message: `Processed ${jsonFiles.length} files: ${successfulFiles.length} successful, ${failedFiles.length} failed`,
    importedCount: totalImported,
    skippedCount: totalSkipped,
    errors: allErrors,
    successfulFiles,
    failedFiles,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ImportRegexScriptModal({ isOpen, characterId, onClose, onImportSuccess }: ImportRegexScriptModalProps) {
  const { t, serifFontClass } = useLanguage();

  // UI 状态
  const [activeTab, setActiveTab] = useState<"file" | "global">("file");
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [saveAsGlobal, setSaveAsGlobal] = useState(false);

  // 全局正则脚本
  const [globalScripts, setGlobalScripts] = useState<GlobalRegexScript[]>([]);
  const [selectedGlobalId, setSelectedGlobalId] = useState("");
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ─────────────────────────────────────────────────────────────────────────
     加载全局脚本
     ───────────────────────────────────────────────────────────────────────── */

  const loadGlobalScripts = useCallback(async () => {
    setIsLoadingGlobal(true);
    try {
      const result = await listGlobalRegexScripts();
      if (result.success) setGlobalScripts(result.globalRegexScripts);
      else toast.error("Failed to load global regex scripts");
    } catch (error) {
      console.error("Failed to load global regex scripts:", error);
      toast.error("Failed to load global regex scripts");
    } finally {
      setIsLoadingGlobal(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "global" && isOpen) loadGlobalScripts();
  }, [activeTab, isOpen, loadGlobalScripts]);

  /* ─────────────────────────────────────────────────────────────────────────
     批量文件导入
     ───────────────────────────────────────────────────────────────────────── */

  const handleFilesSelect = useCallback(async (files: File[]) => {
    const jsonFiles = files.filter(f => f.type.includes("json"));
    if (jsonFiles.length === 0) { toast.error("Please select at least one JSON file"); return; }
    if (jsonFiles.length !== files.length) toast.error(`${files.length - jsonFiles.length} non-JSON files were skipped`);

    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await processBatchImport(files, { characterId, saveAsGlobal });
      setImportResult(result);

      if (result.success) {
        const msg = result.failedFiles?.length ? `Successfully imported from ${result.successfulFiles?.length} files (${result.failedFiles?.length} failed)` : `Successfully imported from all ${result.successfulFiles?.length} files`;
        toast.success(msg);
        onImportSuccess();
      } else {
        toast.error(`Failed to import from all ${jsonFiles.length} files`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Batch import failed: ${msg}`);
      setImportResult({ success: false, message: `Batch import failed: ${msg}`, errors: [msg], importedCount: 0, skippedCount: 0 });
    } finally {
      setIsImporting(false);
    }
  }, [characterId, saveAsGlobal, onImportSuccess]);

  /* ─────────────────────────────────────────────────────────────────────────
     全局导入
     ───────────────────────────────────────────────────────────────────────── */

  const handleImportFromGlobal = useCallback(async () => {
    if (!selectedGlobalId) { toast.error("Please select a global regex script"); return; }

    setIsImporting(true);
    try {
      const result = await importFromGlobalRegexScript(characterId, selectedGlobalId);
      if (result.success) {
        setImportResult({ success: true, message: result.message, importedCount: result.importedCount, skippedCount: 0, errors: [] });
        toast.success(result.message);
        onImportSuccess();
      } else toast.error(result.message);
    } catch (error: any) {
      console.error("Import from global failed:", error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  }, [characterId, selectedGlobalId, onImportSuccess]);

  /* ─────────────────────────────────────────────────────────────────────────
     删除全局
     ───────────────────────────────────────────────────────────────────────── */

  const handleDeleteGlobal = useCallback(async (globalId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setDeletingId(globalId);
    try {
      const result = await deleteGlobalRegexScript(globalId);
      if (result.success) {
        toast.success(t("regexScriptEditor.globalScriptDeleted"));
        loadGlobalScripts();
        if (selectedGlobalId === globalId) setSelectedGlobalId("");
      } else toast.error(result.message || t("regexScriptEditor.failedToDeleteGlobalScript"));
    } catch (error: any) {
      console.error("Failed to delete global regex script:", error);
      toast.error(`${t("regexScriptEditor.failedToDeleteGlobalScript")}: ${error.message}`);
    } finally {
      setDeletingId(null);
    }
  }, [t, loadGlobalScripts, selectedGlobalId]);

  /* ─────────────────────────────────────────────────────────────────────────
     关闭弹窗
     ───────────────────────────────────────────────────────────────────────── */

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setImportResult(null);
      setSaveAsGlobal(false);
      setActiveTab("file");
      setSelectedGlobalId("");
      onClose();
    }
  }, [onClose]);

  /* ─────────────────────────────────────────────────────────────────────────
     拖拽处理
     ───────────────────────────────────────────────────────────────────────── */

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFilesSelect(files);
  }, [handleFilesSelect]);

  /* ─────────────────────────────────────────────────────────────────────────
     渲染
     ───────────────────────────────────────────────────────────────────────── */

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden  border-border gap-0">
        <DialogTitle className="sr-only">{t("regexScriptEditor.importRegexScript")}</DialogTitle>
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-blue-500/5 opacity-50 animate-pulse pointer-events-none" />

        <ImportModalHeader
          title={t("regexScriptEditor.importRegexScript")}
          activeTab={activeTab}
          tabs={[
            { id: "file", label: t("regexScriptEditor.importFromJson"), icon: "file", activeColor: "primary" },
            { id: "global", label: t("regexScriptEditor.importFromGlobal"), icon: "global", activeColor: "blue" },
          ]}
          serifFontClass={serifFontClass}
          onTabChange={setActiveTab}
          onClose={() => handleOpenChange(false)}
        />

        <div className="relative p-3 max-h-[55vh] overflow-y-auto scrollbar-thin scrollbar-track-deep scrollbar-thumb-ink z-10">
          {activeTab === "file" ? (
            <div className="space-y-3">
              <DragDropZone
                isDragging={isDragging}
                multiple={true}
                description={t("regexScriptEditor.dragDropJson")}
                hint={t("regexScriptEditor.jsonFileOnly")}
                multipleHint="Supports multiple files selection"
                serifFontClass={serifFontClass}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onFilesSelect={handleFilesSelect}
              />
              <SaveAsGlobalCheckbox checked={saveAsGlobal} label={t("regexScriptEditor.saveAsGlobalRegexScript")} serifFontClass={serifFontClass} onChange={setSaveAsGlobal}>
                <p className="text-xs text-ink-soft">{t("regexScriptEditor.willUseEachFileName")}</p>
              </SaveAsGlobalCheckbox>
            </div>
          ) : (
            <GlobalItemSelector
              items={globalScripts.map(mapToGlobalItem)}
              selectedId={selectedGlobalId}
              isLoading={isLoadingGlobal}
              deletingId={deletingId}
              emptyTitle={t("regexScriptEditor.noGlobalRegexScripts")}
              emptyHint={t("regexScriptEditor.createGlobalRegexScriptFirst")}
              selectLabel={t("regexScriptEditor.selectGlobalRegexScript")}
              loadingText={t("regexScriptEditor.loading")}
              deleteTitle={t("regexScriptEditor.deleteGlobalScript")}
              serifFontClass={serifFontClass}
              onSelect={setSelectedGlobalId}
              onDelete={handleDeleteGlobal}
            />
          )}

          {importResult && (
            <ImportResultDisplay
              result={importResult}
              title={t("regexScriptEditor.importResults")}
              importedLabel={t("regexScriptEditor.importedScripts")}
              skippedLabel={t("regexScriptEditor.skippedScripts")}
              errorsLabel={t("regexScriptEditor.importErrors")}
              serifFontClass={serifFontClass}
            />
          )}
        </div>

        <ImportModalFooter
          activeTab={activeTab}
          isImporting={isImporting}
          canImport={!!selectedGlobalId}
          cancelLabel={t("common.cancel")}
          importingLabel={t("regexScriptEditor.importing")}
          importLabel={t("regexScriptEditor.importFromGlobal")}
          serifFontClass={serifFontClass}
          onClose={() => handleOpenChange(false)}
          onImport={handleImportFromGlobal}
        />
      </DialogContent>
    </Dialog>
  );
}
