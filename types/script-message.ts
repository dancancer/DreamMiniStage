/**
 * @input  (none)
 * @output ScriptMessageData
 * @pos    类型定义层 - iframe 与父窗口之间的脚本通信消息格式
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         脚本消息类型定义                                    ║
 * ║                                                                            ║
 * ║  统一的脚本消息类型，用于 iframe 与父窗口之间的通信                          ║
 * ║  所有组件共享此类型，避免重复定义导致的类型不兼容                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

export interface ScriptMessageData {
  type: string;
  id?: string;
  payload?: {
    method?: string;
    args?: unknown[];
    [key: string]: unknown;
  };
}
