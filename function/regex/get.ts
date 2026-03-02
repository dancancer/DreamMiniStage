/**
 * @input  lib/models/regex-script-model, lib/data/roleplay/regex-script-operation
 * @output getRegexScripts
 * @pos    正则脚本获取 - 获取角色的正则脚本列表
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { RegexScript } from "@/lib/models/regex-script-model";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";

export async function getRegexScripts(characterId: string): Promise<Record<string, RegexScript> | null> {
  try {
    return await RegexScriptOperations.getRegexScripts(characterId);
  } catch (error) {
    console.error("Error getting regex scripts:", error);
    throw new Error("Failed to get regex scripts");
  }
}
