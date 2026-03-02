/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Event Command Handlers                                 ║
 * ║                                                                           ║
 * ║  事件命令 - /event-emit                                                    ║
 * ║  兼容 JS-Slash-Runner 事件系统                                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";

/* ═══════════════════════════════════════════════════════════════════════════
   /event-emit - 触发自定义事件
   参数：name=<事件名> [data=<JSON数据>] 或 位置参数 <事件名> [数据]
   ═══════════════════════════════════════════════════════════════════════════ */

export const handleEventEmit: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  // 获取事件名：优先命名参数，回退位置参数
  const eventName = namedArgs.name || namedArgs.event || args[0];

  if (!eventName || typeof eventName !== "string") {
    console.warn("[/event-emit] 缺少事件名");
    return pipe;
  }

  // 获取事件数据
  let eventData: unknown;
  if (namedArgs.data) {
    try {
      eventData = JSON.parse(namedArgs.data);
    } catch {
      eventData = namedArgs.data;
    }
  } else if (args.length > 1) {
    // 尝试解析剩余参数为 JSON
    const dataStr = args.slice(1).join(" ");
    try {
      eventData = JSON.parse(dataStr);
    } catch {
      eventData = dataStr;
    }
  } else {
    eventData = {};
  }

  // 触发事件
  if (typeof window !== "undefined") {
    // 广播到所有 iframe
    window.dispatchEvent(
      new CustomEvent("DreamMiniStage:broadcast", {
        detail: { eventName, data: eventData },
      }),
    );

    // 同时在主窗口触发
    window.dispatchEvent(
      new CustomEvent(`DreamMiniStage:${eventName}`, {
        detail: eventData,
      }),
    );
  }

  console.log(`[/event-emit] 触发事件: ${eventName}`, eventData);
  return pipe;
};

/* ═══════════════════════════════════════════════════════════════════════════
   /event-on - 监听事件（暂存）
   注：此命令在脚本沙箱中更有意义，这里提供占位实现
   ═══════════════════════════════════════════════════════════════════════════ */

export const handleEventOn: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  const eventName = namedArgs.name || namedArgs.event || args[0];
  console.log(`[/event-on] 事件监听注册: ${eventName} (主应用侧不支持回调)`);
  return pipe;
};
