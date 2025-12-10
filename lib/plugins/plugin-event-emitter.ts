/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                       Plugin Event Emitter                                ║
 * ║                                                                          ║
 * ║  轻量级事件发射器，用于插件系统内部通信                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

type EventCallback = (data?: any) => void;

export class PluginEventEmitter {
  private listeners: Map<string, EventCallback[]> = new Map();

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;

    for (const callback of callbacks) {
      try {
        callback(data);
      } catch (error) {
        console.error(`❌ Error in event listener for ${event}:`, error);
      }
    }
  }

  off(event: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;

    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }
}
