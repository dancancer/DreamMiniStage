/**
 * @input  react
 * @output LANGUAGES, Language, DEFAULT_LANGUAGE, LanguageContext, useLanguage, getTranslation, getClientLanguage
 * @pos    国际化入口 - 语言 Context 定义、翻译函数与客户端语言检测
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { createContext, useContext } from "react";

export const LANGUAGES = ["zh", "en"] as const;
export type Language = typeof LANGUAGES[number];

export const DEFAULT_LANGUAGE: Language = "zh";

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
  fontClass: string;
  titleFontClass: string;
  serifFontClass: string;
};

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

export const getTranslation = (language: Language, key: string): string => {
  try {
    const translations = require(`./locales/${language}.json`);
    
    const keys = key.split(".");
    let result = translations;
    
    for (const k of keys) {
      if (result[k] === undefined) {
        return key;
      }
      result = result[k];
    }
    
    return result;
  } catch (error) {
    return key;
  }
};

export const getClientLanguage = (): Language => {
  if (typeof window !== "undefined") {
    const browserLang = navigator.language.split("-")[0] as Language;
    if (LANGUAGES.includes(browserLang)) {
      return browserLang;
    }
  }

  return DEFAULT_LANGUAGE;
};
