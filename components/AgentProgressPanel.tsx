/**
 * Compact AgentProgressPanel Component with Fantasy Styling
 * 
 * An elegant, compact progress panel for displaying AI agent execution status.
 * Features:
 * - Ultra-compact design with collapsible sections
 * - Refined fantasy-themed styling with a unified, elegant color palette
 * - i18n support with proper font handling
 * - Smooth, subtle animations and interactions
 * - Prioritizes essential information for a clean look
 * 
 * Dependencies:
 * - lucide-react: For iconography
 * - i18n: For internationalization
 */

"use client";

import React, { useState } from "react";
import { 
  Clock, 
  Brain, 
  Zap, 
  User, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  FileText,
  Download,
  Sparkles,
  Activity,
  Database,
  ChevronDown,
  ChevronUp,
  Award,
} from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { Button } from "@/components/ui/button";

interface AgentProgressPanelProps {
  progress: {
  completedTasks: number;
  totalIterations: number;
  knowledgeBaseSize: number;
  };
  status: string;
  result?: {
    character_data?: any;
    status_data?: any;
    world_data?: any;
  };
  sessionId?: string | null;
  onExport?: (type: string, data: any) => void;
}

/**
 * An elegant and compact AgentProgressPanel component with refined fantasy styling.
 */
const AgentProgressPanel: React.FC<AgentProgressPanelProps> = ({
  progress,
  status,
  result,
  sessionId,
  onExport,
}) => {
  const { t, fontClass, serifFontClass } = useLanguage();
  const [isExporting, setIsExporting] = useState(false);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [isResultsExpanded, setIsResultsExpanded] = useState(false);

  const getStatusConfig = (status: string) => {
    const statusMap: { [key: string]: { color: string; label: string; icon: React.ReactNode; pulse?: boolean } } = {
      idle: { color: "text-slate-400", label: t("agentProgress.idle") || "Idle", icon: <Clock size={14} /> },
      thinking: { color: "text-primary-400", label: t("agentProgress.thinking") || "Thinking", icon: <Brain size={14} />, pulse: true },
      executing: { color: "text-primary-400", label: t("agentProgress.executing") || "Executing", icon: <Zap size={14} />, pulse: true },
      waiting_user: { color: "text-primary-400", label: t("agentProgress.waitingUser") || "Awaiting Input", icon: <User size={14} />, pulse: true },
      completed: { color: "text-cream", label: t("agentProgress.completed") || "Completed", icon: <Award size={14} /> },
      failed: { color: "text-rose-400", label: t("agentProgress.failed") || "Failed", icon: <AlertCircle size={14} /> },
    };
    return statusMap[status] || { color: "text-slate-400", label: t("agentProgress.unknown") || "Unknown", icon: <Clock size={14} /> };
  };

  const statusConfig = getStatusConfig(status);

  const handleExport = async (type: string, data: any) => {
    if (!data || isExporting) return;
    
    setIsExporting(true);
    try {
      if (onExport) {
        await onExport(type, data);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-black/40 border border-primary-500/20 rounded-md p-3 space-y-3">
      {/* Compact Header */}
      <div className="text-center">
        <h3 className={"text-sm font-semibold text-cream  magical-text"}>
          {t("agentProgress.title") || "创作进度"}
        </h3>
        <p className={`text-2xs-plus text-primary-soft/60 mt-0.5 ${fontClass}`}>
          {t("agentProgress.subtitle") || "AI创作监控"}
        </p>
      </div>

      {/* Simplified Status Indicator */}
      <div className="bg-black/20 rounded-md px-3 py-2">
        <div className="flex items-center gap-2">
          <div className={`${statusConfig.color} ${statusConfig.pulse ? "animate-pulse" : ""}`}>
            {statusConfig.icon}
          </div>
          <div className="flex-1">
            <div className={`font-medium text-xs ${statusConfig.color} ${fontClass}`}>
              {statusConfig.label}
            </div>
          </div>
          {(status === "thinking" || status === "executing") && (
            <Loader2 className="w-3.5 h-3.5 text-primary-soft/50 animate-spin" />
          )}
        </div>
      </div>

      {/* Collapsible Statistics */}
      <div className="space-y-1.5">
        <Button
          variant="ghost"
          onClick={() => setIsStatsExpanded(!isStatsExpanded)}
          className="h-auto w-full justify-between p-1.5 hover:bg-black/30"
        >
          <span className={`text-xs font-medium text-primary-soft ${fontClass}`}>
            {t("agentProgress.statistics") || "统计信息"}
          </span>
          {isStatsExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-primary-soft/70" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-primary-soft/70" />
          )}
        </Button>
        
        <div
          className="overflow-hidden transition-[max-height,opacity] duration-200"
          style={{ maxHeight: isStatsExpanded ? "320px" : "0px", opacity: isStatsExpanded ? 1 : 0 }}
          aria-hidden={!isStatsExpanded}
        >
          <div className="space-y-1.5 px-1.5 pb-1">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 text-primary-soft/80">
                <CheckCircle className="w-3 h-3" />
                <span className={fontClass}>{t("agentProgress.completed") || "已完成"}</span>
              </div>
              <span className={`font-semibold text-cream ${fontClass}`}>{progress.completedTasks}</span>
            </div>
    
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 text-primary-soft/80">
                <Activity className="w-3 h-3" />
                <span className={fontClass}>{t("agentProgress.iterations") || "迭代次数"}</span>
              </div>
              <span className={`font-semibold text-cream ${fontClass}`}>{progress.totalIterations}</span>
            </div>
    
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 text-primary-soft/80">
                <Database className="w-3 h-3" />
                <span className={fontClass}>{t("agentProgress.knowledgeBase") || "知识库"}</span>
              </div>
              <span className={`font-semibold text-cream ${fontClass}`}>{progress.knowledgeBaseSize}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Generation Results */}
      {result && (
        <div className="space-y-1.5">
          <Button
            variant="ghost"
            onClick={() => setIsResultsExpanded(!isResultsExpanded)}
            className="h-auto w-full justify-between p-1.5 hover:bg-black/30"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary-400 fantasy-glow" />
              <span className={`text-xs font-medium text-primary-soft ${fontClass}`}>
                {t("agentProgress.results") || "生成结果"}
              </span>
            </div>
            {isResultsExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-primary-soft/70" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-primary-soft/70" />
            )}
          </Button>
          
          <div
            className="overflow-hidden transition-[max-height,opacity] duration-200"
            style={{ maxHeight: isResultsExpanded ? "360px" : "0px", opacity: isResultsExpanded ? 1 : 0 }}
            aria-hidden={!isResultsExpanded}
          >
            <div className="space-y-1.5 px-1.5 pb-1">
              {/* Character Card */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-primary-soft">
                  <User className="w-3 h-3 text-primary-400" />
                  <span className={fontClass}>{t("agentProgress.characterCard") || "角色卡"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full fantasy-glow ${
                    result.character_data ? "bg-cream" : "bg-slate-600"
                  }`} />
                  {result.character_data && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleExport("character", result.character_data)}
                      disabled={isExporting}
                      className="h-auto w-auto p-0.5 hover:bg-black/30"
                    >
                      <Download className="w-3 h-3 text-primary-soft/80 hover:text-cream" />
                    </Button>
                  )}
                </div>
              </div>
        
              {/* Status System */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-primary-soft">
                  <FileText className="w-3 h-3 text-primary-400" />
                  <span className={fontClass}>{t("agentProgress.statusSystem") || "状态系统"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full fantasy-glow ${
                    result.status_data ? "bg-cream" : "bg-slate-600"
                  }`} />
                  {result.status_data && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleExport("status", result.status_data)}
                      disabled={isExporting}
                      className="h-auto w-auto p-0.5 hover:bg-black/30"
                    >
                      <Download className="w-3 h-3 text-primary-soft/80 hover:text-cream" />
                    </Button>
                  )}
                </div>
              </div>
        
              {/* World Data */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-primary-soft">
                  <Database className="w-3 h-3 text-primary-400" />
                  <span className={fontClass}>{t("agentProgress.worldData") || "世界数据"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full fantasy-glow ${
                    result.world_data ? "bg-cream" : "bg-slate-600"
                  }`} />
                  {result.world_data && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleExport("world", result.world_data)}
                      disabled={isExporting}
                      className="h-auto w-auto p-0.5 hover:bg-black/30"
                    >
                      <Download className="w-3 h-3 text-primary-soft/80 hover:text-cream" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentProgressPanel; 
