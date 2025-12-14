import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import { adaptCharacterData } from "@/lib/adapter/tagReplacer";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                     Character List Interface                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
interface FormattedCharacter {
  id: string;
  name: string;
  description?: string;
  personality: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creatorcomment?: string;
  created_at: string;
  updated_at: string;
  avatar_path?: string;
}

export async function getAllCharacters(language: "en" | "zh", username?: string): Promise<FormattedCharacter[]> {
  try {
    const characters = await LocalCharacterRecordOperations.getAllCharacters();

    const formattedCharacters = [...characters]
      .reverse()
      .map(character => {
        const characterData = {
          id: character.id,
          name: character.data.data?.name || character.data.name,
          description: character.data.data?.description || character.data.description,
          personality: character.data.data?.personality || character.data.personality,
          scenario: character.data.data?.scenario || character.data.scenario,
          first_mes: character.data.data?.first_mes || character.data.first_mes,
          mes_example: character.data.data?.mes_example || character.data.mes_example,
          creatorcomment: character.data.creatorcomment || character.data.data?.creator_notes,
          created_at: character.created_at,
          updated_at: character.updated_at,
          avatar_path: character.imagePath,
        };
        const processedData = adaptCharacterData(characterData, language, username);
        
        return processedData;
      });

    return formattedCharacters;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to get characters:", error);
    throw new Error(`Failed to get characters: ${errorMessage}`);
  }
}
