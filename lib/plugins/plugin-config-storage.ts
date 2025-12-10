/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      Plugin Config Storage                                ║
 * ║                                                                          ║
 * ║  插件配置存储工具：localStorage 封装                                        ║
 * ║  从 plugin-registry.ts 提取                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

const STORAGE_KEY = "enhanced-plugin-config";

/* ═══════════════════════════════════════════════════════════════════════════
   配置存储对象
   ═══════════════════════════════════════════════════════════════════════════ */

export const pluginConfigStorage = {
  /**
   * 获取配置
   */
  get(): Record<string, any> {
    try {
      const config = localStorage.getItem(STORAGE_KEY);
      return config ? JSON.parse(config) : {};
    } catch (error) {
      console.error("❌ Failed to load plugin configuration:", error);
      return {};
    }
  },

  /**
   * 设置配置
   */
  set(config: Record<string, any>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error("❌ Failed to save plugin configuration:", error);
    }
  },

  /**
   * 更新配置（合并）
   */
  update(updates: Record<string, any>): void {
    const config = this.get();
    Object.assign(config, updates);
    this.set(config);
  },
};
