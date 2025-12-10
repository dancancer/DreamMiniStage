/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                         Drag Drop Zone                                    ║
 * ║                                                                          ║
 * ║  通用文件拖拽上传组件                                                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useRef } from "react";
import { FileText } from "lucide-react";

interface DragDropZoneProps {
  isDragging: boolean;
  multiple?: boolean;
  accept?: string;
  description: string;
  hint: string;
  multipleHint?: string;
  serifFontClass: string;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFilesSelect: (files: File[]) => void;
}

export function DragDropZone({
  isDragging,
  multiple = false,
  accept = ".json",
  description,
  hint,
  multipleHint,
  serifFontClass,
  onDragOver,
  onDragLeave,
  onDrop,
  onFilesSelect,
}: DragDropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelect(Array.from(files));
    }
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-md p-4 text-center transition-all duration-300 cursor-pointer group ${
        isDragging
          ? "border-primary-500/60 bg-primary-500/10  shadow-primary-500/20"
          : "border-border/60 hover:border-border/80 hover:bg-muted-surface/30"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-blue-500/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative flex flex-col items-center space-y-2">
        <div className="relative">
          <FileText className="h-8 w-8 text-ink-soft group-hover:text-primary-400 transition-colors duration-300" strokeWidth={1.5} />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />
        </div>
        <div>
          <p className={"text-cream-soft font-medium text-sm "}>{description}</p>
          <p className="text-ink-soft text-xs mt-0.5">{hint}</p>
          {multiple && multipleHint && (
            <p className="text-ink-soft text-xs mt-0.5 font-medium">✨ {multipleHint}</p>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileInputChange}
        className="hidden"
      />
    </div>
  );
}
