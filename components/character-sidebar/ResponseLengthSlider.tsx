/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      Response Length Slider                               ║
 * ║                                                                           ║
 * ║  响应长度滑块 - 渐变填充 + 实时数值显示                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React from "react";

/* ─────────────────────────────────────────────────────────────────────────────
 * 类型定义
 * ───────────────────────────────────────────────────────────────────────────── */

interface ResponseLengthSliderProps {
  /** 当前值 */
  value: number;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
  /** 百分比 (0-100) */
  percentage: number;
  /** 变化回调 */
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** 字体类名 */
  fontClass?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 组件实现
 * ───────────────────────────────────────────────────────────────────────────── */

const ResponseLengthSlider: React.FC<ResponseLengthSliderProps> = ({
  value,
  min,
  max,
  percentage,
  onChange,
  fontClass = "",
}) => {
  return (
    <div className="px-2 py-2">
      {/* 滑块轨道 */}
      <div className="relative py-3 px-1">
        <div className="absolute inset-0 flex items-center">
          <div className="h-1.5 w-full bg-input rounded-full" />
        </div>
        {/* 填充区域 + 隐藏的原生滑块 */}
        <div className="relative w-full h-1.5 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-200"
            style={{
              width: `${percentage}%`,
              clipPath: "polygon(0 100%, calc(100% - 5px) 100%, 100% 0, 5px 0, 0 100%)",
            }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step="50"
            value={value}
            onChange={onChange}
            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>

      {/* 数值显示 */}
      <div className="flex justify-between mt-3 px-0.5">
        <span className={`text-2xs md:text-xs font-medium ${fontClass} text-slate-400`}>
          {min}
        </span>
        <div className="flex items-center">
          <span className="text-2xs md:text-xs font-medium ">
            {value}
          </span>
          <span className="text-2xs md:text-xs font-medium text-slate-400 ml-1">
            / {max}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ResponseLengthSlider;
