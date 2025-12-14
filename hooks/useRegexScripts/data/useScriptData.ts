/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      Script Data Loading Hook                             ║
 * ║                                                                           ║
 * ║  数据加载 - Scoped / Global / Preset 三种来源                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { useState, useCallback } from "react";
import { getRegexScripts } from "@/function/regex/get";
import { getRegexScriptSettings } from "@/function/regex/get-setting";
import { listGlobalRegexScripts, getGlobalRegexScript } from "@/function/regex/global";
import { PresetOperations } from "@/lib/data/roleplay/preset-operation";
import { normalizeRegexScript } from "@/lib/models/regex-script-model";
import { ScriptSource } from "@/lib/models/regex-script-model";
import type { RegexScript, RegexScriptSettings } from "@/lib/models/regex-script-model";
import type { SourceScripts } from "../types";
import { DEFAULT_SETTINGS } from "../types";

/* ═══════════════════════════════════════════════════════════════════════════
   Hook 实现
   ═══════════════════════════════════════════════════════════════════════════ */

export function useScriptData(characterId: string) {
  // 状态
  const [scripts, setScripts] = useState<Record<string, RegexScript>>({});
  const [settings, setSettings] = useState<RegexScriptSettings>(DEFAULT_SETTINGS);
  const [globalSources, setGlobalSources] = useState<SourceScripts[]>([]);
  const [presetSource, setPresetSource] = useState<SourceScripts | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ─── 加载 Scoped 脚本 ───
  const loadScoped = useCallback(async () => {
    setIsLoading(true);
    try {
      const [scriptsData, settingsData] = await Promise.all([
        getRegexScripts(characterId),
        getRegexScriptSettings(characterId),
      ]);
      setScripts(scriptsData || {});
      setSettings(settingsData);
    } catch (error) {
      console.error("Error loading regex scripts:", error);
    } finally {
      setIsLoading(false);
    }
  }, [characterId]);

  // ─── 加载 Global 脚本 ───
  const loadGlobal = useCallback(async () => {
    try {
      const result = await listGlobalRegexScripts();
      if (!result.success) {
        setGlobalSources([]);
        return;
      }

      const bundles: SourceScripts[] = [];
      for (const meta of result.globalRegexScripts) {
        const detail = await getGlobalRegexScript(meta.id);
        const rawScripts = detail.scripts || {};
        const normalized = Object.fromEntries(
          Object.entries(rawScripts).map(([key, script]) => {
            const scriptKey = script.scriptKey || key;
            return [
              scriptKey,
              normalizeRegexScript({
                ...script,
                scriptKey,
                source: ScriptSource.GLOBAL,
                sourceId: meta.id,
              }),
            ];
          })
        );

        bundles.push({
          ownerId: meta.id,
          name: meta.name,
          metadata: meta,
          scripts: normalized,
          source: ScriptSource.GLOBAL,
        });
      }

      setGlobalSources(bundles);
    } catch (error) {
      console.error("Error loading global regex scripts:", error);
      setGlobalSources([]);
    }
  }, []);

  // ─── 加载 Preset 脚本 ───
  const loadPreset = useCallback(async () => {
    try {
      const presets = await PresetOperations.getAllPresets();
      const enabled = presets.find((p) => p.enabled !== false);
      if (!enabled) {
        setPresetSource(null);
        return;
      }

      const ext =
        (enabled as any).extensions?.regex_scripts || (enabled as any).regex_scripts || [];
      const scriptsRecord: Record<string, RegexScript> = {};

      // 1) 解析 extensions.regex_scripts
      if (Array.isArray(ext)) {
        ext.forEach((script: any, idx: number) => {
          if (!script || !script.findRegex) return;
          const key = script.scriptKey || script.id || `preset_${idx}`;
          scriptsRecord[key] = normalizeRegexScript({
            ...script,
            scriptKey: key,
            source: ScriptSource.PRESET,
            sourceId: enabled.id || "preset",
          });
        });
      }

      // 2) 解析 Prompt 内容中的 RegexBinding.regexes（SillyTavern 兼容）
      if (Array.isArray((enabled as any).prompts)) {
        (enabled as any).prompts.forEach((prompt: any, idx: number) => {
          if (!prompt?.content || typeof prompt.content !== "string") return;
          try {
            const parsed = JSON.parse(prompt.content);
            const regexes = parsed?.RegexBinding?.regexes;
            if (!Array.isArray(regexes)) return;
            regexes.forEach((script: any, rIdx: number) => {
              if (!script?.findRegex) return;
              const key = script.scriptKey || script.id || `preset_${idx}_${rIdx}`;
              scriptsRecord[key] = normalizeRegexScript({
                ...script,
                scriptKey: key,
                source: ScriptSource.PRESET,
                sourceId: enabled.id || "preset",
              });
            });
          } catch {
            // 非 JSON prompt 忽略
          }
        });
      }

      if (Object.keys(scriptsRecord).length === 0) {
        setPresetSource(null);
        return;
      }

      setPresetSource({
        ownerId: enabled.id || "preset",
        name: enabled.name,
        scripts: scriptsRecord,
        source: ScriptSource.PRESET,
        readOnly: true,
      });
    } catch (error) {
      console.error("Error loading preset regex scripts:", error);
      setPresetSource(null);
    }
  }, []);

  return {
    // 状态
    scripts,
    settings,
    globalSources,
    presetSource,
    isLoading,
    // 操作
    loadScoped,
    loadGlobal,
    loadPreset,
    setScripts,
    setSettings,
  };
}
