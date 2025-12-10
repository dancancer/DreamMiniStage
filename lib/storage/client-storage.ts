/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      Client Storage Convenience                          ║
 * ║  浏览器 localStorage 的安全封装：字符串 / JSON / 布尔值                        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

const canUseStorage = () => typeof window !== "undefined" && !!window.localStorage;

export const getString = (key: string, defaultValue = ""): string => {
  if (!canUseStorage()) return defaultValue;
  try {
    const value = window.localStorage.getItem(key);
    return value ?? defaultValue;
  } catch {
    return defaultValue;
  }
};

export const setString = (key: string, value: string): boolean => {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const removeItem = (key: string): void => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

export const getBoolean = (key: string, defaultValue = false): boolean => {
  const value = getString(key);
  if (!value) return defaultValue;
  return value === "true";
};

export const setBoolean = (key: string, value: boolean): boolean => {
  return setString(key, String(value));
};

export const getJSON = <T>(key: string, defaultValue: T): T => {
  if (!canUseStorage()) return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
};

export const setJSON = <T>(key: string, value: T): boolean => {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
