/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       useResponseLength Hook                              ║
 * ║                                                                           ║
 * ║  响应长度管理 - 基于 useLocalStorage 的简化实现                                ║
 * ║  配置项：min=100, max=5000, step=50, default=200                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback, useMemo } from "react";
import { useLocalStorageNumber } from "@/hooks/useLocalStorage";

/* ─────────────────────────────────────────────────────────────────────────────
 * 常量配置
 * ───────────────────────────────────────────────────────────────────────────── */

const STORAGE_KEY = "responseLength";
const DEFAULT_LENGTH = 200;
const MIN_LENGTH = 100;
const MAX_LENGTH = 5000;

/* ─────────────────────────────────────────────────────────────────────────────
 * 类型定义
 * ───────────────────────────────────────────────────────────────────────────── */

interface UseResponseLengthReturn {
  /** 当前响应长度 */
  length: number;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
  /** 百分比 (0-100) */
  percentage: number;
  /** 更新响应长度 */
  setLength: (value: number) => void;
  /** 处理滑块变化事件 */
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Hook 实现 - 使用 useLocalStorageNumber 简化
 * ───────────────────────────────────────────────────────────────────────────── */

export const useResponseLength = (): UseResponseLengthReturn => {
  const { value, setValue } = useLocalStorageNumber(STORAGE_KEY, DEFAULT_LENGTH);

  /* ─── clamp 到有效范围 ─── */
  const length = useMemo(
    () => Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, value)),
    [value],
  );

  /* ─── 设置并 clamp ─── */
  const setLength = useCallback(
    (val: number) => {
      setValue(Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, val)));
    },
    [setValue],
  );

  /* ─── 处理 input[range] 变化 ─── */
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setLength(parseInt(event.target.value, 10));
    },
    [setLength],
  );

  /* ─── 计算百分比 ─── */
  const percentage = ((length - MIN_LENGTH) / (MAX_LENGTH - MIN_LENGTH)) * 100;

  return {
    length,
    min: MIN_LENGTH,
    max: MAX_LENGTH,
    percentage,
    setLength,
    handleChange,
  };
};

export default useResponseLength;
