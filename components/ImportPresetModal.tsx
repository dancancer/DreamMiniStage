/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    Import Preset Modal Component                           ║
 * ║                                                                            ║
 * ║  预设导入模态框 - 已迁移至 Radix UI Dialog                                   ║
 * ║  支持文件拖拽、自定义命名、导入预览                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useState, useRef } from "react";
import { Check, FileText, X } from "lucide-react";
import { toast } from "@/lib/store/toast-store";
import { useLanguage } from "@/app/i18n";
import { importPresetFromJson } from "@/function/preset/import";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ============================================================================
//                              类型定义
// ============================================================================

interface ImportPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: () => void;
}

// ============================================================================
//                              主组件
// ============================================================================

export default function ImportPresetModal({
  isOpen,
  onClose,
  onImport,
}: ImportPresetModalProps) {
  const { t, fontClass, serifFontClass } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [customName, setCustomName] = useState("");
  const [fileName, setFileName] = useState("");
  const [jsonData, setJsonData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ========== 文件处理 ==========

  const handleFileSelect = async (file: File) => {
    if (!file.type.includes("json")) {
      toast.error(t("importPreset.selectJsonFile"));
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const parsedData = JSON.parse(text);
      setJsonData(parsedData);
      
      const defaultName = file.name.replace(/\.json$/, "");
      setFileName(defaultName);
      setCustomName(defaultName);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`${t("importPreset.failedToImport")}: ${errorMessage}`);
      setImportResult({
        success: false,
        error: errorMessage,
      });
    } finally {
      setIsImporting(false);
    }
  };

  // ========== 拖拽处理 ==========

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // ========== 导入处理 ==========

  const handleImport = async () => {
    if (!jsonData) return;
    
    setIsImporting(true);
    try {
      const result = await importPresetFromJson(JSON.stringify(jsonData), customName.trim() || fileName);
      setImportResult(result);

      if (result.success) {
        toast.success(t("importPreset.importSuccess"));
        onImport();
      } else {
        toast.error(t("importPreset.importFailed"));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`${t("importPreset.failedToImport")}: ${errorMessage}`);
      setImportResult({
        success: false,
        error: errorMessage,
      });
    } finally {
      setIsImporting(false);
    }
  };

  // ========== 表单重置 ==========

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setImportResult(null);
      setIsDragging(false);
      setJsonData(null);
      setCustomName("");
      setFileName("");
      onClose();
    }
  };

  // ========== 渲染 ==========

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden  border-border gap-0">
        <div className="p-3 border-b border-border/40 bg-gradient-to-r from-muted-surface/80 via-deep/60 to-muted-surface/80 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className={"text-base font-semibold text-cream-soft "}>
              {t("importPreset.title")}
            </DialogTitle>
          </DialogHeader>
        </div>
        
        <div className="p-4 max-h-[70vh] overflow-y-auto fantasy-scrollbar">
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                isDragging
                  ? "border-primary-500/60 bg-primary-500/10 scale-[1.02]"
                  : "border-border/60 hover:border-primary-500/40 hover:bg-primary-500/5"
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-primary-500/5 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
              
              <div className="relative z-10 space-y-3">
                <div className="flex justify-center">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-primary-500/20 to-primary-600/30 flex items-center justify-center transition-transform duration-300 ${
                    isDragging ? "scale-110 animate-pulse" : ""
                  }`}>
                    <FileText className="h-6 w-6 text-primary-400" />
                  </div>
                </div>
                
                <div>
                  <h3 className={"text-lg font-medium text-cream-soft "}>
                    {isDragging ? t("importPreset.dropFileHere") : t("importPreset.dragDropFile")}
                  </h3>
                  <p className={`text-sm text-ink-soft mt-1 ${fontClass}`}>
                    {t("importPreset.dragAndDrop")}
                  </p>
                </div>
                
                <div>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="px-4 py-2 bg-gradient-to-r from-primary-600/80 to-primary-500/80 hover:from-primary-500/90 hover:to-primary-400/90 text-white font-medium"
                  >
                    {isImporting ? t("importPreset.importing") : t("importPreset.browseFiles")}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
            
            {jsonData && !importResult && (
              <div className="p-4 bg-muted-surface/50 backdrop-blur-sm border border-border/40 rounded-md animate-fadeIn">
                <h4 className={"text-sm font-medium text-cream-soft mb-3 "}>{t("importPreset.customizePreset")}</h4>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="presetName" className={`block text-xs text-ink-soft mb-1 ${fontClass}`}>
                      {t("importPreset.presetName")}
                    </label>
                    <input
                      id="presetName"
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder={fileName}
                      className="w-full px-3 py-2 /80 border border-border/60 rounded-md text-cream-soft placeholder-ink/80 focus:outline-none focus:ring-1 focus:ring-primary-500/40 transition-all duration-300"
                    />
                    <p className={`mt-1 text-xs text-ink-soft/70 ${fontClass}`}>{t("importPreset.presetNameDesc")}</p>
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => handleOpenChange(false)}
                      className="px-3 py-1.5 bg-muted-surface/80 hover:bg-muted-surface border border-border/60 text-ink-soft hover:text-cream-soft"
                    >
                      {t("importPreset.cancel")}
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={isImporting}
                      className="px-4 py-1.5 bg-gradient-to-r from-primary-600/80 to-primary-500/80 hover:from-primary-500/90 hover:to-primary-400/90 text-white font-medium"
                    >
                      {isImporting ? t("importPreset.importing") : t("importPreset.confirmImport")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {importResult && (
              <div className={`p-4 rounded-md border ${
                importResult.success
                  ? "bg-emerald-900/20 border-emerald-500/30 text-emerald-200"
                  : "bg-red-900/20 border-red-500/30 text-red-200"
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    importResult.success ? "bg-emerald-500/20" : "bg-red-500/20"
                  }`}>
                    {importResult.success ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <X className="h-3 w-3 text-red-400" />
                    )}
                  </div>
                  <h4 className={"font-medium "}>
                    {importResult.success ? t("importPreset.importSuccess") : t("importPreset.importFailed")}
                  </h4>
                </div>
                <p className={`text-sm ${fontClass}`}>
                  {importResult.success ? t("importPreset.presetImported") : importResult.error || t("importPreset.importError")}
                </p>
              </div>
            )}
            
            <div className="bg-muted-surface/40 backdrop-blur-sm border border-border/30 rounded-md p-4">
              <h4 className={"text-sm font-medium text-cream-soft mb-2 "}>{t("importPreset.guidelines")}</h4>
              <ul className={`text-xs text-ink-soft space-y-1 ${fontClass}`}>
                <li>• {t("importPreset.jsonFormat")}</li>
                <li>• {t("importPreset.validStructure")}</li>
                <li>• {t("importPreset.noOverwrite")}</li>
                <li>• {t("importPreset.maxFileSize")}</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="p-3 border-t border-border/40 bg-gradient-to-r from-muted-surface/60 via-deep/40 to-muted-surface/60 backdrop-blur-sm">
          <div className="flex justify-end space-x-2">
            <Button
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              className="px-3 py-1.5 text-sm font-medium text-ink-soft hover:text-cream-soft hover:bg-stroke/50"
            >
              {t("importPreset.cancel")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
