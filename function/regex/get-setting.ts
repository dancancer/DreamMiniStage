/**
 * @input  lib/models/regex-script-model, lib/data/roleplay/regex-script-operation
 * @output getRegexScriptSettings
 * @pos    正则设置获取 - 获取角色的正则脚本配置
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { RegexScriptSettings } from "@/lib/models/regex-script-model";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";

export async function getRegexScriptSettings(characterId: string): Promise<RegexScriptSettings> {
  try {
    return await RegexScriptOperations.getRegexScriptSettings(characterId);
  } catch (error) {
    console.error("Error getting regex script settings:", error);
    throw new Error("Failed to get regex script settings");
  }
}
