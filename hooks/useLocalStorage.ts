/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        useLocalStorage Hook                               ║
 * ║                                                                           ║
 * ║  类型安全的 localStorage 封装 - 自动序列化/反序列化                            ║
 * ║  支持：基本类型 | 对象 | 数组 | SSR 安全 | 默认值                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useEffect, useCallback } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
 * 类型定义
 * ───────────────────────────────────────────────────────────────────────────── */

type SetValue<T> = T | ((prevValue: T) => T);

interface UseLocalStorageOptions<T> {
  /** 序列化函数 (默认 JSON.stringify) */
  serializer?: (value: T) => string;
  /** 反序列化函数 (默认 JSON.parse) */
  deserializer?: (value: string) => T;
  /** 是否在初始化时立即读取 localStorage，禁用可避免 SSR Hydration 问题 */
  readOnInit?: boolean;
}

interface UseLocalStorageReturn<T> {
  /** 当前值 */
  value: T;
  /** 设置值 (支持函数式更新) */
  setValue: (value: SetValue<T>) => void;
  /** 删除存储 */
  remove: () => void;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 工具函数
 * ───────────────────────────────────────────────────────────────────────────── */

const isSSR = typeof window === "undefined";

/**
 * 安全读取 localStorage
 * 返回 null 表示未找到或解析失败
 */
const safeGetItem = <T>(
  key: string,
  deserializer: (value: string) => T,
): T | null => {
  if (isSSR) return null;

  try {
    const item = localStorage.getItem(key);
    return item !== null ? deserializer(item) : null;
  } catch {
    console.warn(`[useLocalStorage] 读取 "${key}" 失败`);
    return null;
  }
};

/**
 * 安全写入 localStorage
 */
const safeSetItem = <T>(
  key: string,
  value: T,
  serializer: (value: T) => string,
): boolean => {
  if (isSSR) return false;

  try {
    localStorage.setItem(key, serializer(value));
    return true;
  } catch {
    console.warn(`[useLocalStorage] 写入 "${key}" 失败`);
    return false;
  }
};

/**
 * 安全删除 localStorage
 */
const safeRemoveItem = (key: string): void => {
  if (isSSR) return;

  try {
    localStorage.removeItem(key);
  } catch {
    console.warn(`[useLocalStorage] 删除 "${key}" 失败`);
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
 * 主 Hook
 * ───────────────────────────────────────────────────────────────────────────── */

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options?: UseLocalStorageOptions<T>,
): UseLocalStorageReturn<T> {
  const serializer = options?.serializer ?? JSON.stringify;
  const deserializer = options?.deserializer ?? JSON.parse;
  const readOnInit = options?.readOnInit ?? true;

  /* ─── 惰性初始化状态 ─── */
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (!readOnInit) {
      return defaultValue;
    }
    const item = safeGetItem(key, deserializer);
    return item !== null ? item : defaultValue;
  });

  /* ─── SSR hydration 修复 ─── */
  useEffect(() => {
    const item = safeGetItem(key, deserializer);
    if (item !== null) {
      setStoredValue(item);
    }
  }, [key, deserializer]);

  /* ─── 设置值 ─── */
  const setValue = useCallback(
    (value: SetValue<T>) => {
      setStoredValue((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;
        safeSetItem(key, newValue, serializer);
        return newValue;
      });
    },
    [key, serializer],
  );

  /* ─── 删除存储 ─── */
  const remove = useCallback(() => {
    safeRemoveItem(key);
    setStoredValue(defaultValue);
  }, [key, defaultValue]);

  return { value: storedValue, setValue, remove };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 便捷变体 - 字符串专用 (避免 JSON 开销)
 * ───────────────────────────────────────────────────────────────────────────── */

export function useLocalStorageString(
  key: string,
  defaultValue: string = "",
): UseLocalStorageReturn<string> {
  return useLocalStorage(key, defaultValue, {
    serializer: (v) => v,
    deserializer: (v) => v,
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 便捷变体 - 布尔值专用
 * ───────────────────────────────────────────────────────────────────────────── */

export function useLocalStorageBoolean(
  key: string,
  defaultValue: boolean = false,
): UseLocalStorageReturn<boolean> {
  return useLocalStorage(key, defaultValue, {
    serializer: (v) => String(v),
    deserializer: (v) => v === "true",
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 便捷变体 - 数字专用
 * ───────────────────────────────────────────────────────────────────────────── */

export function useLocalStorageNumber(
  key: string,
  defaultValue: number = 0,
): UseLocalStorageReturn<number> {
  return useLocalStorage(key, defaultValue, {
    serializer: (v) => String(v),
    deserializer: (v) => {
      const num = Number(v);
      return isNaN(num) ? defaultValue : num;
    },
  });
}

export default useLocalStorage;
