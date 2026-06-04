/**
 * @input  lib/models/regex-script-model
 * @output regex script source helpers
 * @pos    正则脚本来源装配、授权判断与排序规则
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

import {
  RegexAllowList,
  RegexScript,
  ScriptSource,
  normalizeRegexScript,
} from "@/lib/models/regex-script-model";

const SOURCE_PRIORITY: Record<ScriptSource, number> = {
  [ScriptSource.GLOBAL]: 0,
  [ScriptSource.CHARACTER]: 1,
  [ScriptSource.PRESET]: 2,
};

export interface RegexScriptSourceOptions {
  includeGlobal?: boolean;
  presetSource?: {
    ownerId: string;
    apiId?: string;
    presetName?: string;
  };
}

export interface RegexScriptSourceEntry {
  source: ScriptSource;
  ownerId: string;
  apiId?: string;
  presetName?: string;
}

export function buildRegexScriptSources(
  ownerId: string,
  globalOwnerIds: string[],
  options: RegexScriptSourceOptions,
): RegexScriptSourceEntry[] {
  return [
    ...globalSources(globalOwnerIds, options.includeGlobal),
    ...characterSources(ownerId),
    ...presetSources(options.presetSource),
  ];
}

export function isRegexScriptSourceAllowed(
  source: ScriptSource,
  ownerId: string,
  allowList: RegexAllowList | null,
  apiId?: string,
  presetName?: string,
): boolean {
  if (!allowList) return true;
  if (source === ScriptSource.CHARACTER) return allowList.characters.includes(ownerId);
  if (source !== ScriptSource.PRESET) return true;
  if (!apiId || !presetName) return false;
  return allowList.presets[apiId]?.includes(presetName) ?? false;
}

export function normalizeRegexScriptsBySource(
  scripts: Record<string, RegexScript>,
  source: ScriptSource,
  ownerId: string,
): RegexScript[] {
  return Object.entries(scripts).map(([key, script]) => normalizeRegexScript({
    ...script,
    id: script.id ?? key,
    scriptKey: script.scriptKey ?? key,
    source,
    sourceId: ownerId,
  }));
}

export function sortRegexScriptsByPriority(a: RegexScript, b: RegexScript): number {
  const source = sourceRank(a.source) - sourceRank(b.source);
  if (source !== 0) return source;
  const placement = placementRank(a.placement) - placementRank(b.placement);
  if (placement !== 0) return placement;
  return (a.scriptKey || a.scriptName || "").localeCompare(b.scriptKey || b.scriptName || "");
}

function globalSources(
  ownerIds: string[],
  includeGlobal: boolean | undefined,
): RegexScriptSourceEntry[] {
  if (includeGlobal === false) return [];
  return ownerIds.map((ownerId) => ({ source: ScriptSource.GLOBAL, ownerId }));
}

function characterSources(ownerId: string): RegexScriptSourceEntry[] {
  return ownerId ? [{ source: ScriptSource.CHARACTER, ownerId }] : [];
}

function presetSources(
  presetSource: RegexScriptSourceOptions["presetSource"],
): RegexScriptSourceEntry[] {
  return presetSource?.ownerId ? [{ source: ScriptSource.PRESET, ...presetSource }] : [];
}

function placementRank(placement?: number[]): number {
  return placement?.[0] ?? 999;
}

function sourceRank(source?: ScriptSource): number {
  return SOURCE_PRIORITY[source as ScriptSource] ?? SOURCE_PRIORITY[ScriptSource.CHARACTER];
}
