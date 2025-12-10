"use client";

import { createContext, useContext, useCallback, ReactNode } from "react";
import { useLocalStorageBoolean } from "@/hooks/useLocalStorage";

interface SoundContextType {
  soundEnabled: boolean;
  toggleSound: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export function useSoundContext() {
  const context = useContext(SoundContext);
  if (context === undefined) {
    throw new Error("useSoundContext must be used within a SoundProvider");
  }
  return context;
}

interface SoundProviderProps {
  children: ReactNode;
}

export function SoundProvider({ children }: SoundProviderProps) {
  const { value: soundEnabled, setValue: setSoundEnabled } = useLocalStorageBoolean(
    "soundEnabled",
    true
  );

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => !prev);
  }, [setSoundEnabled]);

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound }}>
      {children}
    </SoundContext.Provider>
  );
}
