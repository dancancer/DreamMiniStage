/**
 * @input  none
 * @output registerIframeDispatcher, unregisterIframeDispatcher, dispatchToIframe
 * @pos    iframe 派发器注册表
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       Iframe Dispatcher Registry                          ║
 * ║                                                                           ║
 * ║  单一职责：管理 iframe 消息派发函数注册表                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

export type IframeDispatcher = (type: string, payload: unknown) => void;

const iframeDispatchers = new Map<string, IframeDispatcher>();

export function registerIframeDispatcher(iframeId: string, dispatcher: IframeDispatcher): void {
  iframeDispatchers.set(iframeId, dispatcher);
}

export function unregisterIframeDispatcher(iframeId: string): void {
  iframeDispatchers.delete(iframeId);
}

export function dispatchToIframe(iframeId: string, type: string, payload: unknown): void {
  const dispatcher = iframeDispatchers.get(iframeId);
  if (!dispatcher) {
    console.warn("[dispatchToIframe] No dispatcher for iframe:", iframeId);
    return;
  }
  dispatcher(type, payload);
}
