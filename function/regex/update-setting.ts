/**
 * @input  lib/models/regex-script-model, lib/data/roleplay/regex-script-operation
 * @output updateRegexScriptSettings
 * @pos    正则设置更新 - 更新角色的正则脚本配置
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { RegexScriptSettings } from "@/lib/models/regex-script-model";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";  

export async function updateRegexScriptSettings(
  characterId: string,
  updates: Partial<RegexScriptSettings>,
): Promise<RegexScriptSettings> {
  try {
    return await RegexScriptOperations.updateRegexScriptSettings(characterId, updates);
  } catch (error) {
    console.error("Error updating regex script settings:", error);
    throw new Error("Failed to update regex script settings");
  }
} 
