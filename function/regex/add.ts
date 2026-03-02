/**
 * @input  lib/models/regex-script-model, lib/data/roleplay/regex-script-operation
 * @output addRegexScript
 * @pos    正则脚本新增 - 为角色添加正则脚本
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { RegexScript } from "@/lib/models/regex-script-model";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";

export async function addRegexScript(characterId: string, script: RegexScript): Promise<string | null> {
  try {
    return await RegexScriptOperations.addRegexScript(characterId, script);
  } catch (error) {
    console.error("Error adding regex script:", error);
    throw new Error("Failed to add regex script");
  }
}
