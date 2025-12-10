/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    Import Character Modal Component                        ║
 * ║                                                                            ║
 * ║  角色导入界面：PNG 文件上传 + 拖拽支持                                        ║
 * ║  已迁移至 Radix UI Dialog - 统一的 Modal 实现                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useRef } from "react";
import { UploadCloud } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { trackButtonClick } from "@/utils/google-analytics";
import { handleCharacterUpload } from "@/function/character/import";
import { toast } from "@/lib/store/toast-store";
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

interface ImportCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: () => void;
}

// ============================================================================
//                              主组件
// ============================================================================

export default function ImportCharacterModal({ isOpen, onClose, onImport }: ImportCharacterModalProps) {
  const { t, fontClass, serifFontClass } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ========== 拖拽处理 ==========

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // ========== 文件处理 ==========

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const pngFiles = files.filter(file => file.type === "image/png");
      
      if (pngFiles.length > 0) {
        setSelectedFiles(pngFiles);
        setError("");
        
        // Show warning if some files were not PNG
        if (pngFiles.length < files.length) {
          const warningMessage = t("importCharacterModal.someFilesSkipped");
          toast.warning(warningMessage);
        }
      } else {
        const errorMessage = t("importCharacterModal.pngOnly");
        setError(errorMessage);
        toast.error(errorMessage);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const pngFiles = files.filter(file => file.type === "image/png");
      
      if (pngFiles.length > 0) {
        setSelectedFiles(pngFiles);
        setError("");
        
        // Show warning if some files were not PNG
        if (pngFiles.length < files.length) {
          const warningMessage = t("importCharacterModal.someFilesSkipped");
          toast.warning(warningMessage);
        }
      } else {
        const errorMessage = t("importCharacterModal.pngOnly");
        setError(errorMessage);
        toast.error(errorMessage);
      }
    }
  };

  // ========== 上传处理 ==========

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      const errorMessage = t("importCharacterModal.noFileSelected");
      setError(errorMessage);
      toast.error(errorMessage);
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      // Upload files sequentially to avoid overwhelming the server
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        try {
          const response = await handleCharacterUpload(file);
          
          if (response.success) {
            successCount++;
          } else {
            failCount++;
            errors.push(`${file.name}: ${t("importCharacterModal.uploadFailed")}`);
          }
        } catch (err) {
          failCount++;
          const errorMsg = typeof err === "string" ? err : t("importCharacterModal.uploadFailed");
          errors.push(`${file.name}: ${errorMsg}`);
        }
      }

      // Show results
      if (successCount > 0 && failCount === 0) {
        toast.success(
          selectedFiles.length === 1 
            ? t("importCharacterModal.uploadSuccess")
            : `${successCount} characters imported successfully`,
        );
        onImport();
        onClose();
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`${successCount} characters imported, ${failCount} failed`);
        if (errors.length > 0) {
          setError(errors.slice(0, 3).join("; ") + (errors.length > 3 ? "..." : ""));
        }
        onImport(); // Refresh the character list
      } else {
        // All failed
        const errorMessage = errors.length > 0 ? errors[0] : t("importCharacterModal.uploadFailed");
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (err) {
      console.error("Error uploading characters:", err);
      const errorMessage = typeof err === "string" ? err : t("importCharacterModal.uploadFailed");
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  // ========== 表单重置 ==========

  const resetForm = () => {
    setSelectedFiles([]);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
      onClose();
    }
  };

  // ========== 渲染 ==========

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden  border-border gap-0">
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className={"text-xl text-cream-soft magical-text "}>
              {t("importCharacterModal.title")}
            </DialogTitle>
          </DialogHeader>
          
          <p className={`text-primary-soft mb-6 text-sm ${fontClass}`}>
            {t("importCharacterModal.description")}
          </p>
              
          <div
            className={`border-2 border-dashed rounded-md p-8 mb-4 text-center transition-colors duration-300 ${isDragging ? "border-primary-bright bg-muted-surface" : "border-border hover:border-border"}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/png"
              multiple
              onChange={handleFileSelect}
            />
                
            <div className="flex flex-col items-center justify-center">
              <UploadCloud className={`w-12 h-12 mb-3 ${selectedFiles.length > 0 ? "text-primary-bright" : "text-ink-soft"}`} strokeWidth={1.5} />
                  
              {selectedFiles.length > 0 ? (
                <div className={`text-cream-soft ${fontClass} max-w-full`}>
                  {selectedFiles.length === 1 ? (
                    <div>
                      <p className="font-medium truncate">{selectedFiles[0].name}</p>
                      <p className="text-xs text-ink-soft mt-1">{(selectedFiles[0].size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">{selectedFiles.length} files selected</p>
                      <p className="text-xs text-ink-soft mt-1">
                            Total: {(selectedFiles.reduce((sum, file) => sum + file.size, 0) / 1024).toFixed(1)} KB
                      </p>
                      <div className="mt-2 max-h-16 overflow-y-auto text-xs space-y-1">
                        {selectedFiles.slice(0, 3).map((file, index) => (
                          <p key={index} className="text-primary-soft truncate">{file.name}</p>
                        ))}
                        {selectedFiles.length > 3 && (
                          <p className="text-ink-soft">... and {selectedFiles.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`text-ink-soft ${fontClass}`}>
                  <p>{t("importCharacterModal.dragOrClick")}</p>
                  <p className="text-xs mt-1">{t("importCharacterModal.pngFormat")}</p>
                  <p className="text-xs mt-1 text-ink-soft">Multiple files supported</p>
                </div>
              )}
            </div>
          </div>
              
          {error && (
            <div className="text-danger text-sm mb-4 text-center">
              {error}
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {trackButtonClick("ImportCharacterModal", "导入角色");handleUpload();}}
              disabled={selectedFiles.length === 0 || isUploading}
            >
              {isUploading
                ? (selectedFiles.length > 1
                  ? `${t("importCharacterModal.uploading")} (${selectedFiles.length})`
                  : t("importCharacterModal.uploading"))
                : (selectedFiles.length > 1
                  ? `${t("importCharacterModal.import")} (${selectedFiles.length})`
                  : t("importCharacterModal.import"))
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
