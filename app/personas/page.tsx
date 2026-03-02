/**
 * @input  react, lucide-react, next/image, app/i18n, components/ui/*, components/PersonaEditor, hooks/usePersonas, lib/models/persona-model
 * @output PersonasPage (default export)
 * @pos    页面组件 - 用户角色管理界面，支持 CRUD 和默认角色设置
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Personas 管理页面                                  ║
 * ║                                                                            ║
 * ║  独立的用户角色管理界面，支持创建、编辑、删除、设为默认等操作                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useState } from "react";
import { Plus, Star, Trash2, Edit2, Download, Upload, User } from "lucide-react";
import Image from "next/image";
import { useLanguage } from "@/app/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PersonaEditor, type PersonaFormData } from "@/components/PersonaEditor";
import { usePersonas } from "@/hooks/usePersonas";
import type { Persona } from "@/lib/models/persona-model";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   主页面组件
   ═══════════════════════════════════════════════════════════════════════════ */

export default function PersonasPage() {
  const { language } = useLanguage();
  const {
    personas,
    defaultPersona,
    activePersona,
    createPersona,
    updatePersona,
    deletePersona,
    setAsDefault,
    activatePersona,
    exportAll,
  } = usePersonas();

  /* ─────────────────────────────────────────────────────────────────────────
     本地状态
     ───────────────────────────────────────────────────────────────────────── */
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Persona | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /* ─────────────────────────────────────────────────────────────────────────
     事件处理
     ───────────────────────────────────────────────────────────────────────── */
  const handleCreate = () => {
    setEditingPersona(undefined);
    setIsEditorOpen(true);
  };

  const handleEdit = (persona: Persona) => {
    setEditingPersona(persona);
    setIsEditorOpen(true);
  };

  const handleSave = async (data: PersonaFormData) => {
    setIsSaving(true);
    try {
      if (editingPersona) {
        updatePersona(editingPersona.id, data);
      } else {
        const id = await createPersona({
          name: data.name,
          description: data.description,
          position: data.position,
          depth: data.depth,
          role: data.role,
        });
        if (data.avatarPath) {
          updatePersona(id, { avatarPath: data.avatarPath });
        }
      }
      setIsEditorOpen(false);
      setEditingPersona(undefined);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deletePersona(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const handleSetDefault = (persona: Persona) => {
    const isCurrentDefault = defaultPersona?.id === persona.id;
    setAsDefault(isCurrentDefault ? null : persona.id);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     渲染
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full">
      {/* ─── 页面头部 ─── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold">
            {language === "zh" ? "用户角色" : "Personas"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "zh"
              ? "管理你在对话中使用的身份"
              : "Manage your identities in conversations"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportAll}>
            <Download className="w-4 h-4 mr-2" />
            {language === "zh" ? "导出" : "Export"}
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            {language === "zh" ? "新建" : "New"}
          </Button>
        </div>
      </header>

      {/* ─── 内容区 ─── */}
      <main className="flex-1 overflow-y-auto p-6">
        {personas.length === 0 ? (
          <EmptyState onCreate={handleCreate} language={language} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {personas.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                isDefault={defaultPersona?.id === persona.id}
                isActive={activePersona?.id === persona.id}
                onEdit={() => handleEdit(persona)}
                onDelete={() => setDeleteTarget(persona)}
                onSetDefault={() => handleSetDefault(persona)}
                onActivate={() => activatePersona(persona.id)}
                language={language}
              />
            ))}
          </div>
        )}
      </main>

      {/* ─── 编辑器对话框 ─── */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPersona
                ? (language === "zh" ? "编辑用户角色" : "Edit Persona")
                : (language === "zh" ? "创建用户角色" : "Create Persona")}
            </DialogTitle>
          </DialogHeader>
          <PersonaEditor
            persona={editingPersona}
            onSave={handleSave}
            onCancel={() => {
              setIsEditorOpen(false);
              setEditingPersona(undefined);
            }}
            isSaving={isSaving}
          />
        </DialogContent>
      </Dialog>

      {/* ─── 删除确认 ─── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "zh" ? "确认删除" : "Confirm Delete"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "zh"
                ? `确定要删除 "${deleteTarget?.name}" 吗？此操作无法撤销。`
                : `Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === "zh" ? "取消" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              {language === "zh" ? "删除" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   空状态组件
   ═══════════════════════════════════════════════════════════════════════════ */

function EmptyState({
  onCreate,
  language,
}: {
  onCreate: () => void;
  language: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <User className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">
        {language === "zh" ? "还没有用户角色" : "No personas yet"}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        {language === "zh"
          ? "创建用户角色来定义你在对话中的身份，包括名称、描述和头像"
          : "Create personas to define your identity in conversations, including name, description and avatar"}
      </p>
      <Button onClick={onCreate}>
        <Plus className="w-4 h-4 mr-2" />
        {language === "zh" ? "创建第一个角色" : "Create your first persona"}
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   角色卡片组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface PersonaCardProps {
  persona: Persona;
  isDefault: boolean;
  isActive: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onActivate: () => void;
  language: string;
}

function PersonaCard({
  persona,
  isDefault,
  isActive,
  onEdit,
  onDelete,
  onSetDefault,
  onActivate,
  language,
}: PersonaCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-lg border p-4 transition-all cursor-pointer",
        isActive
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border hover:border-primary/50 hover:bg-accent/50",
      )}
      onClick={onActivate}
    >
      {/* ─── 头像和信息 ─── */}
      <div className="flex items-start gap-3">
        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-muted shrink-0">
          {persona.avatarPath ? (
            <Image
              src={persona.avatarPath}
              alt={persona.name}
              fill
              className="object-cover"
              sizes="48px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg font-medium text-muted-foreground">
              {persona.name.charAt(0).toUpperCase()}
            </div>
          )}
          {isDefault && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
              <Star className="w-3 h-3 text-white fill-white" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{persona.name}</h3>
            {isActive && (
              <span className="text-2xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {language === "zh" ? "当前" : "Active"}
              </span>
            )}
          </div>
          {persona.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {persona.description}
            </p>
          )}
        </div>
      </div>

      {/* ─── 操作按钮 ─── */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); onSetDefault(); }}
          title={isDefault
            ? (language === "zh" ? "取消默认" : "Unset default")
            : (language === "zh" ? "设为默认" : "Set as default")}
        >
          <Star className={cn("w-4 h-4", isDefault ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
        >
          <Edit2 className="w-4 h-4 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
