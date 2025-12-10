/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       PresetEditor                                         ║
 * ║  预设管理：列表/排序/筛选/展开 + 提示词编辑弹窗                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/store/toast-store";
import ImportPresetModal from "@/components/ImportPresetModal";
import CreatePresetModal from "@/components/CreatePresetModal";
import EditPresetNameModal from "@/components/EditPresetNameModal";
import CopyPresetModal from "@/components/CopyPresetModal";
import EditPromptModal from "@/components/EditPromptModal";
import { useLanguage } from "@/app/i18n";
import { getAllPresets, getPreset, deletePreset, togglePresetEnabled, getPromptsForDisplay } from "@/function/preset/global";
import { deletePromptFromPreset, togglePromptEnabled } from "@/function/preset/edit";
import { useTableSort, sortItems } from "@/hooks/useTableSort";
import { useTableFilter, filterItems } from "@/hooks/useTableFilter";
import { useRowExpansion } from "@/hooks/useRowExpansion";
import { PresetControls, PresetHeader, PresetTable, PresetData, PresetPromptData } from "@/components/preset-editor";

interface PresetEditorProps {
  onClose: () => void;
  characterName?: string;
  characterId?: string;
}

export default function PresetEditor({ onClose, characterName, characterId }: PresetEditorProps) {
  const { t, fontClass, serifFontClass } = useLanguage();
  const [presets, setPresets] = useState<PresetData[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<PresetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentEditingPrompt, setCurrentEditingPrompt] = useState<PresetPromptData | null>(null);
  const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
  const [currentEditingPreset, setCurrentEditingPreset] = useState<PresetData | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [currentCopyingPreset, setCurrentCopyingPreset] = useState<PresetData | null>(null);

  const SORT_STORAGE_KEY = `preset_sort_${characterId || "global"}`;
  const FILTER_STORAGE_KEY = `preset_filter_${characterId || "global"}`;

  const { sortBy, sortOrder, handleSortByChange, handleSortOrderToggle } = useTableSort({
    storageKey: SORT_STORAGE_KEY,
    defaultSortBy: "name",
    defaultSortOrder: "asc",
  });
  const { filterBy, handleFilterChange } = useTableFilter({
    storageKey: FILTER_STORAGE_KEY,
    defaultFilter: "all",
  });
  const { expandedRows, toggleRow, setExpandedRows } = useRowExpansion();

  /* ─────────────────────────────────────────────────────────────────────────
   * 稳定回调：避免 PresetTable 因回调引用变化而重渲染
   * ───────────────────────────────────────────────────────────────────────── */
  const handleEditPresetName = useCallback((preset: PresetData) => {
    setCurrentEditingPreset(preset);
    setIsEditNameModalOpen(true);
  }, []);

  const handleCopyPreset = useCallback((preset: PresetData) => {
    setCurrentCopyingPreset(preset);
    setIsCopyModalOpen(true);
  }, []);

  const handleEditPrompt = useCallback((prompt: PresetPromptData) => {
    setCurrentEditingPrompt(prompt);
    setIsEditModalOpen(true);
  }, []);

  const sortComparators = useMemo(
    () => ({
      name: (a: PresetData, b: PresetData) => a.name.localeCompare(b.name),
      promptCount: (a: PresetData, b: PresetData) => a.totalPrompts - b.totalPrompts,
      lastUpdated: (a: PresetData, b: PresetData) => a.lastUpdated - b.lastUpdated,
    }),
    [],
  );

  const filterMap = useMemo(
    () => ({
      all: () => true,
      active: (p: PresetData) => p.totalPrompts > 0,
      empty: (p: PresetData) => p.totalPrompts === 0,
    }),
    [],
  );

  const formatPreset = useCallback((preset: any): PresetData => {
    const prompts = preset.prompts || [];
    return {
      ...preset,
      id: preset.id || `preset-${Date.now()}`,
      enabled: preset.enabled !== false,
      totalPrompts: prompts.length,
      enabledPrompts: prompts.filter((p: any) => p.enabled !== false).length,
      lastUpdated: new Date(preset.updated_at || preset.created_at || Date.now()).getTime(),
      prompts,
    };
  }, []);

  const refreshPresets = useCallback(async () => {
    try {
      const result = await getAllPresets();
      if (result.success && result.data) {
        setPresets(result.data.map(formatPreset));
        return;
      } else {
        toast.error(t("preset.loadFailed") || "Failed to load presets");
      }
    } catch (error) {
      console.error("Error loading presets:", error);
      toast.error(t("preset.loadFailed") || "Failed to load presets");
    }
  }, [formatPreset, t]);

  const selectPreset = useCallback(
    async (presetId: string) => {
      try {
        const result = await getPreset(presetId);
        const orderedPromptsResult = await getPromptsForDisplay(presetId);
        if (result.success && result.data && orderedPromptsResult.success && orderedPromptsResult.data) {
          const formatted = formatPreset({ ...result.data, prompts: orderedPromptsResult.data });
          setSelectedPreset(formatted);
          setExpandedRows((prev) => new Set(prev).add(presetId));
        } else {
          toast.error(t("preset.loadDetailsFailed") || "Failed to load preset details");
        }
      } catch (error) {
        console.error("Load preset failed:", error);
        toast.error(t("preset.loadDetailsFailed") || "Failed to load preset details");
      }
    },
    [formatPreset, setExpandedRows, t],
  );

  const handleTogglePreset = useCallback(
    async (presetId: string, enableState: boolean) => {
      try {
        const result = await togglePresetEnabled(presetId, enableState);
        if (result.success) {
          await refreshPresets();
          if (selectedPreset?.id === presetId) {
            await selectPreset(presetId);
          }
          toast.success(enableState ? t("preset.presetEnabledSuccess") : t("preset.presetDisabledSuccess"));
        } else {
          toast.error(t("preset.togglePresetFailed") || "Failed to toggle preset");
        }
      } catch (error) {
        console.error("Toggle preset failed:", error);
        toast.error(t("preset.togglePresetFailed") || "Failed to toggle preset");
      }
    },
    [refreshPresets, selectPreset, selectedPreset?.id, t],
  );

  const handleDeletePreset = useCallback(
    async (presetId: string) => {
      try {
        const result = await deletePreset(presetId);
        if (result.success) {
          setSelectedPreset(null);
          await refreshPresets();
          toast.success(t("preset.deleteSuccess"));
        } else {
          toast.error(t("preset.deleteFailed") || "Failed to delete preset");
        }
      } catch (error) {
        console.error("Delete preset failed:", error);
        toast.error(t("preset.deleteFailed") || "Failed to delete preset");
      }
    },
    [refreshPresets, t],
  );

  const handleDeletePrompt = useCallback(
    async (presetId: string, promptIdentifier: string) => {
      try {
        const result = await deletePromptFromPreset(presetId, promptIdentifier);
        if (result.success) {
          await selectPreset(presetId);
          await refreshPresets();
          toast.success(t("preset.deletePromptSuccess"));
        } else {
          toast.error(t("preset.deletePromptFailed") || "Failed to delete prompt");
        }
      } catch (error) {
        console.error("Delete prompt failed:", error);
        toast.error(t("preset.deletePromptFailed") || "Failed to delete prompt");
      }
    },
    [refreshPresets, selectPreset, t],
  );

  const handleTogglePrompt = useCallback(
    async (presetId: string, promptIdentifier: string, enableState: boolean) => {
      try {
        const result = await togglePromptEnabled(presetId, promptIdentifier, enableState);
        if (result.success) {
          await selectPreset(presetId);
          await refreshPresets();
          toast.success(enableState ? t("preset.promptEnabledSuccess") : t("preset.promptDisabledSuccess"));
        } else {
          toast.error(t("preset.togglePromptFailed") || "Failed to toggle prompt");
        }
      } catch (error) {
        console.error("Toggle prompt failed:", error);
        toast.error(t("preset.togglePromptFailed") || "Failed to toggle prompt");
      }
    },
    [refreshPresets, selectPreset, t],
  );

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    refreshPresets()
      .then(async () => {
        if (!isActive) return;

        const activatePresetId = sessionStorage.getItem("activate_preset_id");
        const activatePresetName = sessionStorage.getItem("activate_preset_name");

        if (activatePresetId) {
          await handleTogglePreset(activatePresetId, true);
          sessionStorage.removeItem("activate_preset_id");
        } else if (activatePresetName) {
          const all = await getAllPresets();
          if (all.success && all.data) {
            const match = all.data.find((p) => p.name && p.name.toLowerCase().includes(activatePresetName.toLowerCase()));
            if (match?.id) {
              await handleTogglePreset(match.id, true);
            } else {
              toast.error(`No preset found matching "${activatePresetName}"`);
            }
          }
          sessionStorage.removeItem("activate_preset_name");
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [handleTogglePreset, refreshPresets]);

  const filteredPresets = filterItems(presets, filterBy, filterMap);
  const sortedPresets = sortItems(filteredPresets, sortBy, sortOrder, sortComparators);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center ">
        <div className="flex flex-col items-center">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-t-primary-bright border-r-primary-soft border-b-ink-soft border-l-transparent animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-2 border-t-ink-soft border-r-primary-bright border-b-primary-soft border-l-transparent animate-spin-slow"></div>
          </div>
          <p className="mt-4 text-primary-soft magical-text">{t("preset.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col  text-cream-soft">
      <PresetHeader
        characterName={characterName}
        presets={presets}
        filteredCount={filteredPresets.length}
        filterBy={filterBy}
        fontClass={fontClass}
        serifFontClass={serifFontClass}
        t={t}
        onClose={onClose}
      />

      <PresetControls
        sortBy={sortBy}
        sortOrder={sortOrder}
        filterBy={filterBy}
        onCreate={() => setIsCreateModalOpen(true)}
        onImport={() => setIsImportModalOpen(true)}
        onSortByChange={handleSortByChange}
        onSortOrderToggle={handleSortOrderToggle}
        onFilterChange={handleFilterChange}
        t={t}
      />

      <PresetTable
        presets={sortedPresets}
        expandedRows={expandedRows}
        selectedPreset={selectedPreset}
        fontClass={fontClass}
        t={t}
        onTogglePreset={handleTogglePreset}
        onToggleRow={toggleRow}
        onSelectPreset={selectPreset}
        onEditPresetName={handleEditPresetName}
        onCopyPreset={handleCopyPreset}
        onDeletePreset={handleDeletePreset}
        onEditPrompt={handleEditPrompt}
        onTogglePrompt={handleTogglePrompt}
        onDeletePrompt={handleDeletePrompt}
      />

      {isImportModalOpen && (
        <ImportPresetModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={() => {
            refreshPresets();
            toast.success(t("preset.importSuccess") || "Import success");
          }}
        />
      )}

      {isCreateModalOpen && (
        <CreatePresetModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            refreshPresets();
          }}
        />
      )}

      {isEditModalOpen && currentEditingPrompt && (
        <EditPromptModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setCurrentEditingPrompt(null);
          }}
          prompt={currentEditingPrompt}
          presetId={selectedPreset?.id || ""}
          onSave={async () => {
            setIsEditModalOpen(false);
            setCurrentEditingPrompt(null);
            if (selectedPreset) await selectPreset(selectedPreset.id);
            await refreshPresets();
          }}
        />
      )}

      {isEditNameModalOpen && currentEditingPreset && (
        <EditPresetNameModal
          isOpen={isEditNameModalOpen}
          onClose={() => {
            setIsEditNameModalOpen(false);
            setCurrentEditingPreset(null);
          }}
          presetId={currentEditingPreset.id}
          currentName={currentEditingPreset.name}
          onSuccess={async () => {
            await refreshPresets();
            if (selectedPreset?.id === currentEditingPreset.id) {
              await selectPreset(currentEditingPreset.id);
            }
            setIsEditNameModalOpen(false);
            setCurrentEditingPreset(null);
          }}
        />
      )}

      {isCopyModalOpen && currentCopyingPreset && (
        <CopyPresetModal
          isOpen={isCopyModalOpen}
          onClose={() => {
            setIsCopyModalOpen(false);
            setCurrentCopyingPreset(null);
          }}
          sourcePresetId={currentCopyingPreset.id}
          sourcePresetName={currentCopyingPreset.name}
          onSuccess={() => {
            setIsCopyModalOpen(false);
            setCurrentCopyingPreset(null);
            refreshPresets();
          }}
        />
      )}
    </div>
  );
}
