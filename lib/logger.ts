/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  结构化日志 — 生产环境静默 debug/warn，仅保留 error                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

const isDev = process.env.NODE_ENV === "development";

export const logger = {
  /** 仅开发环境输出 */
  debug: (...args: unknown[]): void => {
    if (isDev) console.log(...args);
  },
  /** 仅开发环境输出 */
  warn: (...args: unknown[]): void => {
    if (isDev) console.warn(...args);
  },
  /** 始终输出 — 真正的错误不应被吞掉 */
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
