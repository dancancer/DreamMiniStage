/**
 * @input  utils/character-parser, lib/story-agent/import
 * @output previewStoryAgentFromFiles, enrichStoryAgentPreview, commitStoryAgentFromPreview, importStoryAgentFromFiles
 * @pos    Story Agent 导入 - 将角色卡/世界书/预设/正则一次性编译为 blueprint session
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { parseCharacterCard } from "@/utils/character-parser";
import { createQaModelAdapter, type AssetSource, type AssetSourceKind } from "@/lib/adapters/import";
import {
  commitStoryAgentImport,
  compileStoryAgentImport,
  importStoryAgentSession,
  repairImportPreview,
  synthesizeImportWidgets,
  type StoryAgentImportPreview,
  type StoryAgentImportResult,
  type StoryAgentRawAsset,
} from "@/lib/story-agent/import";
import type { SessionBlueprint } from "@/lib/story-agent/blueprint";
import { createWidgetSynthesisModel } from "@/lib/story-agent/render-intent";
import { LLMNodeTools } from "@/lib/nodeflow/LLMNode/LLMNodeTools";
import type { LLMConfig } from "@/lib/nodeflow/LLMNode/llm-config";

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

// 导入期 LLM 富化（向导「AI 增强」触发，客户端执行）：用 active 会话模型同时做 QA 修复与
// 富 UI 复现。invokeLLM 默认走 LLMNodeTools，测试可注入 fake。baseConfig 由调用方从当前
// 模型配置映射（modelName/apiKey/baseUrl/llmType + advanced）；adapter 内部 sanitize 后非流式调用。
export async function enrichStoryAgentPreview(
  preview: StoryAgentImportPreview,
  baseConfig: LLMConfig,
  invokeLLM: (config: LLMConfig) => Promise<string> = (config) => LLMNodeTools.invokeLLM(config),
): Promise<StoryAgentImportPreview> {
  const qaModel = createQaModelAdapter({ invokeLLM, baseConfig });
  const widgetModel = createWidgetSynthesisModel({ invokeLLM, baseConfig });
  const repaired = await repairImportPreview(preview, qaModel);
  return synthesizeImportWidgets(repaired, widgetModel);
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
