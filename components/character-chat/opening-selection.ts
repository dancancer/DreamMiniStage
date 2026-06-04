/**
 * @input  types/character-dialogue
 * @output getOpeningNavigatorState, OpeningNavigatorState
 * @pos    开场白选择展示状态
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       Opening Selection View State                       ║
 * ║                                                                           ║
 * ║  职责：把 OpeningSelection 转换为 MessageList 可直接渲染的导航状态          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { OpeningSelection } from "@/types/character-dialogue";

interface OpeningNavigatorInput {
  selection: OpeningSelection;
  visibleMessageCount: number;
  firstVisibleRole?: string;
  label: string;
}

export interface OpeningNavigatorState {
  visible: boolean;
  current: number;
  total: number;
  label: string;
}

export function getOpeningNavigatorState({
  selection,
  visibleMessageCount,
  firstVisibleRole,
  label,
}: OpeningNavigatorInput): OpeningNavigatorState {
  const total = selection.messages.length;
  const current = clampOpeningIndex(selection.index, total);
  const visible = (
    !selection.locked &&
    total > 1 &&
    visibleMessageCount === 1 &&
    firstVisibleRole === "assistant"
  );

  return { visible, current, total, label };
}

function clampOpeningIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}
