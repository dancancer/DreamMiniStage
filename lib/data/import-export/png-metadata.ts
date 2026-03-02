/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         PNG Metadata Reader/Writer                        ║
 * ║                                                                           ║
 * ║  读写 PNG 文件的 tEXt 块，用于角色卡元数据导入/导出                           ║
 * ║  SillyTavern 兼容格式：chara 字段包含 base64 编码的角色数据                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              类型定义
// ============================================================================

export interface CharacterCardV2 {
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: {
    name: string;
    description: string;
    personality?: string;
    scenario?: string;
    first_mes?: string;
    mes_example?: string;
    creator_notes?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings?: string[];
    tags?: string[];
    creator?: string;
    character_version?: string;
    extensions?: Record<string, unknown>;
  };
}

export interface PngMetadataResult {
  success: boolean;
  data?: CharacterCardV2;
  error?: string;
  rawText?: string;
}

// ============================================================================
//                              PNG 块解析
// ============================================================================

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * 从 PNG 文件中提取 tEXt 块
 */
export async function extractPngText(file: File | Blob): Promise<Map<string, string>> {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);
  const texts = new Map<string, string>();

  // 验证 PNG 签名
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (data[i] !== PNG_SIGNATURE[i]) {
      throw new Error("Invalid PNG signature");
    }
  }

  let offset = 8;
  while (offset < data.length) {
    const length = readUint32BE(data, offset);
    const type = readChunkType(data, offset + 4);

    if (type === "tEXt" || type === "iTXt") {
      const chunkData = data.slice(offset + 8, offset + 8 + length);
      const { key, value } = parseTextChunk(chunkData, type === "iTXt");
      texts.set(key, value);
    }

    if (type === "IEND") break;
    offset += 12 + length;
  }

  return texts;
}

/**
 * 从 PNG 提取角色卡数据
 */
export async function extractCharacterCard(file: File | Blob): Promise<PngMetadataResult> {
  try {
    const texts = await extractPngText(file);
    const charaText = texts.get("chara");

    if (!charaText) {
      return { success: false, error: "No chara metadata found in PNG" };
    }

    const decoded = atob(charaText);
    const cardData = JSON.parse(decoded) as Record<string, unknown>;

    // 检查是否为 V2 格式
    if (cardData.spec !== "chara_card_v2") {
      return { success: true, data: upgradeToV2(cardData), rawText: charaText };
    }

    return { success: true, data: cardData as unknown as CharacterCardV2, rawText: charaText };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to extract character card: ${message}` };
  }
}

/**
 * 将角色卡数据写入 PNG
 * 返回新的 PNG Blob
 */
export async function embedCharacterCard(
  file: File | Blob,
  card: CharacterCardV2,
): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  // 验证 PNG 签名
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (data[i] !== PNG_SIGNATURE[i]) {
      throw new Error("Invalid PNG signature");
    }
  }

  // 编码角色卡数据
  const cardJson = JSON.stringify(card);
  const cardBase64 = btoa(cardJson);
  const textChunk = createTextChunk("chara", cardBase64);

  // 找到 IEND 块位置
  let iendOffset = -1;
  let offset = 8;
  while (offset < data.length) {
    const length = readUint32BE(data, offset);
    const type = readChunkType(data, offset + 4);

    if (type === "IEND") {
      iendOffset = offset;
      break;
    }

    offset += 12 + length;
  }

  if (iendOffset === -1) {
    throw new Error("Invalid PNG: IEND chunk not found");
  }

  // 组装新的 PNG
  const beforeIend = data.slice(0, iendOffset);
  const iendChunk = data.slice(iendOffset);

  const result = new Uint8Array(beforeIend.length + textChunk.length + iendChunk.length);
  result.set(beforeIend, 0);
  result.set(textChunk, beforeIend.length);
  result.set(iendChunk, beforeIend.length + textChunk.length);

  return new Blob([result], { type: "image/png" });
}

// ============================================================================
//                              辅助函数
// ============================================================================

function readUint32BE(data: Uint8Array, offset: number): number {
  return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
}

function readChunkType(data: Uint8Array, offset: number): string {
  return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}

function parseTextChunk(data: Uint8Array, isITXt: boolean): { key: string; value: string } {
  const nullIndex = data.indexOf(0);
  const key = new TextDecoder().decode(data.slice(0, nullIndex));

  if (isITXt) {
    // iTXt 格式：key\0compression\0method\0language\0translated\0text
    let valueStart = nullIndex + 1;
    for (let i = 0; i < 4; i++) {
      const nextNull = data.indexOf(0, valueStart);
      valueStart = nextNull + 1;
    }
    const value = new TextDecoder().decode(data.slice(valueStart));
    return { key, value };
  }

  const value = new TextDecoder("latin1").decode(data.slice(nullIndex + 1));
  return { key, value };
}

function createTextChunk(key: string, value: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key);
  const valueBytes = new TextEncoder().encode(value);

  const chunkData = new Uint8Array(keyBytes.length + 1 + valueBytes.length);
  chunkData.set(keyBytes, 0);
  chunkData[keyBytes.length] = 0;
  chunkData.set(valueBytes, keyBytes.length + 1);

  const length = chunkData.length;
  const type = new TextEncoder().encode("tEXt");
  const chunk = new Uint8Array(12 + length);

  // 长度（4字节）
  chunk[0] = (length >> 24) & 0xff;
  chunk[1] = (length >> 16) & 0xff;
  chunk[2] = (length >> 8) & 0xff;
  chunk[3] = length & 0xff;

  // 类型（4字节）
  chunk.set(type, 4);

  // 数据
  chunk.set(chunkData, 8);

  // CRC（4字节）
  const crc = crc32(chunk.slice(4, 8 + length));
  chunk[8 + length] = (crc >> 24) & 0xff;
  chunk[9 + length] = (crc >> 16) & 0xff;
  chunk[10 + length] = (crc >> 8) & 0xff;
  chunk[11 + length] = crc & 0xff;

  return chunk;
}

// CRC32 查找表
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function upgradeToV2(oldCard: Record<string, unknown>): CharacterCardV2 {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: String(oldCard.name || oldCard.char_name || "Unknown"),
      description: String(oldCard.description || oldCard.char_persona || ""),
      personality: String(oldCard.personality || ""),
      scenario: String(oldCard.scenario || oldCard.world_scenario || ""),
      first_mes: String(oldCard.first_mes || oldCard.char_greeting || ""),
      mes_example: String(oldCard.mes_example || oldCard.example_dialogue || ""),
      creator_notes: String(oldCard.creator_notes || ""),
      system_prompt: String(oldCard.system_prompt || ""),
      post_history_instructions: String(oldCard.post_history_instructions || ""),
      alternate_greetings: Array.isArray(oldCard.alternate_greetings) ? oldCard.alternate_greetings : [],
      tags: Array.isArray(oldCard.tags) ? oldCard.tags : [],
      creator: String(oldCard.creator || ""),
      character_version: String(oldCard.character_version || ""),
      extensions: typeof oldCard.extensions === "object" ? (oldCard.extensions as Record<string, unknown>) : {},
    },
  };
}
