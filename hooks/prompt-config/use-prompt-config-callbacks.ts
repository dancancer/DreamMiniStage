import { useMemo } from "react";
import {
  getActiveModel,
  getActivePromptPresetInfo,
  getPromptInstructState,
  getPromptPostProcessingValue,
  getPromptStopStrings,
  listPromptEntries,
  listPromptPresets,
  selectPromptContextPreset,
  selectPromptPresetByName,
  setActiveModel,
  setPromptEntriesEnabled,
  setPromptPostProcessingValue,
  setPromptStopStrings,
  updatePromptInstructState,
} from "@/lib/prompt-config/service";

export function usePromptConfigCallbacks() {
  return useMemo(() => ({
    getInstructMode: getPromptInstructState,
    setInstructMode: updatePromptInstructState,
    getStopStrings: getPromptStopStrings,
    setStopStrings: setPromptStopStrings,
    getPromptPostProcessing: getPromptPostProcessingValue,
    setPromptPostProcessing: setPromptPostProcessingValue,
    getModel: getActiveModel,
    setModel: setActiveModel,
    getPreset: getActivePromptPresetInfo,
    setPreset: async (name: string) => {
      await selectPromptPresetByName(name);
    },
    listPresets: listPromptPresets,
    selectContextPreset: selectPromptContextPreset,
    listPromptEntries,
    setPromptEntriesEnabled,
  }), []);
}
