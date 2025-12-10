/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                         ScriptListItem Component                         ║
 * ║                                                                          ║
 * ║  单个正则脚本卡片：展开/折叠、状态切换、编辑/删除操作                        ║
 * ║  从 RegexScriptEditor.tsx 提取，遵循 Linus 哲学：简洁、直接、无冗余          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { forwardRef } from "react";
import { ChevronRight, Edit3, Play, Pause, Trash2 } from "lucide-react";
import { RegexScript } from "@/lib/models/regex-script-model";
import { Button } from "@/components/ui/button";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface ScriptListItemProps {
  scriptId: string;
  script: RegexScript;
  isExpanded: boolean;
  animationComplete: boolean;
  index: number;
  fontClass: string;
  serifFontClass: string;
  t: (key: string) => string;
  onToggleExpand: (scriptId: string) => void;
  onEdit: (script: RegexScript & { scriptKey: string }) => void;
  onToggle: (scriptId: string) => void;
  onDelete: (scriptId: string) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   工具函数
   ═══════════════════════════════════════════════════════════════════════════ */

const truncateText = (text: string, maxLength = 50): string =>
  text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

/* ═══════════════════════════════════════════════════════════════════════════
   图标组件 - 使用 Lucide React 替代内联 SVG
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export const ScriptListItem = forwardRef<HTMLDivElement, ScriptListItemProps>(
  function ScriptListItem(
    { scriptId, script, isExpanded, animationComplete, index, fontClass, serifFontClass, t, onToggleExpand, onEdit, onToggle, onDelete },
    ref,
  ) {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

    return (
      <div
        ref={ref}
        className={`rounded-md border transition-all duration-300 ${
          script.disabled
            ? " border-border opacity-60"
            : " border-stroke-strong/30"
        } ${animationComplete ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
        style={{ transitionDelay: `${index * 50}ms` }}
      >
        {/* ─────────────────────────────────────────────────────────────────────
            头部：标题 + 操作按钮
            ───────────────────────────────────────────────────────────────────── */}
        <div className="p-2 sm:p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onToggleExpand(scriptId)}
                className="text-ink-soft hover:text-cream h-6 w-6 flex-shrink-0"
              >
                <ChevronRight className={`h-3 w-3 sm:h-4 sm:w-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
              </Button>
              <h4 className={`font-medium  ${script.disabled ? "text-ink-soft" : "text-primary-soft"} text-sm sm:text-base truncate flex-1 min-w-0`}>
                {script.scriptName}
              </h4>
            </div>
            <ActionButtons
              scriptId={scriptId}
              script={script}
              fontClass={fontClass}
              serifFontClass={serifFontClass}
              t={t}
              onEdit={onEdit}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          </div>

          {/* ─────────────────────────────────────────────────────────────────────
              状态标签
              ───────────────────────────────────────────────────────────────────── */}
          <StatusBadges script={script} t={t} />

          {/* ─────────────────────────────────────────────────────────────────────
              折叠状态：显示正则预览
              ───────────────────────────────────────────────────────────────────── */}
          {!isExpanded && (
            <div className={`text-xs sm:text-sm ${fontClass}`}>
              <span className="text-ink-soft">{t("regexScriptEditor.findRegex")}:</span>
              <code
                className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-muted  rounded font-mono text-2xs sm:text-xs cursor-pointer hover:bg-muted-surface transition-colors break-all"
                onClick={() => onToggleExpand(scriptId)}
              >
                {truncateText(script.findRegex, isMobile ? 30 : 50)}
              </code>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            展开状态：显示完整内容
            ───────────────────────────────────────────────────────────────────── */}
        {isExpanded && (
          <ExpandedContent script={script} fontClass={fontClass} t={t} />
        )}
      </div>
    );
  },
);

/* ═══════════════════════════════════════════════════════════════════════════
   子组件：操作按钮
   ═══════════════════════════════════════════════════════════════════════════ */

interface ActionButtonsProps {
  scriptId: string;
  script: RegexScript;
  fontClass: string;
  serifFontClass: string;
  t: (key: string) => string;
  onEdit: (script: RegexScript & { scriptKey: string }) => void;
  onToggle: (scriptId: string) => void;
  onDelete: (scriptId: string) => void;
}

function ActionButtons({ scriptId, script, fontClass, serifFontClass, t, onEdit, onToggle, onDelete }: ActionButtonsProps) {
  return (
    <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
      <span className={`text-2xs sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-muted-surface text-ink-soft ${fontClass}`}>
        {t("regexScriptEditor.priority")}: {script.placement?.[0] || 999}
      </span>

      {/* 编辑按钮 */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onEdit({ ...script, scriptKey: scriptId })}
        className="text-2xs sm:text-xs px-1.5 sm:px-3 py-1 sm:py-1.5 h-auto bg-gradient-to-r from-overlay to-coal hover:from-muted-surface hover:to-overlay text-success hover:text-success font-medium hover:shadow-success/20 group flex-shrink-0 border border-border"
      >
        <span className={"flex items-center "}>
          <Edit3 className="w-2 h-2 sm:w-2.5 sm:h-2.5 mr-0.5 sm:mr-1 transition-transform duration-300 group-hover:scale-110" />
          {t("regexScriptEditor.edit")}
        </span>
      </Button>

      {/* 启用/禁用按钮 */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onToggle(scriptId)}
        className={`text-2xs sm:text-xs px-1.5 sm:px-3 py-1 sm:py-1.5 h-auto font-medium group flex-shrink-0 ${
          script.disabled
            ? "bg-gradient-to-r from-overlay to-coal hover:from-muted-surface hover:to-overlay text-success hover:text-success border border-border hover:shadow-success/20"
            : "bg-gradient-to-r from-ember to-coal hover:from-muted-surface hover:to-ember text-primary-soft hover:text-primary-soft border border-border hover:shadow-primary-bright/20"
        }`}
      >
        <span className={"flex items-center "}>
          {script.disabled ? (
            <Play className="w-2 h-2 sm:w-2.5 sm:h-2.5 mr-0.5 sm:mr-1 transition-transform duration-300 group-hover:scale-110" />
          ) : (
            <Pause className="w-2 h-2 sm:w-2.5 sm:h-2.5 mr-0.5 sm:mr-1 transition-transform duration-300 group-hover:scale-110" />
          )}
          {script.disabled ? t("regexScriptEditor.enable") : t("regexScriptEditor.disable")}
        </span>
      </Button>

      {/* 删除按钮 */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onDelete(scriptId)}
        className="text-2xs sm:text-xs px-1.5 sm:px-3 py-1 sm:py-1.5 h-auto bg-gradient-to-r from-ember to-coal hover:from-layer hover:to-deep text-rose-300 hover:text-rose-200 font-medium hover:shadow-rose-400/20 group flex-shrink-0 border border-border"
      >
        <span className={"flex items-center "}>
          <Trash2 className="w-2 h-2 sm:w-2.5 sm:h-2.5 mr-0.5 sm:mr-1 transition-transform duration-300 group-hover:scale-110" />
          {t("regexScriptEditor.delete")}
        </span>
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   子组件：状态标签
   ═══════════════════════════════════════════════════════════════════════════ */

interface StatusBadgesProps {
  script: RegexScript;
  t: (key: string) => string;
}

function StatusBadges({ script, t }: StatusBadgesProps) {
  return (
    <div className="flex items-center space-x-1.5 sm:space-x-2 mb-1.5 sm:mb-2 flex-wrap">
      <span className={`inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-2xs sm:text-xs font-medium transition-all duration-300 backdrop-blur-sm border ${
        !script.disabled
          ? "bg-gradient-to-br from-slate-800/60 via-primary-900/40 to-slate-800/60 text-primary-200/90 border-primary-600/30"
          : "bg-gradient-to-br from-slate-800/60 via-stone-700/40 to-slate-800/60 text-stone-300/90 border-stone-500/30"
      }`}>
        <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mr-1 sm:mr-2 ${
          !script.disabled ? "bg-primary-400/80" : "bg-stone-400/80"
        }`} />
        {script.disabled ? t("regexScriptEditor.disabled") : t("regexScriptEditor.enabled")}
      </span>

      {script.extensions?.imported && (
        <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-2xs sm:text-xs font-medium transition-all duration-300 backdrop-blur-sm border bg-gradient-to-br from-slate-800/60 via-blue-700/40 to-slate-800/60 text-blue-300/90 border-blue-500/30 hover:from-slate-700/70 hover:via-blue-600/50 hover:to-slate-700/70 hover:border-blue-400/40 hover:text-blue-200 hover: hover:shadow-blue-500/10">
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400/80 rounded-full mr-1 sm:mr-2  shadow-blue-400/50" />
          {t("worldBook.imported")}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   子组件：展开内容
   ═══════════════════════════════════════════════════════════════════════════ */

interface ExpandedContentProps {
  script: RegexScript;
  fontClass: string;
  t: (key: string) => string;
}

function ExpandedContent({ script, fontClass, t }: ExpandedContentProps) {
  return (
    <div className="p-2 sm:p-4 space-y-2 sm:space-y-3 /50">
      <div className={`text-xs sm:text-sm ${fontClass}`}>
        <span className="text-ink-soft block mb-1">{t("regexScriptEditor.findRegex")}:</span>
        <code className="block px-2 sm:px-3 py-1.5 sm:py-2  rounded text-primary-bright font-mono text-2xs sm:text-xs border border-border/30 break-all">
          {script.findRegex}
        </code>
      </div>

      <div className={`text-xs sm:text-sm ${fontClass}`}>
        <span className="text-ink-soft block mb-1">{t("regexScriptEditor.replaceString")}:</span>
        <code className="block px-2 sm:px-3 py-1.5 sm:py-2  rounded text-sky font-mono text-2xs sm:text-xs border border-border/30 break-all whitespace-pre-wrap">
          {script.replaceString}
        </code>
      </div>

      {script.trimStrings && script.trimStrings.length > 0 && (
        <div className={`text-xs sm:text-sm ${fontClass}`}>
          <span className="text-ink-soft block mb-1">{t("regexScriptEditor.trimStrings")}:</span>
          <div className="flex flex-wrap gap-1">
            {script.trimStrings.map((trimStr, idx) => (
              <code key={idx} className="px-1.5 sm:px-2 py-0.5 sm:py-1  rounded text-info font-mono text-2xs sm:text-xs border border-border/30 break-all">
                {trimStr}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
