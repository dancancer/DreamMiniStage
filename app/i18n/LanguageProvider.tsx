"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANGUAGE, Language, LANGUAGES, LanguageContext, getTranslation, getClientLanguage } from "./index";
import { getLanguageFont, getLanguageTitleFont, getLanguageSerifFont } from "./fonts";
import { useLocalStorageString } from "@/hooks/useLocalStorage";

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const initialLanguage = useMemo(() => getClientLanguage(), []);
  const { value: storedLanguage, setValue: setLanguageValue } = useLocalStorageString(
    "language",
    initialLanguage,
  );
  const language = useMemo<Language>(() => (
    LANGUAGES.includes(storedLanguage as Language) ? storedLanguage as Language : DEFAULT_LANGUAGE
  ), [storedLanguage]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  const [fontClass, setFontClass] = useState(getLanguageFont(language));
  const [titleFontClass, setTitleFontClass] = useState(getLanguageTitleFont(language));
  const [serifFontClass, setSerifFontClass] = useState(getLanguageSerifFont(language));

  useEffect(() => {
    setFontClass(getLanguageFont(language));
    setTitleFontClass(getLanguageTitleFont(language));
    setSerifFontClass(getLanguageSerifFont(language));

    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", language);
    }

    if (isFirstLoad) {
      setShowTransition(false);
      setIsFirstLoad(false);
    }

    setIsLoaded(true);
  }, [language, isFirstLoad]);

  const setLanguage = (newLanguage: Language) => {
    if (LANGUAGES.includes(newLanguage) && newLanguage !== language) {
      setShowTransition(false);
      setLanguageValue(newLanguage);
    }
  };

  const t = (key: string) => {
    return getTranslation(language, key);
  };

  if (!isLoaded && typeof window !== "undefined") {
    return (
      <LanguageContext.Provider value={{ language, setLanguage, t, fontClass, titleFontClass, serifFontClass }}>
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, fontClass, titleFontClass, serifFontClass }}>
      {children}
    </LanguageContext.Provider>
  );
}
