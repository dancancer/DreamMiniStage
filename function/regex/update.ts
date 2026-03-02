/**
 * @input  lib/models/regex-script-model, lib/data/roleplay/regex-script-operation
 * @output updateRegexScript
 * @pos    正则脚本更新 - 更新单个正则脚本
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { RegexScript } from "@/lib/models/regex-script-model";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";

export async function updateRegexScript(
  characterId: string,
  scriptId: string,
  updates: Partial<RegexScript>,
): Promise<boolean> {
  try {
    return await RegexScriptOperations.updateRegexScript(characterId, scriptId, updates);
  } catch (error) {
    console.error("Error updating regex script:", error);
    throw new Error("Failed to update regex script");
  }
}
