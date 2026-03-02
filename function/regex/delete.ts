/**
 * @input  lib/models/regex-script-model, lib/data/roleplay/regex-script-operation
 * @output deleteRegexScript
 * @pos    正则脚本删除 - 删除单个正则脚本
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { RegexScriptSettings } from "@/lib/models/regex-script-model";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";  

export async function deleteRegexScript(characterId: string, scriptId: string): Promise<boolean> {
  try {
    return await RegexScriptOperations.deleteRegexScript(characterId, scriptId);
  } catch (error) {
    console.error("Error deleting regex script:", error);
    throw new Error("Failed to delete regex script");
  }
}
