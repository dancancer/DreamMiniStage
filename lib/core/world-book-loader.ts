/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     世界书加载器                                            ║
 * ║                                                                            ║
 * ║  负责加载世界书内容并按 position 分组                                        ║
 * ║  【重构】现在使用级联加载器支持多来源世界书                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { loadWorldBooksFromSources } from "@/lib/core/world-book-cascade-loader";
import type { Character } from "@/lib/core/character";

/* ═══════════════════════════════════════════════════════════════════════════
   公共 API
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 加载世界书内容
 *
 * 根据当前用户输入和聊天历史匹配世界书条目，
 * 按 position 分组返回 wiBefore 和 wiAfter
 *
 * 【向后兼容】
 * - 保持原有签名不变
 * - 内部使用新的级联加载器
 * - 自动支持全局、角色、会话三个层级
 */
export async function loadWorldBookContent(
  character: Character,
  dialogueKey: string,
  currentUserInput: string,
): Promise<{ wiBefore: string; wiAfter: string }> {
  // ════════════════════════════════════════════════════════════════════════
  // 使用新的级联加载器
  // 支持多来源：全局 + 角色 + 会话
  // ════════════════════════════════════════════════════════════════════════
  return await loadWorldBooksFromSources(character.id, dialogueKey, currentUserInput);
}
