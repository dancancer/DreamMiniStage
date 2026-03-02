import { WorldBookEntry } from "@/lib/models/world-book-model";
import { DialogueMessage } from "@/lib/models/character-dialogue-model";

export interface WorldBookJson {
  entries: Record<string, WorldBookEntry> | WorldBookEntry[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   Position 常量定义

   SillyTavern 世界书位置语义（world_info_position）：
   - 0: before      (故事字符串之前，wiBefore)
   - 1: after       (故事字符串之后，wiAfter)
   - 2: ANTop       (作者笔记之前)
   - 3: ANBottom    (作者笔记之后)
   - 4: atDepth     (在对话深度处注入，默认)
   - 5: EMTop       (示例之前)
   - 6: EMBottom    (示例之后)
   - 7: outlet      (自定义出口)

   旧版别名映射：
   - before_char → 0
   - after_char  → 2 (历史原因，映射到 ANTop)
   ═══════════════════════════════════════════════════════════════════════════ */

const POSITION_MAP: Record<string, number> = {
  // Position 0: wiBefore
  before: 0,
  before_char: 0,
  // Position 1: wiAfter
  after: 1,
  // Position 2: ANTop (历史上 after_char 映射到这里)
  antop: 2,
  an_top: 2,
  after_char: 2,
  // Position 3: ANBottom
  anbottom: 3,
  an_bottom: 3,
  // Position 4: atDepth (默认)
  atdepth: 4,
  at_depth: 4,
  // Position 5: EMTop
  emtop: 5,
  em_top: 5,
  // Position 6: EMBottom
  embottom: 6,
  em_bottom: 6,
};

const DEFAULT_POSITION = 4;

export class WorldBookManager {
  /* ═══════════════════════════════════════════════════════════════════════════
     位置解析：兼容 SillyTavern 多种格式

     支持：数字、字符串 (before_char/after_char)、extensions.position
     使用 as 断言访问 extensions：
     - entry 类型定义中 extensions 是可选的
     - 这里安全访问其嵌套属性
     设计理念：在明确知道结构的地方使用断言，而非放弃类型检查
     ═══════════════════════════════════════════════════════════════════════════ */
  static normalizePosition(entry: WorldBookEntry): number {
    const raw = entry.position ?? (entry.extensions as Record<string, unknown> | undefined)?.position;

    // 数字类型：直接返回
    if (typeof raw === "number") {
      return raw;
    }

    // 字符串类型：映射或解析
    if (typeof raw === "string") {
      if (raw in POSITION_MAP) {
        return POSITION_MAP[raw];
      }
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    // Fallback: extensions.position（数字类型）
    const extPos = (entry.extensions as Record<string, unknown> | undefined)?.position;
    if (typeof extPos === "number") {
      return extPos;
    }

    return DEFAULT_POSITION;
  }

  static getMatchingEntries(
    worldBook: WorldBookEntry[] | Record<string, WorldBookEntry> | undefined,
    message: string,
    chatHistory: DialogueMessage[],
    options: {
      contextWindow?: number;
    } = {},
  ): WorldBookEntry[] {
    if (!worldBook) return [];
    
    const { contextWindow = 5 } = options;

    const recentMessages = chatHistory
      .slice(-contextWindow)
      .map(m => m.content)
      .join(" ");
    
    const fullText = `${recentMessages} ${message}`.toLowerCase();

    const entries = Array.isArray(worldBook) 
      ? worldBook 
      : Object.values(worldBook);

    /* ═══════════════════════════════════════════════════════════════════════════
       过滤禁用条目

       SillyTavern 行为：
       - enabled: false 的条目不参与匹配
       - selective: false 的条目不参与匹配
       ═══════════════════════════════════════════════════════════════════════════ */
    const enabledEntries = entries.filter(entry =>
      entry.enabled !== false && entry.selective !== false,
    );

    const constantEntries = enabledEntries.filter(entry => entry.constant);

    const matchedEntries = enabledEntries
      .filter(entry => {
        if (entry.constant) return false;
        if (!entry.keys || entry.keys.length === 0) return false;
        return entry.keys.some(key => fullText.includes(key.toLowerCase()));
      });

    return [...constantEntries, ...matchedEntries];
  }
  
  /* ═══════════════════════════════════════════════════════════════════════════
     规范化世界书条目结构

     worldBook 参数：使用 unknown 替代 any
     - 输入可能来自用户上传、API 响应等不可控源
     - 内部通过类型守卫和断言安全解析
     设计理念：输入边界用 unknown，内部逻辑负责结构化
     ═══════════════════════════════════════════════════════════════════════════ */
  static normalizeWorldBookEntries(worldBook: unknown): WorldBookEntry[] {
    if (!worldBook) return [];

    if (Array.isArray(worldBook)) {
      return worldBook;
    }

    // 类型守卫：确保是对象
    if (typeof worldBook !== "object" || worldBook === null) {
      return [];
    }

    const wbObj = worldBook as Record<string, unknown>;

    if (wbObj.entries) {
      if (Array.isArray(wbObj.entries)) {
        return wbObj.entries;
      } else {
        return Object.values(wbObj.entries as Record<string, WorldBookEntry>);
      }
    }
    
    return Object.values(worldBook);
  }
  
  static organizeEntriesByPosition(
    entries: WorldBookEntry[],
  ): Record<number, WorldBookEntry[]> {
    const positionGroups: Record<number, WorldBookEntry[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
    };

    for (const entry of entries) {
      const position = this.normalizePosition(entry);

      if (position >= 0 && position <= 4) {
        positionGroups[position].push(entry);
      } else {
        positionGroups[4].push(entry);
      }
    }

    for (const position in positionGroups) {
      positionGroups[Number(position)].sort((a, b) => {
        const insertionOrderDiff = (b.insertion_order || 0) - (a.insertion_order || 0);
        if (insertionOrderDiff !== 0) return insertionOrderDiff;
        return (b.insertion_order || 0) - (a.insertion_order || 0);
      });
    }

    return positionGroups;
  }
}
