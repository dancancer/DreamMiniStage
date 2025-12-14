/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      Dialogue Store Helpers                               ║
 * ║                                                                           ║
 * ║  工具函数 - 好品味：纯函数，无副作用                                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

/* ═══════════════════════════════════════════════════════════════════════════
   索引规范化
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 规范化插入索引
 *
 * 好品味原则：边界情况自然融入常规逻辑
 * - 负数索引从末尾计算
 * - 超出范围自动夹紧
 * - undefined/NaN 返回末尾
 */
export function normalizeInsertIndex(raw: number | undefined, length: number): number {
  // undefined 或 NaN 插入到末尾
  if (raw === undefined || Number.isNaN(raw)) return length;

  // 负数从末尾计算（Python 风格）
  if (raw < 0) return Math.max(length + raw, 0);

  // 超出长度夹紧到末尾
  if (raw > length) return length;

  return raw;
}
