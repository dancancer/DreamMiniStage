/**
 * Token 计数缓存测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  CachedTokenCounter,
  CL100KTokenCounter,
  createCachedTokenManager,
} from "../token-manager";

describe("CachedTokenCounter", () => {
  let counter: CachedTokenCounter;

  beforeEach(() => {
    counter = new CachedTokenCounter();
  });

  describe("基础功能", () => {
    it("应正确计算 token 数", () => {
      const text = "Hello, world! This is a test message.";
      const tokens = counter.count(text);
      expect(tokens).toBeGreaterThan(0);
    });

    it("短文本不应缓存", () => {
      const shortText = "Hi";
      counter.count(shortText);
      counter.count(shortText);
      const stats = counter.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it("长文本应被缓存", () => {
      const longText = "A".repeat(100);
      counter.count(longText);
      counter.count(longText);
      const stats = counter.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });

  describe("缓存命中", () => {
    it("相同文本应命中缓存", () => {
      const text = "This is a long enough text to be cached in the system.";

      const first = counter.count(text);
      const second = counter.count(text);

      expect(first).toBe(second);
      const stats = counter.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5);
    });

    it("不同文本不应命中缓存", () => {
      const text1 = "This is the first long text that should be cached.";
      const text2 = "This is the second long text that should be cached.";

      counter.count(text1);
      counter.count(text2);

      const stats = counter.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(2);
    });
  });

  describe("LRU 淘汰", () => {
    it("超出缓存大小时应淘汰最旧条目", () => {
      const smallCounter = new CachedTokenCounter(undefined, {
        maxCacheSize: 3,
        minCacheLength: 10,
      });

      const texts = [
        "Text number one for testing",
        "Text number two for testing",
        "Text number three for testing",
        "Text number four for testing",
      ];

      for (const text of texts) {
        smallCounter.count(text);
      }

      const stats = smallCounter.getStats();
      expect(stats.size).toBe(3);
    });
  });

  describe("countMessages", () => {
    it("应正确计算消息数组的 token", () => {
      const messages = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello, how are you today?" },
        { role: "assistant", content: "I am doing well, thank you for asking!" },
      ];

      const result = counter.countMessages(messages);

      expect(result.total).toBeGreaterThan(0);
      expect(result.byRole.system).toBeGreaterThan(0);
      expect(result.byRole.user).toBeGreaterThan(0);
      expect(result.byRole.assistant).toBeGreaterThan(0);
      expect(result.byMessage.length).toBe(3);
    });
  });

  describe("warmup", () => {
    it("应预热缓存", () => {
      const texts = [
        "First text for warmup that is definitely long enough to be cached by the system.",
        "Second text for warmup that is definitely long enough to be cached by the system.",
        "Third text for warmup that is definitely long enough to be cached by the system.",
      ];

      counter.warmup(texts);

      const stats = counter.getStats();
      expect(stats.size).toBe(3);
      expect(stats.misses).toBe(3);

      for (const text of texts) {
        counter.count(text);
      }

      const newStats = counter.getStats();
      expect(newStats.hits).toBe(3);
    });
  });

  describe("clearCache", () => {
    it("应清空缓存和统计", () => {
      const text = "A long text that will be cached in the system.";
      counter.count(text);
      counter.count(text);

      counter.clearCache();

      const stats = counter.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("与基础计数器一致性", () => {
    it("缓存计数器结果应与基础计数器一致", () => {
      const baseCounter = new CL100KTokenCounter();
      const cachedCounter = new CachedTokenCounter(baseCounter);

      const texts = [
        "Short",
        "A medium length text for testing purposes.",
        "A very long text that contains many words and should definitely be cached by the system for performance optimization purposes.",
        "中文文本测试，包含一些汉字来验证多语言支持。",
        "Mixed 混合 text テスト with multiple languages.",
      ];

      for (const text of texts) {
        const baseResult = baseCounter.count(text);
        const cachedResult = cachedCounter.count(text);
        expect(cachedResult).toBe(baseResult);
      }
    });
  });
});

describe("createCachedTokenManager", () => {
  it("应创建带缓存的 Token 管理器", () => {
    const manager = createCachedTokenManager({ maxContext: 8192 });

    const messages = [
      { role: "user", content: "Hello!" },
      { role: "assistant", content: "Hi there!" },
    ];

    const count = manager.countMessageTokens(messages);
    expect(count.total).toBeGreaterThan(0);
  });
});
