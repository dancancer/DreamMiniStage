import { 
  CHARACTERS_RECORD_FILE, 
  deleteRecord, 
  getAllRecords, 
  getRecordByKey, 
  putRecord, 
} from "@/lib/data/local-storage";
import { RawCharacterData } from "@/lib/models/rawdata-model";
import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";

export interface CharacterRecord {
  id: string;
  data: RawCharacterData;
  imagePath: string;
  created_at: string;
  updated_at: string;
  order?: number;
}

export class LocalCharacterRecordOperations {
  static async createCharacter(characterId: string, rawCharacterData: RawCharacterData, imagePath: string): Promise<CharacterRecord> {
    const characterRecord: CharacterRecord = {
      id: characterId,
      data: rawCharacterData,
      imagePath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      order: Date.now(),
    };

    await putRecord(CHARACTERS_RECORD_FILE, characterId, characterRecord);
    return characterRecord;
  }
  
  static async getAllCharacters(): Promise<CharacterRecord[]> {
    const records = await getAllRecords<CharacterRecord>(CHARACTERS_RECORD_FILE);
    return records
      .filter(record => Boolean(record?.id))
      .sort((a, b) => {
        const orderA = a.order ?? new Date(a.updated_at).getTime();
        const orderB = b.order ?? new Date(b.updated_at).getTime();
        return orderB - orderA;
      });
  }
  
  static async getCharacterById(characterId: string): Promise<CharacterRecord | null> {
    const characterRecord = await getRecordByKey<CharacterRecord>(CHARACTERS_RECORD_FILE, characterId);
    return characterRecord as CharacterRecord | null;
  }
  
  static async updateCharacter(characterId: string, characterData: Partial<RawCharacterData>): Promise<CharacterRecord | null> {
    const record = await getRecordByKey<CharacterRecord>(CHARACTERS_RECORD_FILE, characterId);
    if (!record) {
      return null;
    }

    const updated: CharacterRecord = {
      ...record,
      data: { ...record.data, ...characterData },
      updated_at: new Date().toISOString(),
    };

    await putRecord(CHARACTERS_RECORD_FILE, characterId, updated);
    return updated;
  }
  
  static async deleteCharacter(characterId: string): Promise<boolean> {
    const record = await getRecordByKey<CharacterRecord>(CHARACTERS_RECORD_FILE, characterId);
    if (!record) {
      return false;
    }

    await deleteRecord(CHARACTERS_RECORD_FILE, characterId);
    await LocalCharacterDialogueOperations.deleteDialogueTree(characterId);
    return true;
  }

  /**
 * As we rendering the array as descending order, 
 * we need to move character to end of the array to bring the card to the top of the screen
   * @param characterId 
   * @returns 
   */
  static async moveCharacterToTop(characterId: string): Promise<boolean> {
    const record = await getRecordByKey<CharacterRecord>(CHARACTERS_RECORD_FILE, characterId);
    if (!record) {
      return false;
    }

    const updated: CharacterRecord = {
      ...record,
      order: Date.now(),
      updated_at: new Date().toISOString(),
    };

    await putRecord(CHARACTERS_RECORD_FILE, characterId, updated);

    return true;
  }
}
