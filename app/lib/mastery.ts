export type MasteryState = "Mastered" | "Growing" | "Unstable" | "Untouched";
export type MovementState = "Stuck" | "Volatile" | "Building" | "Stable";
export type Subject = "Reading" | "Math";

type MasteryInput = {
  attempts: number;
  accuracy: number | null | undefined;
};

function safeAttempts(n: number | null | undefined): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(Number(n)));
}

function safeAccuracy(n: number | null | undefined): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, Number(n)));
}

export function masteryFor(input: MasteryInput): MasteryState {
  const attempts = safeAttempts(input.attempts);
  const accuracy = safeAccuracy(input.accuracy);

  if (attempts === 0) return "Untouched";
  if (attempts >= 12 && accuracy >= 0.82) return "Mastered";
  if (attempts >= 6 && accuracy >= 0.62) return "Growing";
  return "Unstable";
}

export function movementFor(input: MasteryInput): MovementState {
  const attempts = safeAttempts(input.attempts);
  const accuracy = safeAccuracy(input.accuracy);

  if (attempts >= 10 && accuracy < 0.55) return "Stuck";
  if (attempts < 6) return "Building";
  if (accuracy >= 0.74) return "Stable";
  return "Volatile";
}

export function masteryTone(state: MasteryState): "neutral" | "accent" | "success" | "danger" {
  if (state === "Mastered") return "success";
  if (state === "Growing") return "accent";
  if (state === "Unstable") return "danger";
  return "neutral";
}

export function movementTone(state: MovementState): "neutral" | "accent" | "success" | "danger" {
  if (state === "Stable") return "success";
  if (state === "Stuck") return "danger";
  if (state === "Volatile") return "accent";
  return "neutral";
}

export function masteryDescription(state: MasteryState): string {
  if (state === "Mastered") return "High accuracy with enough attempts. Maintain with spaced retests.";
  if (state === "Growing") return "Improving but not yet locked. One focused set should confirm stability.";
  if (state === "Unstable") return "Active weakness. This should get immediate repair time.";
  return "No evidence yet. Run a baseline set before conclusions.";
}

export function movementDescription(state: MovementState): string {
  if (state === "Stable") return "Signal is currently stable.";
  if (state === "Stuck") return "Repeated misses with enough data. Needs lesson + targeted repair.";
  if (state === "Volatile") return "Inconsistent outcomes. Keep this in focused rotation.";
  return "Evidence is still building.";
}

export function subjectForTopic(subject: string | null | undefined): Subject {
  if (subject === "Math") return "Math";
  return "Reading";
}

export function focusedPracticeHref(subject: Subject, subskill: string, revisit = false): string {
  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("subskill", subskill);
  if (revisit) params.set("revisit", "1");
  return `/practice?${params.toString()}`;
}

export function focusedLessonHref(subskill: string): string {
  return `/lesson/${encodeURIComponent(subskill)}`;
}
