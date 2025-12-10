/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                     Save As Global Checkbox                               ║
 * ║                                                                          ║
 * ║  保存为全局资源选项组件                                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import { Check } from "lucide-react";

interface SaveAsGlobalCheckboxProps {
  checked: boolean;
  label: string;
  serifFontClass: string;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
}

export function SaveAsGlobalCheckbox({ checked, label, serifFontClass, onChange, children }: SaveAsGlobalCheckboxProps) {
  return (
    <div className="bg-gradient-to-br from-muted-surface/60 via-deep/40 to-muted-surface/60 backdrop-blur-sm border border-border/40 rounded-md p-3">
      <label className="flex items-center space-x-2 cursor-pointer group">
        <div className="relative">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only"
          />
          <div className={`w-4 h-4 rounded border-2 transition-all duration-300 ${
            checked
              ? "bg-gradient-to-br from-primary-500 to-primary-600 border-primary-500  shadow-primary-500/30"
              : "border-border group-hover:border-border"
          }`}>
            {checked && <Check className="absolute inset-0 h-3 w-3 text-white" strokeWidth={3} />}
          </div>
        </div>
        <span className={"text-cream-soft text-sm font-medium "}>{label}</span>
      </label>

      {checked && children && (
        <div className="mt-2 animate-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   全局资源表单字段
   ═══════════════════════════════════════════════════════════════════════════ */

interface GlobalFormFieldsProps {
  name: string;
  description: string;
  nameLabel: string;
  namePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  serifFontClass: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export function GlobalFormFields({
  name,
  description,
  nameLabel,
  namePlaceholder,
  descriptionLabel,
  descriptionPlaceholder,
  serifFontClass,
  onNameChange,
  onDescriptionChange,
}: GlobalFormFieldsProps) {
  return (
    <div className="space-y-2">
      <div>
        <label className={"block text-xs font-medium text-ink-soft mb-1 "}>{nameLabel}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={namePlaceholder}
          className="w-full px-2 py-1.5 text-sm /60 backdrop-blur-sm border border-border/60 rounded-md text-cream-soft placeholder-ink-soft/60 focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-300"
        />
      </div>
      <div>
        <label className={"block text-xs font-medium text-ink-soft mb-1 "}>{descriptionLabel}</label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={descriptionPlaceholder}
          rows={2}
          className="w-full px-2 py-1.5 text-sm /60 backdrop-blur-sm border border-border/60 rounded-md text-cream-soft placeholder-ink-soft/60 focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none transition-all duration-300"
        />
      </div>
    </div>
  );
}
