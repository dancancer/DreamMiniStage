/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      Import Result Display                                ║
 * ║                                                                          ║
 * ║  通用导入结果显示组件                                                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ImportResult {
  success: boolean;
  message: string;
  importedCount: number;
  skippedCount: number;
  errors?: string[];
  successfulFiles?: string[];
  failedFiles?: string[];
}

interface ImportResultDisplayProps {
  result: ImportResult;
  title: string;
  importedLabel: string;
  skippedLabel: string;
  errorsLabel: string;
  serifFontClass: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   文件列表
   ═══════════════════════════════════════════════════════════════════════════ */

interface FileListProps {
  files: string[];
  label: string;
  color: "green" | "red";
}

function FileList({ files, label, color }: FileListProps) {
  const colorClasses = color === "green"
    ? { text: "text-green-400", dot: "bg-green-400", dotSm: "bg-green-400/60", scrollbar: "scrollbar-thumb-green-400/30" }
    : { text: "text-red-400", dot: "bg-red-400", dotSm: "bg-red-400/60", scrollbar: "scrollbar-thumb-red-400/30" };

  return (
    <div>
      <p className={`${colorClasses.text} font-medium flex items-center mt-2`}>
        <span className={`w-1.5 h-1.5 ${colorClasses.dot} rounded-full mr-2`} />
        {label} ({files.length}):
      </p>
      <ul className={`list-none ${colorClasses.text}/80 ml-3 space-y-0.5 max-h-20 overflow-y-auto scrollbar-thin scrollbar-track-transparent ${colorClasses.scrollbar}`}>
        {files.map((fileName, index) => (
          <li key={index} className="flex items-start">
            <span className={`w-1 h-1 ${colorClasses.dotSm} rounded-full mr-2 mt-1.5 flex-shrink-0`} />
            <span className="text-xs truncate">{fileName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   错误列表
   ═══════════════════════════════════════════════════════════════════════════ */

interface ErrorListProps {
  errors: string[];
  label: string;
}

function ErrorList({ errors, label }: ErrorListProps) {
  return (
    <div>
      <p className="text-red-400 font-medium flex items-center mt-2">
        <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2" />
        {label}:
      </p>
      <ul className="list-none text-red-400/80 ml-3 space-y-0.5 max-h-24 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-red-400/30">
        {errors.map((error, index) => (
          <li key={index} className="flex items-start">
            <span className="w-1 h-1 bg-red-400/60 rounded-full mr-2 mt-1.5 flex-shrink-0" />
            <span className="text-xs break-words">{error}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export function ImportResultDisplay({
  result,
  title,
  importedLabel,
  skippedLabel,
  errorsLabel,
  serifFontClass,
}: ImportResultDisplayProps) {
  return (
    <div className="mt-3 p-2.5 bg-gradient-to-br from-muted-surface/60 via-deep/40 to-muted-surface/60 backdrop-blur-sm border border-border/40 rounded-md animate-in slide-in-from-bottom-2 duration-300">
      <h3 className={"text-xs font-medium text-cream-soft mb-1.5 "}>{title}</h3>
      <div className="space-y-1 text-xs">
        {/* 已导入数量 */}
        <p className="text-green-400 flex items-center">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2 animate-pulse" />
          {importedLabel.replace("{count}", result.importedCount.toString())}
        </p>

        {/* 已跳过数量 */}
        {result.skippedCount > 0 && (
          <p className="text-yellow-400 flex items-center">
            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full mr-2" />
            {skippedLabel.replace("{count}", result.skippedCount.toString())}
          </p>
        )}

        {/* 成功文件列表 */}
        {result.successfulFiles && result.successfulFiles.length > 0 && (
          <FileList files={result.successfulFiles} label="Successful files" color="green" />
        )}

        {/* 失败文件列表 */}
        {result.failedFiles && result.failedFiles.length > 0 && (
          <FileList files={result.failedFiles} label="Failed files" color="red" />
        )}

        {/* 错误列表 */}
        {result.errors && result.errors.length > 0 && (
          <ErrorList errors={result.errors} label={errorsLabel} />
        )}
      </div>
    </div>
  );
}
