export function adaptText(text: string, language: "en" | "zh", username?: string, charName?: string): string {
  let parsed = text.replace(/<br\s*\/?>/gi, "\n");
  const userReplacement = username ?? (language === "zh" ? "我" : "I");
  parsed = parsed.replace(/{{user}}/g, userReplacement);
  parsed = parsed.replace(/{{char}}/g, charName ?? "");
  return parsed;
}
  
export function adaptCharacterData<T extends Record<string, unknown>>(
  characterData: T,
  language: "en" | "zh",
  username?: string,
): T {
  const result = { ...characterData } as Record<string, unknown>;
  const charReplacement = (characterData.name as string) || "";
  
  const fieldsToProcess = [
    "description", "personality", "first_mes", "scenario",
    "mes_example", "creatorcomment", "creator_notes",
  ];
  
  for (const field of fieldsToProcess) {
    if (result[field] && typeof result[field] === "string") {
      result[field] = adaptText(result[field] as string, language, username, charReplacement);
    }
  }
  
  if (result.character_book) {
    const book = result.character_book as { entries?: unknown[] } | unknown[];
    const bookEntries = Array.isArray(book) ? book : (book.entries || []);
  
    result.character_book = bookEntries.map((entry: unknown) => {
      const e = entry as Record<string, unknown>;
      const processedEntry = { ...e };
  
      if (processedEntry.comment && typeof processedEntry.comment === "string") {
        processedEntry.comment = adaptText(processedEntry.comment, language, username, charReplacement);
      }
  
      if (processedEntry.content && typeof processedEntry.content === "string") {
        processedEntry.content = adaptText(processedEntry.content, language, username, charReplacement);
      }
  
      return processedEntry;
    });
  }
  
  if (Array.isArray(result.alternate_greetings)) {
    result.alternate_greetings = result.alternate_greetings.map((greeting: unknown) =>
      typeof greeting === "string" ? adaptText(greeting, language, username, charReplacement) : greeting,
    );
  }
  
  return result as T;
}
  
