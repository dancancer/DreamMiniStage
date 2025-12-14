/* ═══════════════════════════════════════════════════════════════════════════
   Preset 排序算法

   设计理念：
   - 单一排序算法：只使用 group_id/position
   - 导入时转换：prompt_order 已在 preset-import.ts 转换为 group_id/position
   - 消除运行时双通道：不再检测 prompt_order 的存在
   ═══════════════════════════════════════════════════════════════════════════ */

import type { PresetPrompt } from "@/lib/models/preset-model";

/* ─────────────────────────────────────────────────────────────────────────────
   类型定义
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 可排序的 Prompt 类型
 *
 * 任何具有 group_id 和 position 的对象都可以被排序
 */
export interface SortablePrompt {
  identifier: string;
  group_id?: string | number;
  position?: number;
}

/**
 * 排序选项
 */
export interface SortOptions {
  /** 目标 group_id，只返回该组的 prompts */
  targetGroupId?: string | number;
  /** 是否过滤掉 enabled=false 的项 */
  filterDisabled?: boolean;
}

/* ─────────────────────────────────────────────────────────────────────────────
   核心排序函数
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 按 group_id 和 position 排序 prompts
 *
 * 这是唯一的排序入口，消除了双通道排序的复杂性
 *
 * @param prompts - 待排序的 prompts
 * @param options - 排序选项
 * @returns 排序后的 prompts（新数组，不修改原数组）
 *
 * @example
 * const sorted = sortPrompts(preset.prompts, { targetGroupId: 2 });
 */
export function sortPrompts<T extends SortablePrompt>(
  prompts: T[],
  options: SortOptions = {},
): T[] {
  const { targetGroupId, filterDisabled = false } = options;

  let filtered = [...prompts];

  // 按 group_id 过滤
  if (targetGroupId !== undefined) {
    filtered = filtered.filter(
      (p) => String(p.group_id) === String(targetGroupId),
    );
  }

  // 按 enabled 过滤
  if (filterDisabled) {
    filtered = filtered.filter((p) => {
      const prompt = p as T & { enabled?: boolean };
      return prompt.enabled !== false;
    });
  }

  // 按 position 排序
  return filtered.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

/**
 * 智能获取 prompts，自动选择最佳 group
 *
 * 尝试顺序：group_id=2 → group_id=1 → 无 group_id 的 prompts
 * 这保持了与旧逻辑的兼容性，但使用统一的排序函数
 *
 * @param prompts - 所有 prompts
 * @param filterDisabled - 是否过滤禁用项
 */
export function getPromptsFromBestGroup<T extends SortablePrompt & { enabled?: boolean }>(
  prompts: T[],
  filterDisabled = true,
): T[] {
  // 尝试 group_id = 2
  let result = sortPrompts(prompts, { targetGroupId: 2, filterDisabled });
  if (result.length > 0) return result;

  // 尝试 group_id = 1
  result = sortPrompts(prompts, { targetGroupId: 1, filterDisabled });
  if (result.length > 0) return result;

  // 回退到无 group_id 的 prompts
  const noGroup = prompts.filter((p) => !p.group_id);
  if (filterDisabled) {
    return noGroup.filter((p) => p.enabled !== false);
  }
  return noGroup;
}

/**
 * 按 group_id 分组 prompts
 *
 * @param prompts - 待分组的 prompts
 * @returns Map<groupId, prompts[]>
 */
export function groupPromptsByGroupId<T extends SortablePrompt>(
  prompts: T[],
): Map<string | number, T[]> {
  const groups = new Map<string | number, T[]>();

  for (const prompt of prompts) {
    const groupId = prompt.group_id ?? 0;
    const existing = groups.get(groupId) ?? [];
    existing.push(prompt);
    groups.set(groupId, existing);
  }

  // 对每个组内的 prompts 按 position 排序
  for (const [groupId, groupPrompts] of groups) {
    groups.set(
      groupId,
      groupPrompts.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    );
  }

  return groups;
}
