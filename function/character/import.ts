/**
 * @input  utils/character-parser, lib/data/roleplay/*, lib/data/local-storage, lib/adapters/import, uuid
 * @output handleCharacterUpload
 * @pos    角色导入 - 从 PNG 文件解析并创建角色卡（含世界书、正则脚本）
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { parseCharacterCard } from "@/utils/character-parser";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import { setBlob } from "@/lib/data/local-storage";
import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";
import { importRegexScripts, canImportRegexScripts } from "@/lib/adapters/import";
import { v4 as uuidv4 } from "uuid";

export async function handleCharacterUpload(file: File) {
  if (!file || !file.name.toLowerCase().endsWith(".png")) {
    throw new Error("Unsupported or missing file.");
  }

  try {
    const characterData = await parseCharacterCard(file);
    const characterJson = JSON.parse(characterData);

    const characterId = `char_${Date.now()}`;
    const imagePath = `${characterId}.png`;

    if (characterJson.data?.character_book?.entries) {
      // ── 使用 "character:" 前缀，与级联加载器的读取规范保持一致
      await WorldBookOperations.updateWorldBook(`character:${characterId}`, characterJson.data.character_book.entries);
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       使用导入适配器处理正则脚本

       适配器自动处理多种格式：
       - 数组格式: RegexScript[]
       - 对象格式: Record<string, RegexScript>
       - scripts 包装格式: { scripts: [] }
       - regexScripts 包装格式: { regexScripts: [] }
       ═══════════════════════════════════════════════════════════════════════════ */
    if (characterJson.data?.extensions?.regex_scripts) {
      const rawRegexScripts = characterJson.data.extensions.regex_scripts;

      if (canImportRegexScripts(rawRegexScripts)) {
        const normalizedScripts = importRegexScripts(rawRegexScripts);

        // 确保每个脚本都有 scriptKey
        normalizedScripts.forEach(script => {
          if (!script.scriptKey) {
            script.scriptKey = `script_${uuidv4()}`;
          }
        });

        await RegexScriptOperations.updateRegexScripts(characterId, normalizedScripts);
      }
    }

    await LocalCharacterRecordOperations.createCharacter(
      characterId,
      characterJson,
      imagePath,
    );

    await setBlob(imagePath, file);

    return {
      success: true,
      characterId,
      characterData: characterJson,
      imagePath,
      hasWorldBook: !!characterJson.data?.character_book?.entries,
      hasRegexScripts: !!characterJson.data?.extensions?.regex_scripts,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to parse character data:", error);
    throw new Error(`Failed to parse character data: ${errorMessage}`);
  }
}
