export type StudyFxPrefs = {
  soundEnabled: boolean;
  motionEnabled: boolean;
};

const STORAGE_KEY = "alga-study-fx-prefs";

export const DEFAULT_STUDY_FX_PREFS: StudyFxPrefs = {
  soundEnabled: true,
  motionEnabled: true,
};

function isClient(): boolean {
  return typeof window !== "undefined";
}

export function readStudyFxPrefs(): StudyFxPrefs {
  if (!isClient()) return DEFAULT_STUDY_FX_PREFS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STUDY_FX_PREFS;

    const parsed = JSON.parse(raw) as Partial<StudyFxPrefs>;
    return {
      soundEnabled: parsed.soundEnabled ?? DEFAULT_STUDY_FX_PREFS.soundEnabled,
      motionEnabled: parsed.motionEnabled ?? DEFAULT_STUDY_FX_PREFS.motionEnabled,
    };
  } catch {
    return DEFAULT_STUDY_FX_PREFS;
  }
}

export function writeStudyFxPrefs(next: StudyFxPrefs): void {
  if (!isClient()) return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("alga-study-fx-prefs-updated"));
}
