'use client';

import { useEffect, useState } from "react";
import { DEFAULT_STUDY_FX_PREFS, readStudyFxPrefs, type StudyFxPrefs } from "./studyFxPrefs";

export function useStudyFxPrefs() {
  const [prefs, setPrefs] = useState<StudyFxPrefs>(DEFAULT_STUDY_FX_PREFS);

  useEffect(() => {
    const sync = () => {
      setPrefs(readStudyFxPrefs());
    };

    sync();

    const onUpdated = () => sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== "alga-study-fx-prefs") return;
      sync();
    };

    window.addEventListener("alga-study-fx-prefs-updated", onUpdated);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("alga-study-fx-prefs-updated", onUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return prefs;
}
