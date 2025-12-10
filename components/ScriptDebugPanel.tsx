/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       ScriptDebugPanel                                    ║
 * ║                                                                            ║
 * ║  脚本执行调试面板 - 已迁移至 Radix UI Dialog                               ║
 * ║  显示脚本执行状态、错误信息和时间戳                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import type { ScriptStatus } from "@/hooks/useScriptBridge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ============================================================================
//                              类型定义
// ============================================================================

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scripts: ScriptStatus[];
}

// ============================================================================
//                              状态配置
// ============================================================================

const STATUS_UI: Record<ScriptStatus["status"], { card: string; badge: string; label: string }> = {
  running: {
    card: "border-border bg-overlay",
    badge: "bg-ink/20 text-ink-soft",
    label: "RUNNING",
  },
  completed: {
    card: "border-green-500/30 bg-green-500/5",
    badge: "bg-green-500/20 text-green-400",
    label: "COMPLETED",
  },
  error: {
    card: "border-red-500/30 bg-red-500/5",
    badge: "bg-red-500/20 text-red-400",
    label: "ERROR",
  },
};

// ============================================================================
//                              子组件
// ============================================================================

function ScriptStatusCard({ script }: { script: ScriptStatus }) {
  const { card, badge, label } = STATUS_UI[script.status];
  
  return (
    <div className={`p-3 rounded border ${card}`}>
      {/* ========== 脚本名称和状态 ========== */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-cream">{script.scriptName || "Script"}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${badge}`}>
          {label}
        </span>
      </div>
      
      {/* ========== 时间戳 ========== */}
      <div className="text-xs text-ink-soft mb-1">
        {new Date(script.timestamp).toLocaleTimeString()}
      </div>
      
      {/* ========== 错误信息 ========== */}
      {script.message && (
        <div className="mt-2 p-2 bg-black/30 rounded text-xs text-red-300 font-mono whitespace-pre-wrap">
          {script.message}
        </div>
      )}
    </div>
  );
}

// ============================================================================
//                              主组件
// ============================================================================

export default function ScriptDebugPanel({ isOpen, onClose, scripts }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 flex flex-col">
        {/* ═══════════════════════════════════════════════════════════
            头部区域 - Header Section
            ═══════════════════════════════════════════════════════════ */}
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle className="text-lg font-medium text-cream">
            Script Execution Debugger
          </DialogTitle>
        </DialogHeader>
        
        {/* ═══════════════════════════════════════════════════════════
            内容区域 - Content Section
            ═══════════════════════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {scripts.length === 0 ? (
            <div className="text-center text-ink-soft py-8">
              No scripts detected or executed yet.
            </div>
          ) : (
            scripts.map((script) => (
              <ScriptStatusCard
                key={`${script.scriptName || "script"}-${script.timestamp}`}
                script={script}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
