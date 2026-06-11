/**
 * @input  @/lib/model-runtime
 * @output SamplingFields
 * @pos    会话设置 - 采样参数数字输入（留空=继承下层）
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

"use client";

import type { ModelAdvancedSettings } from "@/lib/model-runtime";

interface SamplingFieldDef {
  key: keyof Pick<ModelAdvancedSettings, "temperature" | "maxTokens" | "contextWindow" | "topP">;
  label: string;
  step: number;
  placeholder: string;
}

const FIELDS: SamplingFieldDef[] = [
  { key: "temperature", label: "温度", step: 0.05, placeholder: "继承" },
  { key: "maxTokens", label: "输出长度", step: 256, placeholder: "继承" },
  { key: "contextWindow", label: "上下文窗口", step: 1024, placeholder: "继承" },
  { key: "topP", label: "Top P", step: 0.05, placeholder: "继承" },
];

export function SamplingFields({
  scope,
  values,
  onChange,
}: {
  scope: "session" | "preset";
  values: Partial<ModelAdvancedSettings> | undefined;
  onChange: (patch: Partial<ModelAdvancedSettings>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {FIELDS.map((field) => (
        <div key={field.key}>
          <label className="mb-1 block text-xs font-medium text-foreground">{field.label}</label>
          <input
            type="number"
            step={field.step}
            // preset scope 下不预填具体值（避免误以为是会话覆盖）；session scope 显示当前覆盖值。
            defaultValue={scope === "session" ? numberValue(values?.[field.key]) : ""}
            placeholder={field.placeholder}
            className="w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-sm"
            onBlur={(event) => {
              const raw = event.target.value.trim();
              onChange({ [field.key]: raw === "" ? undefined : Number(raw) });
            }}
          />
        </div>
      ))}
    </div>
  );
}

function numberValue(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}
