/**
 * @input  lib/models/world-book-model, lib/models/character-model
 * @output RawCharacterData, CharacterBookEntry, CharacterBook
 * @pos    原始角色数据模型,定义 PNG/JSON 导入的数据结构
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

/* ═══════════════════════════════════════════════════════════════════════════
   Raw Data Model - 原始角色数据类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

import { WorldBookEntry } from "@/lib/models/world-book-model";
import { TavernHelperScript } from "@/lib/models/character-model";

/**
 * 角色书条目 - 兼容不同来源的数据结构
 */
export interface CharacterBookEntry {
  comment: string;
  content: string;
  disable?: boolean;
  enabled?: boolean;
  position?: number;
  constant?: boolean;
  key?: string[];
  keys?: string[];
  order?: number;
  insertion_order?: number;
  depth?: number;
  extensions?: {
    position?: number;
    depth?: number;
    [key: string]: unknown;
  };
}

/**
 * 原始角色数据结构 - 从外部文件导入的格式
 */
export interface RawCharacterData {
  id: string | number;
  name: string;
  description: string;
  personality: string;
  first_mes: string;
  scenario: string;
  mes_example: string;
  creatorcomment: string;
  avatar: string;
  sample_status: string;
  data:{
    name: string;
    description: string;
    personality: string;
    first_mes: string;
    scenario: string;
    mes_example: string;
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    tags: string[];
    creator: string;
    character_version: string;
    alternate_greetings: string[];
    character_book:{
      entries: CharacterBookEntry[] | Record<string, WorldBookEntry>;
    },
    extensions?: {
      TavernHelper_scripts?: TavernHelperScript[];
      [key: string]: unknown;
    };
  },
}
