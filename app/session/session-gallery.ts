/**
 * @input  lib/slash-command/types
 * @output listSessionGalleryItems
 * @pos    /session 画廊宿主工具
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       Session Gallery Helpers                            ║
 * ║                                                                           ║
 * ║  收口 /session 当前最小可信画廊语义：先支持当前角色头像，未支持路径显式报错。 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { getBlob } from "@/lib/data/local-storage";
import type { ListGalleryOptions } from "@/lib/slash-command/types";

export interface SessionGalleryCharacter {
  id: string;
  name: string;
  avatarPath?: string;
  openingMessages?: Array<{ content: string }>;
  messages?: Array<{ content: string }>;
}

export interface SessionGalleryItem {
  src: string;
  ephemeral: boolean;
}

function matchesCurrentCharacter(
  character: SessionGalleryCharacter,
  target: string | undefined,
): boolean {
  if (!target?.trim()) {
    return true;
  }

  const normalized = target.trim().toLowerCase();
  return character.id.trim().toLowerCase() === normalized
    || character.name.trim().toLowerCase() === normalized;
}

const GALLERY_URL_PROTOCOLS = ["http://", "https://", "blob:", "data:"] as const;

function isDirectGalleryUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("/")
    || GALLERY_URL_PROTOCOLS.some((protocol) => normalized.startsWith(protocol));
}

async function resolveAvatarGalleryItem(avatarPath: string | undefined): Promise<SessionGalleryItem | null> {
  const normalized = avatarPath?.trim();
  if (!normalized) {
    return null;
  }

  if (isDirectGalleryUrl(normalized)) {
    return {
      src: normalized,
      ephemeral: false,
    };
  }

  const blob = await getBlob(normalized);
  if (!blob) {
    return null;
  }

  return {
    src: URL.createObjectURL(blob),
    ephemeral: true,
  };
}

export function listSessionGalleryItems(
  character: SessionGalleryCharacter,
  options?: ListGalleryOptions,
): Promise<SessionGalleryItem[]> {
  if (options?.group?.trim()) {
    return Promise.reject(new Error("/show-gallery group gallery is not available in /session yet"));
  }

  if (!matchesCurrentCharacter(character, options?.character)) {
    return Promise.resolve([]);
  }

  return (async () => {
    const items = new Map<string, SessionGalleryItem>();
    const avatarItem = await resolveAvatarGalleryItem(character.avatarPath);
    if (avatarItem) {
      items.set(avatarItem.src, avatarItem);
    }

    for (const opening of character.openingMessages || []) {
      for (const url of extractMessageImageUrls(opening.content)) {
        items.set(url, { src: url, ephemeral: false });
      }
    }

    for (const message of character.messages || []) {
      for (const url of extractMessageImageUrls(message.content)) {
        items.set(url, { src: url, ephemeral: false });
      }
    }

    return Array.from(items.values());
  })();
}

function extractMessageImageUrls(content: string): string[] {
  const urls = new Set<string>();
  const markdownMatches = content.matchAll(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/g);
  for (const match of markdownMatches) {
    if (match[1]) {
      urls.add(match[1]);
    }
  }

  const bareUrlMatches = content.matchAll(/https?:\/\/[^\s)]+?\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s)]*)?/gi);
  for (const match of bareUrlMatches) {
    if (match[0]) {
      urls.add(match[0]);
    }
  }

  return Array.from(urls);
}
