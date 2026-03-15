/**
 * @input  @/components
 * @output ScriptDebugPanel
 * @pos    脚本调试面板
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
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
import type { ScriptHostApiCallRecord, ScriptHostRuntimeState } from "@/hooks/script-bridge/host-debug-state";
import { SCRIPT_HOST_CAPABILITY_MATRIX } from "@/hooks/script-bridge/host-capability-matrix";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ============================================================================
//                              类型定义
// ============================================================================

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scripts: ScriptStatus[];
  hostDebug: {
    recentApiCalls: ScriptHostApiCallRecord[];
    runtimeState: ScriptHostRuntimeState;
  };
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

const SUPPORT_UI = {
  default: "bg-green-500/20 text-green-400",
  conditional: "bg-amber-500/20 text-amber-300",
  "fail-fast": "bg-red-500/20 text-red-300",
  unsupported: "bg-ink/20 text-ink-soft",
} as const;

const PRODUCT_ENTRY_UI = {
  true: "bg-blue-500/20 text-blue-300",
  false: "bg-ink/20 text-ink-soft",
} as const;

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-soft">
      {children}
    </div>
  );
}

function HostCapabilitySection() {
  const capabilityCards = [...SCRIPT_HOST_CAPABILITY_MATRIX].sort((left, right) =>
    left.area.localeCompare(right.area) || left.id.localeCompare(right.id),
  );

  return (
    <section className="space-y-2">
      <SectionTitle>Host Capability</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        {capabilityCards.map((capability) => (
          <div
            key={capability.id}
            className="rounded border border-border bg-overlay p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-cream">{capability.id}</div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${SUPPORT_UI[capability.support]}`}>
                {capability.support}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide">
              <span className="rounded-full bg-ink/20 px-2 py-0.5 text-ink-soft">
                {capability.area}
              </span>
              <span className="rounded-full bg-ink/20 px-2 py-0.5 text-ink-soft">
                {capability.hostSource}
              </span>
              <span className={`rounded-full px-2 py-0.5 ${PRODUCT_ENTRY_UI[String(capability.hasProductEntry) as "true" | "false"]}`}>
                Product Entry: {capability.hasProductEntry ? "yes" : "no"}
              </span>
            </div>
            {capability.failFastReason && (
              <div className="mt-2 text-xs text-ink-soft">
                {capability.failFastReason}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentApiCallsSection({ recentApiCalls }: { recentApiCalls: ScriptHostApiCallRecord[] }) {
  return (
    <section className="space-y-2">
      <SectionTitle>Recent API Calls</SectionTitle>
      {recentApiCalls.length === 0 ? (
        <div className="rounded border border-dashed border-border p-3 text-xs text-ink-soft">
          No host-observed api calls yet.
        </div>
      ) : (
        <div className="space-y-2">
          {recentApiCalls.map((entry) => (
            <div key={`${entry.method}-${entry.timestamp}`} className="rounded border border-border bg-overlay p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-cream">{entry.method}</span>
                <span className="text-[10px] uppercase tracking-wide text-ink-soft">{entry.outcome}</span>
              </div>
              <div className="mt-1 text-xs text-ink-soft">
                {entry.capability} {"->"} {entry.resolvedPath}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RuntimeStateSection({ runtimeState }: { runtimeState: ScriptHostRuntimeState }) {
  const items = [
    ["toolRegistrations", String(runtimeState.toolRegistrations)],
    ["eventListeners", String(runtimeState.eventListeners)],
    ["hasHostOverrides", runtimeState.hasHostOverrides ? "true" : "false"],
  ] as const;

  return (
    <section className="space-y-2">
      <SectionTitle>Runtime State</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded border border-border bg-overlay p-3">
            <div className="text-[10px] uppercase tracking-wide text-ink-soft">{label}</div>
            <div className="mt-1 text-sm font-medium text-cream">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScriptStatusSection({ scripts }: { scripts: ScriptStatus[] }) {
  return (
    <section className="space-y-2">
      <SectionTitle>Script Status</SectionTitle>
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
    </section>
  );
}

// ============================================================================
//                              主组件
// ============================================================================

export default function ScriptDebugPanel({ isOpen, onClose, scripts, hostDebug }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 flex flex-col">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle className="text-lg font-medium text-cream">
            Script Execution Debugger
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-soft">
            Inspect host capability support, recent bridge activity, and script execution state.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <HostCapabilitySection />
          <RecentApiCallsSection recentApiCalls={hostDebug.recentApiCalls} />
          <RuntimeStateSection runtimeState={hostDebug.runtimeState} />
          <ScriptStatusSection scripts={scripts} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
