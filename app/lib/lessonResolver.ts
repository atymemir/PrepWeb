import { LESSONS } from "@/app/data/lessons";
import { LESSON_ALIASES } from "@/app/data/lessonAliases";

type Lesson = {
  key: string;
  subject?: "Reading" | "Math";
  domain?: string;
  title: string;
  summary: string;
  keyPoints: string[];
  commonTraps: string[];
  miniExample: { prompt: string; answer: string };
};

function normalize(value: string): string {
  return decodeURIComponent(String(value))
    .trim()
    .toLowerCase()
    .replace(/%20/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

function buildCandidates(input: string): string[] {
  const raw = normalize(input);

  const candidates = new Set<string>();
  candidates.add(raw);

  // Common alternate forms
  candidates.add(raw.replace(/\s+/g, "-"));
  candidates.add(raw.replace(/\s+/g, " "));
  candidates.add(raw.replace(/\sand\s/g, " & "));
  candidates.add(raw.replace(/\s&\s/g, " and "));

  return [...candidates].map(normalize);
}

export function resolveLesson(input: string): Lesson | null {
  const lessons = LESSONS as Lesson[];
  const candidates = buildCandidates(input);

  // 1) direct key/title/domain exact match
  for (const candidate of candidates) {
    const direct =
      lessons.find((lesson) => normalize(lesson.key) === candidate) ||
      lessons.find((lesson) => normalize(lesson.title) === candidate) ||
      lessons.find((lesson) => normalize(lesson.domain ?? "") === candidate);

    if (direct) return direct;
  }

  // 2) alias -> canonical key
  for (const candidate of candidates) {
    const canonicalKey = LESSON_ALIASES[candidate];
    if (canonicalKey) {
      const aliased =
        lessons.find((lesson) => normalize(lesson.key) === normalize(canonicalKey)) ||
        lessons.find((lesson) => normalize(lesson.title) === normalize(canonicalKey));

      if (aliased) return aliased;
    }
  }

  // 3) loose fallback
  for (const candidate of candidates) {
    const loose =
      lessons.find((lesson) => normalize(lesson.key).includes(candidate)) ||
      lessons.find((lesson) => candidate.includes(normalize(lesson.key))) ||
      lessons.find((lesson) => normalize(lesson.title).includes(candidate)) ||
      lessons.find((lesson) => candidate.includes(normalize(lesson.title))) ||
      lessons.find((lesson) => normalize(lesson.domain ?? "").includes(candidate)) ||
      lessons.find((lesson) => candidate.includes(normalize(lesson.domain ?? "")));

    if (loose) return loose;
  }

  return null;
}