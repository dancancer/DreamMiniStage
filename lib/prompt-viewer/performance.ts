/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    提示词查看器性能优化                                    ║
 * ║                                                                           ║
 * ║  内容虚拟化、防抖处理、内存管理、渲染优化                                   ║
 * ║  设计原则：最小化主线程阻塞、优化内存使用、提升用户体验                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { useCallback, useMemo, useRef, useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   性能配置常量
   ═══════════════════════════════════════════════════════════════════════════ */

export const PERFORMANCE_CONFIG = {
  // 内容处理限制
  MAX_CONTENT_LENGTH: 50000, // 最大内容长度
  CHUNK_SIZE: 1000, // 分块处理大小
  VIRTUAL_THRESHOLD: 10000, // 虚拟化阈值
  
  // 防抖延迟
  SEARCH_DEBOUNCE: 300, // 搜索防抖延迟
  RESIZE_DEBOUNCE: 150, // 窗口调整防抖延迟
  SCROLL_DEBOUNCE: 16, // 滚动防抖延迟（60fps）
  
  // 缓存配置
  CACHE_SIZE: 100, // 最大缓存条目数
  CACHE_TTL: 5 * 60 * 1000, // 缓存生存时间（5分钟）
  
  // 渲染优化
  BATCH_SIZE: 50, // 批量渲染大小
  FRAME_BUDGET: 16, // 每帧时间预算（ms）
  IDLE_TIMEOUT: 5000, // 空闲超时（ms）
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   防抖 Hook
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 防抖 Hook - 延迟执行函数调用
 */
export function useDebounce<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number,
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // 更新回调引用
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay],
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   节流 Hook
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 节流 Hook - 限制函数调用频率
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number,
): T {
  const lastCallRef = useRef<number>(0);
  const callbackRef = useRef(callback);

  // 更新回调引用
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastCallRef.current >= delay) {
        lastCallRef.current = now;
        callbackRef.current(...args);
      }
    }) as T,
    [delay],
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   内容分块处理
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 内容分块处理 - 将大内容分块处理，避免阻塞主线程
 */
export function useContentChunking(
  content: string,
  chunkSize: number = PERFORMANCE_CONFIG.CHUNK_SIZE,
) {
  return useMemo(() => {
    if (!content || content.length <= chunkSize) {
      return [content];
    }

    const chunks: string[] = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize));
    }

    return chunks;
  }, [content, chunkSize]);
}

/* ═══════════════════════════════════════════════════════════════════════════
   虚拟化滚动
   ═══════════════════════════════════════════════════════════════════════════ */

interface VirtualizationConfig {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

/**
 * 虚拟化滚动 Hook - 只渲染可见区域的内容
 */
export function useVirtualization(
  items: readonly string[],
  config: VirtualizationConfig,
) {
  const { itemHeight, containerHeight, overscan = 5 } = config;
  
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleRange = useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      startIndex + visibleCount + overscan * 2,
    );
    
    return { startIndex, endIndex, visibleCount };
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [items, visibleRange.startIndex, visibleRange.endIndex]);

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.startIndex * itemHeight;

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    visibleRange,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   内存管理
   ═══════════════════════════════════════════════════════════════════════════ */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

/**
 * LRU 缓存实现
 */
export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private maxSize: number;
  private ttl: number;

  constructor(
    maxSize: number = PERFORMANCE_CONFIG.CACHE_SIZE,
    ttl: number = PERFORMANCE_CONFIG.CACHE_TTL,
  ) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // 更新访问计数和时间戳
    entry.accessCount++;
    entry.timestamp = Date.now();

    // 移到最后（LRU）
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: K, value: V): void {
    // 如果已存在，更新值
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.value = value;
      entry.timestamp = Date.now();
      entry.accessCount++;
      
      // 移到最后
      this.cache.delete(key);
      this.cache.set(key, entry);
      return;
    }

    // 检查缓存大小限制
    if (this.cache.size >= this.maxSize) {
      // 删除最少使用的条目
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    // 添加新条目
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 1,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // 清理过期条目
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   缓存 Hook
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 缓存 Hook - 缓存计算结果
 */
export function useCache<K, V>(
  maxSize?: number,
  ttl?: number,
): [LRUCache<K, V>, () => void] {
  const cacheRef = useRef<LRUCache<K, V> | null>(null);
  
  if (!cacheRef.current) {
    cacheRef.current = new LRUCache<K, V>(maxSize, ttl);
  }

  const clearCache = useCallback(() => {
    cacheRef.current?.clear();
  }, []);

  // 定期清理过期条目
  useEffect(() => {
    const interval = setInterval(() => {
      cacheRef.current?.cleanup();
    }, PERFORMANCE_CONFIG.CACHE_TTL / 2);

    return () => clearInterval(interval);
  }, []);

  return [cacheRef.current, clearCache];
}

/* ═══════════════════════════════════════════════════════════════════════════
   渲染优化
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 批量渲染 Hook - 分批渲染大量内容
 */
export function useBatchRender<T>(
  items: readonly T[],
  batchSize: number = PERFORMANCE_CONFIG.BATCH_SIZE,
) {
  const [renderedCount, setRenderedCount] = useState(batchSize);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const visibleItems = useMemo(() => {
    return items.slice(0, renderedCount);
  }, [items, renderedCount]);

  const hasMore = renderedCount < items.length;

  const loadMore = useCallback(() => {
    if (hasMore && !timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        setRenderedCount(prev => Math.min(prev + batchSize, items.length));
        timeoutRef.current = null;
      }, 0);
    }
  }, [hasMore, batchSize, items.length]);

  // 重置渲染计数当 items 改变时
  useEffect(() => {
    setRenderedCount(Math.min(batchSize, items.length));
  }, [items, batchSize]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    visibleItems,
    hasMore,
    loadMore,
    progress: items.length > 0 ? renderedCount / items.length : 1,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   空闲时间处理
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 空闲时间处理 Hook - 在浏览器空闲时执行任务
 */
export function useIdleCallback(
  callback: () => void,
  deps: React.DependencyList,
  timeout: number = PERFORMANCE_CONFIG.IDLE_TIMEOUT,
) {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 更新回调引用
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const scheduleCallback = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(
          () => {
            callbackRef.current();
          },
          { timeout },
        );
      } else {
        // 降级到 setTimeout
        timeoutRef.current = setTimeout(() => {
          callbackRef.current();
        }, 0);
      }
    };

    scheduleCallback();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, timeout]);
}

/* ═══════════════════════════════════════════════════════════════════════════
   性能监控
   ═══════════════════════════════════════════════════════════════════════════ */

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  frameRate: number;
}

/**
 * 性能监控 Hook
 */
export function usePerformanceMonitor(): PerformanceMetrics {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    frameRate: 60,
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    let animationId: number;

    const measurePerformance = () => {
      const now = performance.now();
      frameCountRef.current++;

      // 每秒更新一次指标
      if (now - lastTimeRef.current >= 1000) {
        const frameRate = (frameCountRef.current * 1000) / (now - lastTimeRef.current);
        
        setMetrics(prev => ({
          ...prev,
          frameRate: Math.round(frameRate),
        }));

        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      animationId = requestAnimationFrame(measurePerformance);
    };

    animationId = requestAnimationFrame(measurePerformance);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  return metrics;
}

/* ═══════════════════════════════════════════════════════════════════════════
   内容截断工具
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 智能内容截断 - 保留重要信息的同时减少内容长度
 */
export function truncateContent(
  content: string,
  maxLength: number = PERFORMANCE_CONFIG.MAX_CONTENT_LENGTH,
): string {
  if (content.length <= maxLength) {
    return content;
  }

  // 尝试在合适的位置截断（行尾、段落等）
  const truncatePoint = Math.floor(maxLength * 0.8);
  const searchRange = content.slice(truncatePoint, maxLength);
  
  // 查找合适的截断点
  const breakPoints = ["\n\n", "\n", ". ", "。", "！", "？"];
  
  for (const breakPoint of breakPoints) {
    const index = searchRange.lastIndexOf(breakPoint);
    if (index !== -1) {
      const finalLength = truncatePoint + index + breakPoint.length;
      return content.slice(0, finalLength) + "\n\n[内容已截断，显示前 " + finalLength + " 个字符]";
    }
  }

  // 如果找不到合适的截断点，直接截断
  return content.slice(0, maxLength) + "\n\n[内容已截断]";
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出工具函数
   ═══════════════════════════════════════════════════════════════════════════ */

export const performanceUtils = {
  truncateContent,
  LRUCache,
  PERFORMANCE_CONFIG,
} as const;
