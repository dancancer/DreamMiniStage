/**
 * @input  app/i18n/index
 * @output languageFontMap, languageSerifFontMap, languageTitleFontMap, getLanguageFont, getLanguageSerifFont, getLanguageTitleFont, fontClass, serifFontClass, titleFontClass
 * @pos    字体配置 - 按语言映射字体类名
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { Language } from "./index";

export const languageFontMap: Record<Language, string> = {
  "zh": "font-noto-sans-sc",
  "en": "font-source-sans",
};

export const languageSerifFontMap: Record<Language, string> = {
  "zh": "font-source-sans",
  "en": "font-source-sans",
};

export const languageTitleFontMap: Record<Language, string> = {
  "zh": "font-cinzel",
  "en": "font-cinzel",
};

export const getLanguageFont = (language: Language): string => {
  return languageFontMap[language] || "font-source-sans";
};

export const getLanguageSerifFont = (language: Language): string => {
  return languageSerifFontMap[language] || "font-source-serif";
};

export const getLanguageTitleFont = (language: Language): string => {
  return languageTitleFontMap[language] || "font-cinzel";
};

export const fontClass = "font-sans";
export const serifFontClass = "font-sans";
export const titleFontClass = "font-title";
