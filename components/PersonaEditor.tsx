/**
 * @input  @/app, @/components, @/lib
 * @output PersonaEditor, PersonaFormData, PersonaEditor
 * @pos    人格编辑器组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        Persona Editor Component                           ║
 * ║                                                                            ║
 * ║  创建和编辑 Persona 的表单组件                                               ║
 * ║  支持头像上传、描述编辑、注入位置配置等功能                                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Upload, User, RefreshCw } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Persona } from "@/lib/models/persona-model";
import {
  PersonaDescriptionPosition,
  getPositionLabel,
  getPositionLabelZh,
} from "@/lib/models/persona-model";
import { fileToDataUrl, generateDefaultAvatar } from "@/lib/data/roleplay/persona-operation";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface PersonaEditorProps {
  /** 编辑模式：编辑现有 Persona */
  persona?: Persona;
  /** 保存回调 */
  onSave: (data: PersonaFormData) => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 是否正在保存 */
  isSaving?: boolean;
}

export interface PersonaFormData {
  name: string;
  description: string;
  avatarPath: string;
  position: PersonaDescriptionPosition;
  depth: number;
  role: "system" | "user";
}

/* ═══════════════════════════════════════════════════════════════════════════
   组件实现
   ═══════════════════════════════════════════════════════════════════════════ */

export const PersonaEditor: React.FC<PersonaEditorProps> = ({
  persona,
  onSave,
  onCancel,
  isSaving = false,
}) => {
  const { t, language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─────────────────────────────────────────────────────────────────────────
     表单状态
     ───────────────────────────────────────────────────────────────────────── */
  const [name, setName] = useState(persona?.name ?? "");
  const [description, setDescription] = useState(persona?.description ?? "");
  const [avatarPath, setAvatarPath] = useState(persona?.avatarPath ?? "");
  const [position, setPosition] = useState<PersonaDescriptionPosition>(
    persona?.position ?? PersonaDescriptionPosition.IN_PROMPT,
  );
  const [depth, setDepth] = useState(persona?.depth ?? 4);
  const [role, setRole] = useState<"system" | "user">(persona?.role ?? "system");

  const isEditMode = !!persona;

  /* ─────────────────────────────────────────────────────────────────────────
     头像处理
     ───────────────────────────────────────────────────────────────────────── */
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      setAvatarPath(dataUrl);
    } catch (error) {
      console.error("Failed to upload avatar:", error);
    }
  };

  const handleGenerateAvatar = () => {
    if (!name.trim()) return;
    const dataUrl = generateDefaultAvatar(name);
    setAvatarPath(dataUrl);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     提交处理
     ───────────────────────────────────────────────────────────────────────── */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // 如果没有头像，生成默认头像
    let finalAvatarPath = avatarPath;
    if (!finalAvatarPath && name.trim()) {
      finalAvatarPath = generateDefaultAvatar(name);
    }

    onSave({
      name: name.trim(),
      description,
      avatarPath: finalAvatarPath,
      position,
      depth,
      role,
    });
  };

  /* ─────────────────────────────────────────────────────────────────────────
     位置选项
     ───────────────────────────────────────────────────────────────────────── */
  const positionOptions = [
    { value: PersonaDescriptionPosition.IN_PROMPT, label: language === "zh" ? "提示词内 ({{persona}})" : "In Prompt ({{persona}})" },
    { value: PersonaDescriptionPosition.TOP_AN, label: language === "zh" ? "作者注释上方" : "Above Author's Note" },
    { value: PersonaDescriptionPosition.BOTTOM_AN, label: language === "zh" ? "作者注释下方" : "Below Author's Note" },
    { value: PersonaDescriptionPosition.AT_DEPTH, label: language === "zh" ? "指定深度" : "At Depth" },
    { value: PersonaDescriptionPosition.NONE, label: language === "zh" ? "不注入" : "Don't Inject" },
  ];

  /* ─────────────────────────────────────────────────────────────────────────
     渲染
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ─── 头像区域 ─── */}
      <div className="flex items-center gap-4">
        <div
          className="relative w-20 h-20 rounded-full overflow-hidden bg-muted cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          {avatarPath ? (
            <Image
              src={avatarPath}
              alt="Avatar"
              fill
              className="object-cover"
              sizes="80px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Upload className="w-6 h-6 text-white" />
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
          className="hidden"
        />

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            {language === "zh" ? "上传头像" : "Upload"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleGenerateAvatar}
            disabled={!name.trim()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {language === "zh" ? "生成默认" : "Generate"}
          </Button>
        </div>
      </div>

      {/* ─── 名称 ─── */}
      <div className="space-y-2">
        <Label htmlFor="name">
          {language === "zh" ? "名称" : "Name"} <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={language === "zh" ? "输入 Persona 名称" : "Enter persona name"}
          required
        />
      </div>

      {/* ─── 描述 ─── */}
      <div className="space-y-2">
        <Label htmlFor="description">
          {language === "zh" ? "描述" : "Description"}
        </Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={language === "zh"
            ? "描述你的 Persona（将通过 {{persona}} 宏或直接注入到提示词中）"
            : "Describe your persona (will be injected via {{persona}} macro or directly)"
          }
          rows={4}
        />
      </div>

      {/* ─── 高级设置 ─── */}
      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="font-medium text-sm">
          {language === "zh" ? "描述注入设置" : "Description Injection Settings"}
        </h4>

        {/* 注入位置 */}
        <div className="space-y-2">
          <Label>{language === "zh" ? "注入位置" : "Injection Position"}</Label>
          <Select
            value={String(position)}
            onValueChange={(v: string) => setPosition(Number(v) as PersonaDescriptionPosition)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {positionOptions.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 深度（仅 AT_DEPTH 时显示） */}
        {position === PersonaDescriptionPosition.AT_DEPTH && (
          <div className="space-y-2">
            <Label htmlFor="depth">{language === "zh" ? "深度" : "Depth"}</Label>
            <Input
              id="depth"
              type="number"
              min={0}
              max={100}
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              {language === "zh"
                ? "从对话底部计算的消息数量"
                : "Number of messages from the bottom of the chat"
              }
            </p>
          </div>
        )}

        {/* 消息角色 */}
        <div className="space-y-2">
          <Label>{language === "zh" ? "消息角色" : "Message Role"}</Label>
          <Select value={role} onValueChange={(v: string) => setRole(v as "system" | "user")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─── 操作按钮 ─── */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {language === "zh" ? "取消" : "Cancel"}
        </Button>
        <Button type="submit" disabled={!name.trim() || isSaving}>
          {isSaving
            ? (language === "zh" ? "保存中..." : "Saving...")
            : isEditMode
              ? (language === "zh" ? "保存" : "Save")
              : (language === "zh" ? "创建" : "Create")
          }
        </Button>
      </div>
    </form>
  );
};

export default PersonaEditor;
