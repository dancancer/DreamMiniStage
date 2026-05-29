/**
 * @input  utils/character-parser, lib/story-agent/import
 * @output previewStoryAgentFromFiles, commitStoryAgentFromPreview, importStoryAgentFromFiles
 * @pos    Story Agent 导入 - 将角色卡/世界书/预设/正则一次性编译为 blueprint session
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { parseCharacterCard } from "@/utils/character-parser";
import type { AssetSource, AssetSourceKind } from "@/lib/adapters/import";
import {
  commitStoryAgentImport,
  compileStoryAgentImport,
  importStoryAgentSession,
  type StoryAgentImportPreview,
  type StoryAgentImportResult,
  type StoryAgentRawAsset,
} from "@/lib/story-agent/import";
import type { SessionBlueprint } from "@/lib/story-agent/blueprint";

export interface StoryAgentImportFiles {
  characterFile: File;
  presetFile?: File | null;
  worldBookFiles?: File[];
  regexFiles?: File[];
  sessionName?: string;
}

export async function previewStoryAgentFromFiles(
  files: StoryAgentImportFiles,
): Promise<StoryAgentImportPreview> {
  const assets = await readStoryAgentFiles(files);
  return compileStoryAgentImport(assets);
}

export async function commitStoryAgentFromPreview(params: {
  blueprint: SessionBlueprint;
  avatarFile?: File | null;
  sessionName?: string;
}): Promise<StoryAgentImportResult> {
  return commitStoryAgentImport({
    blueprint: params.blueprint,
    avatar: isPngFile(params.avatarFile) ? params.avatarFile : undefined,
    sessionName: params.sessionName,
  });
}

export async function importStoryAgentFromFiles(
  files: StoryAgentImportFiles,
): Promise<StoryAgentImportResult> {
  const assets = await readStoryAgentFiles(files);
  return importStoryAgentSession(assets);
}

async function readStoryAgentFiles(files: StoryAgentImportFiles) {
  const character = await readCharacterAsset(files.characterFile);

  return {
    character,
    avatar: isPngFile(files.characterFile) ? files.characterFile : undefined,
    sessionName: files.sessionName,
    preset: files.presetFile ? await readJsonAsset(files.presetFile, "preset", 0) : undefined,
    worldBooks: await readJsonAssets(files.worldBookFiles ?? [], "worldbook"),
    regexScripts: await readJsonAssets(files.regexFiles ?? [], "regex"),
  };
}

async function readCharacterAsset(file: File) {
  const raw = isPngFile(file)
    ? JSON.parse(await parseCharacterCard(file))
    : await readJsonFile(file);

  return {
    raw,
    source: createSource(file, isPngFile(file) ? "png-character" : "json-character"),
  };
}

async function readJsonAssets(
  files: File[],
  sourceKind: Extract<AssetSourceKind, "worldbook" | "regex">,
): Promise<StoryAgentRawAsset[]> {
  return Promise.all(files.map((file, index) => readJsonAsset(file, sourceKind, index)));
}

async function readJsonAsset(
  file: File,
  sourceKind: Extract<AssetSourceKind, "preset" | "worldbook" | "regex">,
  index: number,
): Promise<StoryAgentRawAsset> {
  return {
    id: `${sourceKind}:${index}:${file.name}`,
    name: file.name.replace(/\.[^.]+$/, ""),
    raw: await readJsonFile(file),
    source: createSource(file, sourceKind),
  };
}

async function readJsonFile(file: File): Promise<unknown> {
  try {
    return JSON.parse(await file.text());
  } catch {
    throw new Error(`Invalid JSON file: ${file.name}`);
  }
}

function createSource(file: File, sourceKind: AssetSourceKind): AssetSource {
  return {
    sourcePath: file.name,
    sourceKind,
    detectedFormat: sourceKind,
    sourceHash: `${file.name}:${file.size}:${file.lastModified}`,
  };
}

function isPngFile(file?: File | null): file is File {
  return Boolean(file && file.name.toLowerCase().endsWith(".png"));
}
