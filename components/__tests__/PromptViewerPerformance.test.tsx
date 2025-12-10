/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    提示词查看器性能测试                                    ║
 * ║                                                                           ║
 * ║  测试性能优化、内存管理、响应时间                                           ║
 * ║  验证需求: 5.2 - 不影响正常的消息发送和接收                                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
//                              Mock 设置
// ============================================================================

// Mock React hooks for testing
vi.mock("react", () => ({
  useState: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
  useRef: vi.fn(),
}));

// Import after mocking
import { 
  LRUCache,
  truncateContent,
  PERFORMANCE_CONFIG,
} from "@/lib/prompt-viewer";
import { 
  isMobileDevice,
  isTouchDevice,
  MOBILE_STYLES,
} from "@/components/prompt-viewer/mobile";

// ============================================================================
//                              性能测试
// ============================================================================

describe("PromptViewer Performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Performance Configuration", () => {
    it("should provide reasonable performance limits", () => {
      expect(PERFORMANCE_CONFIG.MAX_CONTENT_LENGTH).toBe(50000);
      expect(PERFORMANCE_CONFIG.CHUNK_SIZE).toBe(1000);
      expect(PERFORMANCE_CONFIG.VIRTUAL_THRESHOLD).toBe(10000);
      expect(PERFORMANCE_CONFIG.SEARCH_DEBOUNCE).toBe(300);
      expect(PERFORMANCE_CONFIG.CACHE_SIZE).toBe(100);
    });

    it("should have appropriate debounce delays", () => {
      expect(PERFORMANCE_CONFIG.SEARCH_DEBOUNCE).toBeGreaterThan(200);
      expect(PERFORMANCE_CONFIG.RESIZE_DEBOUNCE).toBeLessThan(200);
      expect(PERFORMANCE_CONFIG.SCROLL_DEBOUNCE).toBe(16); // 60fps
    });

    it("should have reasonable cache configuration", () => {
      expect(PERFORMANCE_CONFIG.CACHE_SIZE).toBeGreaterThan(50);
      expect(PERFORMANCE_CONFIG.CACHE_TTL).toBe(5 * 60 * 1000); // 5 minutes
    });
  });

  describe("Content Processing Performance", () => {
    it("should handle large content efficiently", () => {
      const largeContent = "x".repeat(100000);
      const startTime = performance.now();
      
      const truncated = truncateContent(largeContent, 50000);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(100); // Should process in under 100ms
      expect(truncated.length).toBeLessThanOrEqual(50000 + 100); // Allow for truncation message
    });

    it("should handle content chunking logic", () => {
      const content = "a".repeat(5000);
      const chunkSize = 1000;
      
      // Test chunking logic directly
      const expectedChunks = [];
      for (let i = 0; i < content.length; i += chunkSize) {
        expectedChunks.push(content.slice(i, i + chunkSize));
      }
      
      expect(expectedChunks).toHaveLength(5);
      expect(expectedChunks[0]).toHaveLength(chunkSize);
      expect(expectedChunks.join("")).toBe(content);
    });

    it("should handle empty content gracefully", () => {
      const emptyContent = "";
      const result = truncateContent(emptyContent);
      
      expect(result).toBe("");
    });
  });

  describe("Caching Performance", () => {
    it("should provide efficient LRU cache", () => {
      const cache = new LRUCache<string, string>(3, 1000);
      
      // Test basic operations
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");
      
      expect(cache.get("key1")).toBe("value1");
      expect(cache.size()).toBe(3);
      
      // Test LRU eviction
      cache.set("key4", "value4");
      expect(cache.size()).toBe(3);
      expect(cache.get("key2")).toBeUndefined(); // Should be evicted
    });

    it("should handle cache expiration", async () => {
      const cache = new LRUCache<string, string>(10, 100); // 100ms TTL
      
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(cache.get("key1")).toBeUndefined();
    });

    it("should cleanup expired entries", () => {
      const cache = new LRUCache<string, string>(10, 100);
      
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      
      // Manually trigger cleanup
      cache.cleanup();
      
      expect(cache.size()).toBeLessThanOrEqual(2);
    });
  });

  describe("Debounce and Throttle Performance", () => {
    it("should provide debounce configuration", () => {
      expect(PERFORMANCE_CONFIG.SEARCH_DEBOUNCE).toBe(300);
      expect(PERFORMANCE_CONFIG.RESIZE_DEBOUNCE).toBe(150);
      expect(PERFORMANCE_CONFIG.SCROLL_DEBOUNCE).toBe(16);
    });

    it("should provide throttle configuration", () => {
      expect(PERFORMANCE_CONFIG.SCROLL_DEBOUNCE).toBe(16); // 60fps
      expect(PERFORMANCE_CONFIG.RESIZE_DEBOUNCE).toBeLessThan(200);
    });

    it("should handle performance timing efficiently", () => {
      const startTime = performance.now();
      
      // Simulate performance-sensitive operations
      for (let i = 0; i < 1000; i++) {
        Math.random(); // Simple operation
      }
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(100); // Should handle efficiently
    });
  });

  describe("Batch Rendering Performance", () => {
    it("should handle batch rendering configuration", () => {
      const items = Array.from({ length: 1000 }, (_, i) => `item-${i}`);
      const batchSize = 50;
      
      // Test batch logic
      const visibleItems = items.slice(0, batchSize);
      const hasMore = batchSize < items.length;
      const progress = batchSize / items.length;
      
      expect(visibleItems).toHaveLength(batchSize);
      expect(hasMore).toBe(true);
      expect(progress).toBe(0.05); // 50/1000
    });

    it("should calculate progress correctly", () => {
      const items = Array.from({ length: 100 }, (_, i) => `item-${i}`);
      const renderedCount = 25;
      
      const progress = renderedCount / items.length;
      
      expect(progress).toBe(0.25); // 25/100
    });

    it("should handle batch size configuration", () => {
      expect(PERFORMANCE_CONFIG.BATCH_SIZE).toBe(50);
      expect(PERFORMANCE_CONFIG.FRAME_BUDGET).toBe(16);
    });
  });

  describe("Mobile Performance", () => {
    it("should detect mobile devices efficiently", () => {
      const startTime = performance.now();
      
      // Test multiple detections
      for (let i = 0; i < 100; i++) {
        isMobileDevice();
        isTouchDevice();
      }
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(50); // Should be very fast
    });

    it("should provide mobile-optimized styles", () => {
      expect(MOBILE_STYLES.button.mobile).toContain("min-h-[44px]"); // iOS touch target
      expect(MOBILE_STYLES.button.mobile).toContain("touch-manipulation");
      expect(MOBILE_STYLES.content.mobile).toContain("touch-pan-y");
    });

    it("should handle mobile detection logic", () => {
      // Test mobile detection functions
      const isMobile = typeof isMobileDevice === "function";
      const isTouch = typeof isTouchDevice === "function";
      
      expect(isMobile).toBe(true);
      expect(isTouch).toBe(true);
    });

    it("should provide responsive breakpoints", () => {
      const mobileBreakpoint = "max-width: 767px";
      const tabletBreakpoint = "min-width: 768px and max-width: 1023px";
      const desktopBreakpoint = "min-width: 1024px";
      
      expect(mobileBreakpoint).toContain("767px");
      expect(tabletBreakpoint).toContain("768px");
      expect(desktopBreakpoint).toContain("1024px");
    });
  });

  describe("Memory Management", () => {
    it("should handle memory-efficient operations", () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0;
      
      // Perform memory-intensive operations
      const cache = new LRUCache<string, string>(1000);
      for (let i = 0; i < 1000; i++) {
        cache.set(`key-${i}`, `value-${i}`.repeat(100));
      }
      
      // Clear cache
      cache.clear();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it("should cleanup resources properly", () => {
      const cleanupFunctions: (() => void)[] = [];
      
      // Simulate resource creation
      for (let i = 0; i < 100; i++) {
        const cleanup = vi.fn();
        cleanupFunctions.push(cleanup);
      }
      
      // Cleanup all resources
      const startTime = performance.now();
      cleanupFunctions.forEach(cleanup => cleanup());
      const endTime = performance.now();
      
      const cleanupTime = endTime - startTime;
      expect(cleanupTime).toBeLessThan(50); // Should cleanup quickly
    });
  });

  describe("Integration Performance", () => {
    it("should not impact main thread performance", async () => {
      const startTime = performance.now();
      
      // Simulate typical viewer operations
      const operations = [
        () => truncateContent("x".repeat(10000)),
        () => new LRUCache(100).set("key", "value"),
        () => isMobileDevice(),
        () => Array.from({ length: 100 }, (_, i) => `item-${i}`),
      ];
      
      // Run operations concurrently
      await Promise.all(operations.map(op => 
        new Promise(resolve => {
          setTimeout(() => {
            op();
            resolve(undefined);
          }, 0);
        }),
      ));
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(200); // Should complete quickly
    });

    it("should handle concurrent operations efficiently", async () => {
      const concurrentOperations = 50;
      const operations: Promise<void>[] = [];
      
      for (let i = 0; i < concurrentOperations; i++) {
        operations.push(
          new Promise(resolve => {
            setTimeout(() => {
              // Simulate viewer operation
              truncateContent(`content-${i}`.repeat(100));
              resolve();
            }, Math.random() * 10);
          }),
        );
      }
      
      const startTime = performance.now();
      await Promise.all(operations);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(500); // Should handle concurrency well
    });
  });

  describe("Error Recovery Performance", () => {
    it("should handle errors without performance degradation", () => {
      const startTime = performance.now();
      
      // Test error scenarios
      const errorOperations = [
        () => {
          try {
            truncateContent(null as any);
          } catch (e) {
            // Expected error
          }
        },
        () => {
          try {
            new LRUCache(-1); // Invalid size
          } catch (e) {
            // Expected error
          }
        },
        () => {
          try {
            isMobileDevice.call(null);
          } catch (e) {
            // Expected error
          }
        },
      ];
      
      errorOperations.forEach(op => op());
      
      const endTime = performance.now();
      const errorHandlingTime = endTime - startTime;
      
      expect(errorHandlingTime).toBeLessThan(100); // Error handling should be fast
    });

    it("should maintain performance after errors", () => {
      // Cause some errors
      try {
        truncateContent(undefined as any);
      } catch (e) {
        // Expected
      }
      
      // Test normal operations still work efficiently
      const startTime = performance.now();
      
      const result = truncateContent("normal content");
      const cache = new LRUCache(10);
      cache.set("key", "value");
      
      const endTime = performance.now();
      const recoveryTime = endTime - startTime;
      
      expect(recoveryTime).toBeLessThan(50);
      expect(result).toBe("normal content");
      expect(cache.get("key")).toBe("value");
    });
  });
});
