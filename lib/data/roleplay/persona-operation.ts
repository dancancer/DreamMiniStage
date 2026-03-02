/**
 * @input  lib/models/persona-model
 * @output PersonaOperations
 * @pos    Persona 辅助操作层,提供头像转换、导入导出等功能(核心 CRUD 在 persona-store)
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        Persona Operations                                  ║
 * ║  Persona 辅助操作：头像处理、导入导出、批量操作                                ║
 * ║                                                                            ║
 * ║  注意：核心 CRUD 由 Zustand Store (persona-store.ts) 处理                   ║
 * ║  本文件提供头像转换、数据导入导出等辅助功能                                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { v4 as uuidv4 } from "uuid";
import type { Persona, PersonaConnection } from "@/lib/models/persona-model";
import { createDefaultPersona } from "@/lib/models/persona-model";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

/** Persona 导出格式 */
export interface PersonaExportData {
  version: number;
  exportedAt: string;
  personas: Persona[];
  connections: PersonaConnection[];
  defaultPersonaId: string | null;
}

/** 头像处理选项 */
export interface AvatarOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   头像处理
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 将 File 转换为 data URL
 *
 * @param file - 图片文件
 * @param options - 处理选项
 * @returns data URL 字符串
 */
export async function fileToDataUrl(
  file: File,
  options: AvatarOptions = {},
): Promise<string> {
  const { maxWidth = 256, maxHeight = 256, quality = 0.8 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 计算缩放比例
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // 使用 Canvas 压缩
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * 生成默认头像（带首字母）
 *
 * @param name - Persona 名称
 * @param backgroundColor - 背景色（可选）
 * @returns data URL 字符串
 */
export function generateDefaultAvatar(
  name: string,
  backgroundColor?: string,
): string {
  const initial = (name.charAt(0) || "?").toUpperCase();
  const bg = backgroundColor || generateColorFromString(name);

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // 绘制背景
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 128);

  // 绘制文字
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 64px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initial, 64, 64);

  return canvas.toDataURL("image/png");
}

/**
 * 从字符串生成一致的颜色
 */
function generateColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   导入导出
   ═══════════════════════════════════════════════════════════════════════════ */

const EXPORT_VERSION = 1;

/**
 * 导出 Persona 数据
 */
export function exportPersonas(
  personas: Record<string, Persona>,
  connections: PersonaConnection[],
  defaultPersonaId: string | null,
): PersonaExportData {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    personas: Object.values(personas),
    connections,
    defaultPersonaId,
  };
}

/**
 * 导入 Persona 数据
 *
 * @param data - 导入数据
 * @param mode - 导入模式：merge（合并）或 replace（替换）
 * @returns 处理后的数据
 */
export function importPersonas(
  data: PersonaExportData,
  mode: "merge" | "replace",
  existingPersonas: Record<string, Persona> = {},
): {
  personas: Record<string, Persona>;
  connections: PersonaConnection[];
  defaultPersonaId: string | null;
} {
  if (data.version !== EXPORT_VERSION) {
    console.warn(`Persona export version mismatch: expected ${EXPORT_VERSION}, got ${data.version}`);
  }

  if (mode === "replace") {
    const personas: Record<string, Persona> = {};
    for (const p of data.personas) {
      personas[p.id] = p;
    }
    return {
      personas,
      connections: data.connections,
      defaultPersonaId: data.defaultPersonaId,
    };
  }

  // merge 模式：合并数据，跳过已存在的 ID
  const personas = { ...existingPersonas };
  for (const p of data.personas) {
    if (!personas[p.id]) {
      personas[p.id] = p;
    }
  }

  return {
    personas,
    connections: data.connections,
    defaultPersonaId: data.defaultPersonaId,
  };
}

/**
 * 下载导出文件
 */
export function downloadExport(data: PersonaExportData, filename?: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `personas-export-${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════════════════════
   工具函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 验证 Persona 数据完整性
 */
export function validatePersona(persona: Partial<Persona>): boolean {
  return !!(
    persona.id &&
    typeof persona.name === "string" &&
    persona.name.trim().length > 0
  );
}

/**
 * 创建 Persona 的副本（新 ID）
 */
export function duplicatePersona(
  persona: Persona,
  nameSuffix: string = " (Copy)",
): Persona {
  const now = new Date().toISOString();
  return {
    ...persona,
    id: uuidv4(),
    name: persona.name + nameSuffix,
    createdAt: now,
    updatedAt: now,
  };
}
