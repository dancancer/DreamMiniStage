/**
 * @input  lib/data/roleplay/preset-operation
 * @output deletePromptFromPreset, togglePromptEnabled, updatePromptInPreset
 * @pos    预设操作层 - 预设中提示词的 CRUD 操作
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { PresetOperations } from "@/lib/data/roleplay/preset-operation";

export async function deletePromptFromPreset(
  presetId: string,
  promptIdentifier: string,
) {
  try {
    const preset = await PresetOperations.getPreset(presetId);
    if (!preset) {
      return { success: false, error: "Preset not found" };
    }

    const updatedPrompts = preset.prompts.filter(
      (p) => p.identifier !== promptIdentifier,
    );

    const success = await PresetOperations.updatePreset(presetId, {
      prompts: updatedPrompts,
    });
    if (!success) {
      return { success: false, error: "Failed to delete prompt" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting prompt:", error);
    return { success: false, error: "Failed to delete prompt" };
  }
}

export async function togglePromptEnabled(
  presetId: string,
  promptIdentifier: string,
  enabled: boolean,
) {
  try {
    const preset = await PresetOperations.getPreset(presetId);
    if (!preset) {
      return { success: false, error: "Preset not found" };
    }

    const promptIndex = preset.prompts.findIndex(
      (p) => p.identifier === promptIdentifier,
    );
    if (promptIndex === -1) {
      return { success: false, error: "Prompt not found" };
    }

    const updatedPrompts = [...preset.prompts];
    updatedPrompts[promptIndex] = {
      ...updatedPrompts[promptIndex],
      enabled: enabled,
    };

    const success = await PresetOperations.updatePreset(presetId, {
      prompts: updatedPrompts,
    });
    if (!success) {
      return { success: false, error: "Failed to toggle prompt" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error toggling prompt:", error);
    return { success: false, error: "Failed to toggle prompt" };
  }
}

export async function updatePromptInPreset(
  presetId: string,
  promptIdentifier: string,
  updates: { content?: string; enabled?: boolean; position?: number },
) {
  try {
    const preset = await PresetOperations.getPreset(presetId);
    if (!preset) {
      return { success: false, error: "Preset not found" };
    }

    const originalPrompt = preset.prompts.find(p => p.identifier === promptIdentifier);
    if (!originalPrompt) {
      return { success: false, error: "Prompt not found in preset" };
    }

    const promptData = {
      identifier: promptIdentifier,
      name: originalPrompt.name || promptIdentifier,
      position: updates.position !== undefined ? updates.position : originalPrompt.position,
      ...updates,
    };

    const success = await PresetOperations.updateCharacterPrompt(
      presetId,
      originalPrompt.group_id || 2,
      promptData,
    );
    
    if (!success) {
      return { success: false, error: "Failed to update prompt" };
    }
    return { success: true };
  } catch (error) {
    console.error("Error updating prompt in preset:", error);
    return { success: false, error: "Failed to update prompt" };
  }
}
