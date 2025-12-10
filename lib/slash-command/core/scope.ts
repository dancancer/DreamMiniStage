/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          Slash Command 作用域                              ║
 * ║                                                                           ║
 * ║  链式作用域，支持局部覆盖与冒泡查找                                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

export class ScopeFrame {
  private readonly store = new Map<string, unknown>();
  constructor(public readonly parent?: ScopeFrame) {}

  hasLocal(key: string): boolean {
    return this.store.has(key);
  }

  get(key: string): unknown {
    if (this.store.has(key)) return this.store.get(key);
    return this.parent?.get(key);
  }

  setLocal(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  delete(key: string): boolean {
    if (this.store.delete(key)) return true;
    if (this.parent) return this.parent.delete(key);
    return false;
  }
}

export class ScopeChain {
  private current: ScopeFrame;

  constructor(root?: ScopeFrame) {
    this.current = root ?? new ScopeFrame();
  }

  push(): void {
    this.current = new ScopeFrame(this.current);
  }

  pop(): void {
    if (this.current.parent) {
      this.current = this.current.parent;
    }
  }

  get(key: string): unknown {
    return this.current.get(key);
  }

  set(key: string, value: unknown): void {
    const frame = this.findFrame(key);
    if (frame) {
      frame.setLocal(key, value);
      return;
    }
    this.current.setLocal(key, value);
  }

  delete(key: string): boolean {
    return this.current.delete(key);
  }

  setLocal(key: string, value: unknown): void {
    this.current.setLocal(key, value);
  }

  private findFrame(key: string): ScopeFrame | undefined {
    let frame: ScopeFrame | undefined = this.current;
    while (frame) {
      if (frame.hasLocal(key)) return frame;
      frame = frame.parent;
    }
    return undefined;
  }
}
