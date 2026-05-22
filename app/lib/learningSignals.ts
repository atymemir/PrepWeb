export type Subject = "Reading" | "Math";

export type SkillRow = {
  domain: string;
  skill: string;
  subskill: string;
  attempts: number;
  correct: number;
  accuracy: number; // 0..1
};

export type WeakestResult = {
  subject: Subject;
  row: SkillRow;
};

export function pct(x: number | null | undefined): number {
  return Math.round((x ?? 0) * 100);
}

export function confidenceLabel(n: number): "Low" | "Medium" | "High" {
  if (n < 6) return "Low";
  if (n < 15) return "Medium";
  return "High";
}

export function weaknessScore(row: SkillRow): number {
  return (row.accuracy ?? 0) + (row.attempts < 6 ? 0.12 : 0);
}

export function sortWeakest(rows: SkillRow[]): SkillRow[] {
  return [...rows].sort((a, b) => {
    const aScore = weaknessScore(a);
    const bScore = weaknessScore(b);

    if (aScore !== bScore) return aScore - bScore;
    if ((a.attempts ?? 0) !== (b.attempts ?? 0)) return b.attempts - a.attempts;

    return a.subskill.localeCompare(b.subskill);
  });
}

export function pickWeakest(rows: SkillRow[]): SkillRow | null {
  return sortWeakest(rows)[0] ?? null;
}

export function pickWeakestAcrossSubjects(
  readingRows: SkillRow[],
  mathRows: SkillRow[]
): WeakestResult | null {
  const weakestReading = pickWeakest(readingRows);
  const weakestMath = pickWeakest(mathRows);

  if (!weakestReading && !weakestMath) return null;
  if (!weakestReading) return { subject: "Math", row: weakestMath! };
  if (!weakestMath) return { subject: "Reading", row: weakestReading };

  const rScore = weaknessScore(weakestReading);
  const mScore = weaknessScore(weakestMath);

  return rScore <= mScore
    ? { subject: "Reading", row: weakestReading }
    : { subject: "Math", row: weakestMath };
}

export function stableRows(rows: SkillRow[], minAttempts = 6): SkillRow[] {
  return rows.filter((r) => (r.attempts ?? 0) >= minAttempts);
}

export function lowSignalRows(rows: SkillRow[], minAttempts = 6): SkillRow[] {
  return rows.filter((r) => (r.attempts ?? 0) < minAttempts);
}