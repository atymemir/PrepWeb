'use client';
export const dynamic = 'force-dynamic';

import { useMemo, useState } from "react";
import Link from "next/link";
import { LESSONS, type Lesson } from "../data/lessons";
import { LESSON_ALIASES } from "../data/lessonAliases";
import { focusedPracticeHref } from "../lib/mastery";
import { useStudentState } from "../lib/useStudentState";
import { PageHeader, Pill, PrimaryButton } from "../ui/ui";

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

function lessonHref(key: string): string {
  return `/lesson/${encodeURIComponent(key)}`;
}

function practiceHref(lesson: Lesson): string {
  return `${focusedPracticeHref(lesson.subject, lesson.key)}&mode=trainer`;
}

function lessonForSkill(skill: string): Lesson | null {
  const direct = LESSONS.find((lesson) => normalize(lesson.key) === normalize(skill));
  if (direct) return direct;

  const alias = LESSON_ALIASES[normalize(skill)];
  if (!alias) return null;
  return LESSONS.find((lesson) => normalize(lesson.key) === normalize(alias)) ?? null;
}

export default function LessonsPage() {
  const { state: studentState } = useStudentState({ dueLimit: 80, historyLimit: 60 });
  const [subject, setSubject] = useState<"All" | "Reading" | "Math">("All");
  const [query, setQuery] = useState("");

  const filteredLessons = useMemo(() => {
    return LESSONS.filter((lesson) => {
      const subjectOk = subject === "All" || lesson.subject === subject;
      const q = query.trim().toLowerCase();

      if (!q) return subjectOk;

      const haystack = [
        lesson.key,
        lesson.title,
        lesson.subject,
        lesson.domain,
        lesson.summary,
        lesson.practiceCue,
        ...lesson.repairPattern,
        ...lesson.commonTraps,
      ]
        .join(" ")
        .toLowerCase();

      return subjectOk && haystack.includes(q);
    });
  }, [query, subject]);

  const recommendedRoutes = useMemo(() => {
    const seen = new Set<string>();
    return (studentState?.weakSkillTargets ?? [])
      .map((skill) => {
        const lesson = lessonForSkill(skill.subskill);
        if (!lesson || seen.has(lesson.key)) return null;
        seen.add(lesson.key);
        return {
          skill,
          lesson,
          accuracyPct: skill.accuracyPct,
        };
      })
      .filter(
        (
          item
        ): item is {
          skill: NonNullable<typeof studentState>["weakSkillTargets"][number];
          lesson: Lesson;
          accuracyPct: number;
        } => !!item
      )
      .slice(0, 3);
  }, [studentState?.weakSkillTargets]);

  const debtRoute = useMemo(() => {
    const topDebt = studentState?.reviewDebt.topTopics?.[0];
    if (!topDebt) return null;
    const lesson = lessonForSkill(topDebt.topic);
    if (!lesson) return null;
    return {
      lesson,
      reason: `Highest active debt topic: ${topDebt.topic} (${topDebt.count} due now).`,
    };
  }, [studentState?.reviewDebt.topTopics]);

  const primaryRoute = useMemo(() => {
    if (recommendedRoutes[0]) {
      const { lesson, accuracyPct, skill } = recommendedRoutes[0];
      return {
        lesson,
        reason: `Weakest active signal: ${skill.subskill} at ${accuracyPct}% across ${skill.attempts} attempts.`,
      };
    }

    if (debtRoute) return debtRoute;

    const fallback = filteredLessons[0] ?? LESSONS[0];
    return {
      lesson: fallback,
      reason: "Best available repair route based on your current lesson filter.",
    };
  }, [recommendedRoutes, debtRoute, filteredLessons]);

  const primaryLesson = primaryRoute.lesson;
  const primaryPayoff = primaryLesson.repairPlaybook?.retryPayoff ?? primaryLesson.practiceCue;
  const primaryTrap = primaryLesson.repairPlaybook?.trap ?? primaryLesson.commonTraps[0];

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Lessons"
        subtitle="Open one repair playbook, then verify with focused reps."
        right={<Pill text={`${filteredLessons.length} lessons`} tone="accent" />}
      />

      <div className="grid gap-4">
        <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] shadow-xl">
          <div className="p-5 sm:p-6">
            <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
              Recommended repair route
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {primaryLesson.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#d2dbec]">
              {primaryLesson.summary}
            </p>
            <div className="mt-4 grid gap-2 text-sm text-[#d4e1fa] sm:max-w-3xl sm:grid-cols-2">
              <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9fc1f8]">Why now</div>
                <div className="mt-1">{primaryRoute.reason}</div>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9fc1f8]">Payoff</div>
                <div className="mt-1">{primaryPayoff}</div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-[#6f4b54] bg-[#2f1e25]/70 px-3 py-2 text-sm text-[#ffdbe2]">
              Trap to fix first: {primaryTrap}
            </div>
            <div className="mt-5 max-w-sm">
              <PrimaryButton href={lessonHref(primaryLesson.key)}>Open repair playbook</PrimaryButton>
            </div>
            <div className="mt-3 text-xs font-semibold text-[#bdd5ff]">
              Already repaired?{" "}
              <Link href={practiceHref(primaryLesson)} className="underline underline-offset-4 hover:text-white">
                Run focused retry
              </Link>
              .
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white/92 p-4 shadow-sm sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">Other lessons</div>
          <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-center">
            <div className="flex flex-wrap gap-2">
              {(["All", "Reading", "Math"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  className={[
                    "rounded-full border px-3 py-2 text-xs font-semibold transition",
                    subject === s
                      ? "border-[#0e1b34] bg-[#0e1b34] text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400",
                  ].join(" ")}
                >
                  {s}
                </button>
              ))}
            </div>

            <input
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none"
              placeholder="Search lesson"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="mt-4 grid gap-3">
            {filteredLessons.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                No lessons match &quot;{query.trim()}&quot;.
              </div>
            ) : (
              filteredLessons.map((lesson) => (
                <div
                  key={lesson.key}
                  className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-semibold text-black">{lesson.title}</div>
                      <Pill text={lesson.subject} tone={lesson.subject === "Math" ? "accent" : "neutral"} />
                      <Pill text={lesson.domain} tone="neutral" />
                    </div>
                    <div className="mt-1 text-sm text-gray-700">{lesson.summary}</div>
                  </div>

                  <div className="lg:w-56">
                    <PrimaryButton href={lessonHref(lesson.key)}>Open</PrimaryButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
