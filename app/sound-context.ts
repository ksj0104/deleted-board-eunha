"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
  createSoundPlayer,
  SOUND_STORAGE_KEY,
  type SoundPlayer,
} from "../lib/sound";
export const SoundContext = createContext<SoundPlayer | null>(null);
export const useSound = () => useContext(SoundContext);
export function useGameSound() {
  const [sound] = useState(() => createSoundPlayer());
  useEffect(() => {
    sound.restore();
    const visibility = () => {
      if (document.visibilityState === "hidden") sound.pause();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === SOUND_STORAGE_KEY || event.key === null)
        sound.restore();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("storage", storage);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("storage", storage);
      sound.dispose();
    };
  }, [sound]);
  return sound;
}
