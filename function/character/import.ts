/**
 * @input  utils/character-parser, lib/data/roleplay/*, lib/data/local-storage, lib/adapters/import
 * @output handleCharacterUpload
 * @pos    角色导入 - 从 PNG 文件解析并创建角色卡（含世界书、正则脚本）
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { parseCharacterCard } from "@/utils/character-parser";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import { setBlob } from "@/lib/data/local-storage";
import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";
import {
  createImportedAssetBundle,
  type AssetSource,
  type ImportedAssetBundle,
} from "@/lib/adapters/import";
import type { RegexScript } from "@/lib/models/regex-script-model";
import type { WorldBookEntry } from "@/lib/models/world-book-model";

export function getCharacterWorldBookEntries(
  bundle: ImportedAssetBundle,
): WorldBookEntry[] {
  return bundle.worldBooks
    .find((worldBook) => worldBook.id === "character-book")
    ?.entries.map((entry) => entry.normalized) ?? [];
}

export function getCharacterRegexScripts(bundle: ImportedAssetBundle): RegexScript[] {
  return bundle.regexScripts.map((script) => script.raw);
}

export async function handleCharacterUpload(file: File) {
  if (!file || !file.name.toLowerCase().endsWith(".png")) {
    throw new Error("Unsupported or missing file.");
  }

  try {
    const characterData = await parseCharacterCard(file);
    const characterJson = JSON.parse(characterData);

    const characterId = `char_${Date.now()}`;
    const imagePath = `${characterId}.png`;
    const importedBundle = createImportedAssetBundle({
      bundleId: `bundle:${characterId}`,
      sourceHash: createUploadSourceHash(file),
      createdAt: new Date().toISOString(),
      characterId,
      character: {
        raw: characterJson,
        source: createUploadSource(file, characterJson),
      },
    });
    const worldBookEntries = getCharacterWorldBookEntries(importedBundle);
    const regexScripts = getCharacterRegexScripts(importedBundle);

    if (worldBookEntries.length > 0) {
      // ── 使用 "character:" 前缀，与级联加载器的读取规范保持一致
      await WorldBookOperations.updateWorldBook(`character:${characterId}`, worldBookEntries);
    }

    if (regexScripts.length > 0) {
      await RegexScriptOperations.updateRegexScripts(characterId, regexScripts);
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
      hasWorldBook: worldBookEntries.length > 0,
      hasRegexScripts: regexScripts.length > 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to parse character data:", error);
    throw new Error(`Failed to parse character data: ${errorMessage}`);
  }
}

function createUploadSource(file: File, characterJson: Record<string, unknown>): AssetSource {
  return {
    sourcePath: file.name,
    sourceKind: "png-character",
    detectedFormat: typeof characterJson.spec === "string" ? characterJson.spec : "png-character",
    sourceHash: createUploadSourceHash(file),
  };
}

function createUploadSourceHash(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
