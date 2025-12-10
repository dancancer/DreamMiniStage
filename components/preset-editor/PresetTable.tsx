/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       PresetTable                                          ║
 * ║  预设列表 + 展开行显示提示词                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useCallback, memo } from "react";
import { PresetData, PresetPromptData } from "./index";
import { ChevronRight, FileText, Edit, Copy, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface PresetTableProps {
  presets: PresetData[];
  expandedRows: Set<string>;
  selectedPreset: PresetData | null;
  fontClass: string;
  t: (key: string) => string;
  onTogglePreset: (presetId: string, enable: boolean) => void;
  onToggleRow: (presetId: string) => void;
  onSelectPreset: (presetId: string) => void;
  onEditPresetName: (preset: PresetData) => void;
  onCopyPreset: (preset: PresetData) => void;
  onDeletePreset: (presetId: string) => void;
  onEditPrompt: (prompt: PresetPromptData) => void;
  onTogglePrompt: (presetId: string, promptId: string, enable: boolean) => void;
  onDeletePrompt: (presetId: string, promptId: string) => void;
}

export const PresetTable = memo(function PresetTable({
  presets,
  expandedRows,
  selectedPreset,
  fontClass,
  t,
  onTogglePreset,
  onToggleRow,
  onSelectPreset,
  onEditPresetName,
  onCopyPreset,
  onDeletePreset,
  onEditPrompt,
  onTogglePrompt,
  onDeletePrompt,
}: PresetTableProps) {
  return (
    <div className="h-full overflow-y-auto fantasy-scrollbar pb-15">
      <table className="w-full table-fixed">
        <thead className="sticky top-0 bg-muted-surface border-b border-border z-10">
          <tr>
            <th className={`w-12 sm:w-16 p-1.5 sm:p-3 text-left text-2xs sm:text-xs font-medium text-ink-soft uppercase tracking-wider whitespace-nowrap ${fontClass}`}>
              {t("preset.toggle")}
            </th>
            <th className={`w-24 sm:w-24 p-1.5 sm:p-3 text-left text-2xs sm:text-xs font-medium text-ink-soft uppercase tracking-wider whitespace-nowrap ${fontClass}`}>
              {t("preset.status")}
            </th>
            <th className={`w-20 sm:w-24 p-1.5 sm:p-3 text-left text-2xs sm:text-xs font-medium text-ink-soft uppercase tracking-wider whitespace-nowrap ${fontClass}`}>
              {t("preset.name")}
            </th>
            <th className={`w-20 sm:w-24 p-1.5 sm:p-3 text-left text-2xs sm:text-xs font-medium text-ink-soft uppercase tracking-wider whitespace-nowrap ${fontClass}`}>
              {t("preset.prompts")}
            </th>
            <th className={`w-20 sm:w-20 p-1.5 sm:p-3 text-left text-2xs sm:text-xs font-medium text-ink-soft uppercase tracking-wider whitespace-nowrap ${fontClass}`}>
              {t("preset.updated")}
            </th>
            <th className={`w-16 sm:w-20 p-1.5 sm:p-3 text-left text-2xs sm:text-xs font-medium text-ink-soft uppercase tracking-wider whitespace-nowrap ${fontClass}`}>
              {t("preset.actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {presets.map((preset) => (
            <PresetRow
              key={preset.id}
              preset={preset}
              isExpanded={expandedRows.has(preset.id)}
              isSelected={selectedPreset?.id === preset.id}
              selectedPreset={selectedPreset}
              fontClass={fontClass}
              t={t}
              onTogglePreset={onTogglePreset}
              onToggleRow={onToggleRow}
              onSelectPreset={onSelectPreset}
              onEditPresetName={onEditPresetName}
              onCopyPreset={onCopyPreset}
              onDeletePreset={onDeletePreset}
              onEditPrompt={onEditPrompt}
              onTogglePrompt={onTogglePrompt}
              onDeletePrompt={onDeletePrompt}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
});

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  PresetRow - 单行预设（memo 优化，避免整表重渲染）                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */
const PresetRow = memo(function PresetRow({
  preset,
  isExpanded,
  isSelected,
  selectedPreset,
  fontClass,
  t,
  onTogglePreset,
  onToggleRow,
  onSelectPreset,
  onEditPresetName,
  onCopyPreset,
  onDeletePreset,
  onEditPrompt,
  onTogglePrompt,
  onDeletePrompt,
}: {
  preset: PresetData;
  isExpanded: boolean;
  isSelected: boolean;
  selectedPreset: PresetData | null;
  fontClass: string;
  t: (key: string) => string;
  onTogglePreset: (presetId: string, enable: boolean) => void;
  onToggleRow: (presetId: string) => void;
  onSelectPreset: (presetId: string) => void;
  onEditPresetName: (preset: PresetData) => void;
  onCopyPreset: (preset: PresetData) => void;
  onDeletePreset: (presetId: string) => void;
  onEditPrompt: (prompt: PresetPromptData) => void;
  onTogglePrompt: (presetId: string, promptId: string, enable: boolean) => void;
  onDeletePrompt: (presetId: string, promptId: string) => void;
}) {
  const handleToggle = useCallback(
    (checked: boolean) => onTogglePreset(preset.id, checked),
    [onTogglePreset, preset.id],
  );

  const handleRowClick = useCallback(() => {
    onToggleRow(preset.id);
    if (!isSelected) onSelectPreset(preset.id);
  }, [onToggleRow, onSelectPreset, preset.id, isSelected]);

  const handleEditName = useCallback(() => onEditPresetName(preset), [onEditPresetName, preset]);
  const handleCopy = useCallback(() => onCopyPreset(preset), [onCopyPreset, preset]);
  const handleDelete = useCallback(() => onDeletePreset(preset.id), [onDeletePreset, preset.id]);

  return (
    <React.Fragment>
      <tr className="border-b border-border hover:bg-muted-surface transition-all duration-300 group">
        <td className="p-1.5 sm:p-3">
          <Switch
            checked={preset.enabled !== false}
            onCheckedChange={handleToggle}
            className="scale-75 sm:scale-100"
            title={preset.enabled !== false ? t("preset.disablePreset") : t("preset.enablePreset")}
          />
        </td>

        <td className="p-1.5 sm:p-3">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <span
              className={`inline-flex items-center px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-2xs sm:text-xs font-medium whitespace-nowrap transition-all duration-300 backdrop-blur-sm border ${
                preset.enabled !== false
                  ? preset.totalPrompts > 0
                    ? " text-primary-200/90 border-primary-600/30"
                    :  "text-blue-200/90 border-blue-600/30"
                  : " text-stone-300/90 border-stone-500/30"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mr-1 sm:mr-2 ${
                  preset.enabled !== false
                    ? preset.totalPrompts > 0
                      ? "bg-primary-400/90 border border-primary-500/60"
                      : "bg-blue-400/90 border border-blue-500/60"
                    : "bg-stone-400/90 border border-stone-500/60"
                }`}
              />
              <span className="hidden sm:inline">
                {preset.enabled !== false ? (preset.totalPrompts > 0 ? t("preset.active_status") : t("preset.empty_status")) : t("preset.disabled")}
              </span>
              <span className="sm:hidden">{preset.enabled !== false ? (preset.totalPrompts > 0 ? "Active" : "Empty") : "Disabled"}</span>
            </span>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleRowClick}
              className="h-5 w-5 sm:h-6 sm:w-6 text-ink-soft hover:text-cream-soft hover:bg-stroke ml-1 sm:ml-2"
              title={isExpanded ? t("preset.collapseDetails") : t("preset.expandDetails")}
            >
              <ChevronRight size={10} className={`transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`} />
            </Button>
          </div>
        </td>

        <td className="p-1.5 sm:p-3 text-xs sm:text-sm text-cream-soft max-w-xs">
          <PresetName name={preset.name} />
        </td>

        <td className="p-1.5 sm:p-3 text-xs sm:text-sm text-primary-soft">
          <span className="text-primary-400">{preset.enabledPrompts}</span>
          <span className="text-ink-soft"> / {preset.totalPrompts}</span>
        </td>

        <td className="p-1.5 sm:p-3 text-xs sm:text-sm text-primary-soft">
          <span className="hidden sm:inline">{new Date(preset.lastUpdated).toLocaleDateString()}</span>
          <span className="sm:hidden">
            {new Date(preset.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </td>

        <td className="p-1.5 sm:p-3">
          <div className="flex items-center space-x-0.5 sm:space-x-1">
            <ActionButton title={t("preset.editPresetName")} onClick={handleEditName} iconType="edit" />
            <ActionButton title={t("preset.copyPreset")} onClick={handleCopy} className="text-sky hover:text-sky/80" iconType="copy" />
            <ActionButton title={t("preset.deletePreset")} onClick={handleDelete} className="text-red-400 hover:text-red-300" iconType="delete" />
          </div>
        </td>
      </tr>

      {isExpanded && isSelected && selectedPreset && (
        <tr className="border-b border-border bg-gradient-to-b from-deep to-coal transition-all duration-300">
          <td colSpan={6} className="p-2 sm:p-4">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs sm:text-sm font-medium text-ink-soft flex items-center">
                  <FileText size={12} className="mr-1.5 sm:mr-2" />
                  {t("preset.promptsTitle")} ({selectedPreset.prompts.length})
                  {selectedPreset.enabled === false && (
                    <span className="ml-1 sm:ml-2 inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-2xs sm:text-xs font-medium bg-red-900/40 text-red-200/90 border border-red-600/30">
                      {t("preset.disabled")}
                    </span>
                  )}
                </h4>
              </div>

              {selectedPreset.prompts.length === 0 ? (
                <div className="text-center text-ink-soft py-4 sm:py-8">
                  <p className="text-xs sm:text-sm">{t("preset.noPromptsInPreset")}</p>
                </div>
              ) : (
                <div className="space-y-1.5 sm:space-y-2">
                  {selectedPreset.prompts.map((prompt) => (
                    <PromptCard
                      key={prompt.identifier}
                      presetId={selectedPreset.id}
                      prompt={prompt}
                      fontClass={fontClass}
                      t={t}
                      onToggle={onTogglePrompt}
                      onEdit={onEditPrompt}
                      onDelete={onDeletePrompt}
                    />
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
});

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  PresetName - 安全渲染预设名称，防御空值                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */
function PresetName({ name }: { name?: string }) {
  const safeName = name ?? "";
  return (
    <span className="block truncate" title={safeName}>
      {safeName.length > 8 ? `${safeName.substring(0, 8)}...` : safeName}
    </span>
  );
}

function ActionButton({
  title,
  onClick,
  className,
  iconType,
}: {
  title: string;
  onClick: () => void;
  className?: string;
  iconType: "edit" | "copy" | "delete";
}) {
  const IconComponent = iconType === "edit" ? Edit : iconType === "copy" ? Copy : Trash2;
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={`h-5 w-5 sm:h-6 sm:w-6 text-ink-soft hover:text-cream-soft hover:bg-stroke group ${className ?? ""}`}
      title={title}
    >
      <IconComponent size={10} className="transition-transform duration-300 group-hover:scale-110" />
    </Button>
  );
}

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  PromptCard - 单个提示词卡片（memo 优化，避免列表重渲染）                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */
const PromptCard = memo(function PromptCard({
  presetId,
  prompt,
  fontClass,
  t,
  onToggle,
  onEdit,
  onDelete,
}: {
  presetId: string;
  prompt: PresetPromptData;
  fontClass: string;
  t: (key: string) => string;
  onToggle: (presetId: string, promptId: string, enable: boolean) => void;
  onEdit: (prompt: PresetPromptData) => void;
  onDelete: (presetId: string, promptId: string) => void;
}) {
  /* ─────────────────────────────────────────────────────────────────────────
   * 稳定回调：避免每次渲染创建新函数引用
   * ───────────────────────────────────────────────────────────────────────── */
  const handleToggle = useCallback(
    (checked: boolean) => onToggle(presetId, prompt.identifier, checked),
    [onToggle, presetId, prompt.identifier],
  );

  const handleEdit = useCallback(() => onEdit(prompt), [onEdit, prompt]);

  const handleDelete = useCallback(
    () => onDelete(presetId, prompt.identifier),
    [onDelete, presetId, prompt.identifier],
  );

  return (
    <div className="border border-border rounded p-2 sm:p-3 bg-muted-surface">
      <div className="flex justify-between items-start mb-1.5 sm:mb-2">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <Switch
            checked={prompt.enabled !== false}
            onCheckedChange={handleToggle}
            className="scale-75 sm:scale-100"
          />
          <span className="text-xs sm:text-sm text-primary-soft">{prompt.name}</span>
          {prompt.system_prompt && (
            <span className="text-[10px] sm:text-2xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-200 border border-blue-700/40">
              {t("preset.systemPrompt")}
            </span>
          )}
          {prompt.marker && (
            <span className="text-[10px] sm:text-2xs px-1.5 py-0.5 rounded bg-green-900/40 text-green-200 border border-green-700/40">
              {t("preset.marker")}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <ActionButton
            title={t("preset.editPrompt")}
            onClick={handleEdit}
            iconType="edit"
          />
          <ActionButton
            title={t("preset.deletePrompt")}
            onClick={handleDelete}
            className="text-red-400 hover:text-red-300"
            iconType="delete"
          />
        </div>
      </div>

      {prompt.content && (
        <p className={`text-2xs sm:text-xs text-cream-soft leading-relaxed ${fontClass} whitespace-pre-line`}>
          {prompt.content.slice(0, 400)}
          {prompt.content.length > 400 ? "..." : ""}
        </p>
      )}
    </div>
  );
});
