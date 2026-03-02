/**
 * @input  @/app, @/lib, @/components
 * @output RegexDebuggerPanel
 * @pos    正则调试器面板
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                     RegexDebuggerPanel Component                         ║
 * ║                                                                          ║
 * ║  正则脚本调试面板 - 测试和调试正则脚本                                      ║
 * ║  设计理念：简洁、直观、实时反馈                                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useCallback } from "react";
import { Play, AlertCircle, CheckCircle, ChevronRight } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { RegexScript } from "@/lib/models/regex-script-model";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface DebugStep {
  scriptName: string;
  scriptKey: string;
  findRegex: string;
  replaceString: string;
  matched: boolean;
  matches: string[];
  beforeText: string;
  afterText: string;
}

interface DebugResult {
  inputText: string;
  outputText: string;
  steps: DebugStep[];
  totalMatches: number;
  appliedScripts: number;
}

interface RegexDebuggerPanelProps {
  isOpen: boolean;
  scripts: Record<string, RegexScript>;
  onClose: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export default function RegexDebuggerPanel({
  isOpen,
  scripts,
  onClose,
}: RegexDebuggerPanelProps) {
  const { t, fontClass } = useLanguage();

  // 状态
  const [testText, setTestText] = useState("");
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const [isDebugging, setIsDebugging] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  /* ─────────────────────────────────────────────────────────────────────────
     调试执行
     
     TODO: 当任务 14 完成后，这里需要调用 RegexDebugger.debug()
     ───────────────────────────────────────────────────────────────────────── */
  
  const handleDebug = useCallback(async () => {
    if (!testText.trim()) return;
    
    setIsDebugging(true);
    
    try {
      // TODO: 替换为实际的调试器调用
      // const result = await RegexDebugger.debug(testText, scripts);
      
      // 临时模拟结果
      const mockResult: DebugResult = {
        inputText: testText,
        outputText: testText,
        steps: [],
        totalMatches: 0,
        appliedScripts: 0,
      };
      
      setDebugResult(mockResult);
    } catch (error) {
      console.error("Debug error:", error);
    } finally {
      setIsDebugging(false);
    }
  }, [testText]);

  const toggleStep = useCallback((index: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setDebugResult(null);
    setExpandedSteps(new Set());
  }, []);

  /* ─────────────────────────────────────────────────────────────────────────
     渲染
     ───────────────────────────────────────────────────────────────────────── */

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden border-border gap-0">
        {/* ═══════════════════════════════════════════════════════════════════
            头部
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="p-5 border-b border-border/60 relative z-10">
          <DialogHeader>
            <DialogTitle className="text-lg text-cream-soft font-medium">
              {t("regexDebugger.title") || "Regex Script Debugger"}
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            内容区域
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 测试文本输入 */}
          <div>
            <label className={`block text-xs text-ink-soft mb-1.5 font-medium ${fontClass}`}>
              {t("regexDebugger.testText") || "Test Text"}
            </label>
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder={t("regexDebugger.testTextPlaceholder") || "Enter text to test your regex scripts..."}
              className="w-full h-32 px-3 py-2 bg-muted-surface border border-border/60 rounded-md text-cream 
                focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-300
                placeholder-ink-soft/70 hover:border-border text-sm font-mono resize-none"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleDebug}
              disabled={!testText.trim() || isDebugging}
              className="shrink-0"
            >
              {isDebugging ? (
                <>
                  <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full mr-2" />
                  {t("regexDebugger.debugging") || "Debugging..."}
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-2" />
                  {t("regexDebugger.runDebug") || "Run Debug"}
                </>
              )}
            </Button>
            
            {debugResult && (
              <Button
                variant="outline"
                onClick={handleReset}
                className="shrink-0"
              >
                {t("regexDebugger.reset") || "Reset"}
              </Button>
            )}
            
            {debugResult && (
              <div className={`text-xs text-ink-soft ${fontClass}`}>
                {t("regexDebugger.appliedScripts") || "Applied"}: {debugResult.appliedScripts} / {Object.keys(scripts).length}
                {" • "}
                {t("regexDebugger.totalMatches") || "Matches"}: {debugResult.totalMatches}
              </div>
            )}
          </div>

          {/* 调试结果 */}
          {debugResult && (
            <div className="space-y-4">
              {/* 输出结果 */}
              <div>
                <label className={`block text-xs text-ink-soft mb-1.5 font-medium ${fontClass}`}>
                  {t("regexDebugger.output") || "Output"}
                </label>
                <div className="px-3 py-2 bg-muted-surface border border-border/60 rounded-md text-cream text-sm font-mono whitespace-pre-wrap break-all">
                  {debugResult.outputText}
                </div>
              </div>

              {/* 步骤列表 */}
              {debugResult.steps.length > 0 && (
                <div>
                  <label className={`block text-xs text-ink-soft mb-1.5 font-medium ${fontClass}`}>
                    {t("regexDebugger.steps") || "Execution Steps"}
                  </label>
                  <div className="space-y-2">
                    {debugResult.steps.map((step, index) => (
                      <DebugStepCard
                        key={index}
                        step={step}
                        index={index}
                        isExpanded={expandedSteps.has(index)}
                        onToggle={toggleStep}
                        fontClass={fontClass}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 无匹配提示 */}
              {debugResult.steps.length === 0 && (
                <div className="flex items-center justify-center py-8 text-ink-soft">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  <span className={fontClass}>
                    {t("regexDebugger.noMatches") || "No scripts matched the test text"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   子组件：调试步骤卡片
   ═══════════════════════════════════════════════════════════════════════════ */

interface DebugStepCardProps {
  step: DebugStep;
  index: number;
  isExpanded: boolean;
  onToggle: (index: number) => void;
  fontClass: string;
  t: (key: string) => string;
}

function DebugStepCard({
  step,
  index,
  isExpanded,
  onToggle,
  fontClass,
  t,
}: DebugStepCardProps) {
  return (
    <div className={`rounded-md border transition-all duration-300 ${
      step.matched 
        ? "border-primary-500/30 bg-primary-500/5" 
        : "border-border/50 bg-muted-surface/30"
    }`}>
      {/* 头部 */}
      <div 
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted-surface/50 transition-colors"
        onClick={() => onToggle(index)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
          >
            <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
          </Button>
          
          {step.matched ? (
            <CheckCircle className="h-4 w-4 text-primary-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-ink-soft shrink-0" />
          )}
          
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium truncate ${step.matched ? "text-primary-soft" : "text-ink-soft"}`}>
              {step.scriptName}
            </div>
            {step.matched && (
              <div className={`text-xs text-ink-soft ${fontClass}`}>
                {step.matches.length} {t("regexDebugger.matches") || "matches"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/30">
          <div className={`text-xs ${fontClass}`}>
            <span className="text-ink-soft">{t("regexDebugger.findRegex") || "Find"}:</span>
            <code className="block mt-1 px-2 py-1 bg-muted rounded text-primary-bright font-mono text-2xs break-all">
              {step.findRegex}
            </code>
          </div>
          
          <div className={`text-xs ${fontClass}`}>
            <span className="text-ink-soft">{t("regexDebugger.replaceString") || "Replace"}:</span>
            <code className="block mt-1 px-2 py-1 bg-muted rounded text-sky font-mono text-2xs break-all">
              {step.replaceString || "(empty)"}
            </code>
          </div>
          
          {step.matched && (
            <>
              <div className={`text-xs ${fontClass}`}>
                <span className="text-ink-soft">{t("regexDebugger.before") || "Before"}:</span>
                <div className="mt-1 px-2 py-1 bg-muted rounded text-cream font-mono text-2xs break-all whitespace-pre-wrap">
                  {step.beforeText}
                </div>
              </div>
              
              <div className={`text-xs ${fontClass}`}>
                <span className="text-ink-soft">{t("regexDebugger.after") || "After"}:</span>
                <div className="mt-1 px-2 py-1 bg-muted rounded text-cream font-mono text-2xs break-all whitespace-pre-wrap">
                  {step.afterText}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
