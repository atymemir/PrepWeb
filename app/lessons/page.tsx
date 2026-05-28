'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "../lib/supabase";
import { LESSONS, type Lesson } from "../data/lessons";
import { LESSON_ALIASES } from "../data/lessonAliases";
import { sortWeakest, type SkillRow } from "../lib/learningSignals";
import { useStudentState } from "../lib/useStudentState";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton } from "../ui/ui";

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
  return `/practice?subject=${lesson.subject}&subskill=${encodeURIComponent(lesson.key)}&revisit=1`;
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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [subject, setSubject] = useState<"All" | "Reading" | "Math">("All");
  const [query, setQuery] = useState("");
  const [weakSkills, setWeakSkills] = useState<SkillRow[]>([]);

  async function loadWeakRecommendations() {
    setLoading(true);
    setErr(null);

    try {
      const supabase = getSupabase();
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw new Error(sessErr.message);

      if (!sessionData.session) {
        setWeakSkills([]);
        setLoading(false);
        return;
      }

      const [readingRes, mathRes] = await Promise.all([
        supabase.rpc("get_skill_mastery", { p_subject: "Reading" }),
        supabase.rpc("get_skill_mastery", { p_subject: "Math" }),
      ]);

      if (readingRes.error) throw new Error(readingRes.error.message);
      if (mathRes.error) throw new Error(mathRes.error.message);

      const rows = [
        ...((readingRes.data ?? []) as SkillRow[]),
        ...((mathRes.data ?? []) as SkillRow[]),
      ];

      setWeakSkills(sortWeakest(rows).slice(0, 6));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load lesson recommendations.");
      setWeakSkills([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await Promise.resolve();
      if (!cancelled) await loadWeakRecommendations();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

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
    return weakSkills
      .map((skill) => {
        const lesson = lessonForSkill(skill.subskill);
        if (!lesson || seen.has(lesson.key)) return null;
        seen.add(lesson.key);
        return {
          skill,
          lesson,
          accuracyPct: Math.round((skill.accuracy ?? 0) * 100),
        };
      })
      .filter((item): item is { skill: SkillRow; lesson: Lesson; accuracyPct: number } => !!item)
      .slice(0, 3);
  }, [weakSkills]);

  const primaryLesson = recommendedRoutes[0]?.lesson ?? filteredLessons[0] ?? LESSONS[0];

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Lessons"
        subtitle="Open one repair playbook, then verify with focused reps."
        right={<Pill text={`${filteredLessons.length} lessons`} tone="accent" />}
      />

      {studentState && (
        <section className="mb-4 rounded-2xl border border-gray-200 bg-white/92 p-4 shadow-sm sm:mb-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">Lesson usage command</div>
            <Pill text={`Debt ${studentState.reviewDebt.dueCount}`} tone={studentState.reviewDebt.dueCount > 0 ? "danger" : "success"} />
          </div>
          <div className="mt-2 text-sm font-semibold text-black">{studentState.recommendedAction.title}</div>
          <div className="mt-1 text-xs text-gray-600">Use lesson to repair, then return to targeted retry immediately.</div>
        </section>
      )}

      {loading && (
        <Card title="Loading…" subtitle="Building repair routes">
          <div className="text-sm text-gray-600">Please wait.</div>
        </Card>
      )}

      {!loading && err && (
        <Card title="Error" subtitle="Lessons could not load">
          <div className="text-sm text-red-600">{err}</div>
          <div className="mt-4 grid gap-3">
            <PrimaryButton onClick={loadWeakRecommendations}>Try again</PrimaryButton>
            <SecondaryButton href="/today">Back to Today</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && (
        <div className="grid gap-4">
          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] shadow-xl">
            <div className="p-5 sm:p-6">
              <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                Top repair route
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {primaryLesson.title}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#d2dbec]">
                {primaryLesson.summary}
              </p>
              <div className="mt-5 grid gap-3 sm:max-w-xl sm:grid-cols-2">
                <PrimaryButton href={lessonHref(primaryLesson.key)}>Open lesson</PrimaryButton>
                <SecondaryButton href={practiceHref(primaryLesson)}>Run focused retry</SecondaryButton>
              </div>
            </div>
          </section>

          {recommendedRoutes.length > 0 && (
            <section className="rounded-2xl border border-gray-200 bg-white/92 p-3 shadow-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">Weakest-first routes</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {recommendedRoutes.map(({ lesson, accuracyPct }) => (
                  <Link
                    key={lesson.key}
                    href={lessonHref(lesson.key)}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:border-gray-300"
                  >
                    <div className="font-semibold text-black">{lesson.title}</div>
                    <div className="mt-1 text-xs text-gray-600">{lesson.subject} • {accuracyPct}%</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-3xl border border-gray-200 bg-white/92 p-4 shadow-sm sm:p-5">
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
                      </div>
                      <div className="mt-1 text-sm text-gray-700">{lesson.summary}</div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:w-56 lg:grid-cols-1">
                      <PrimaryButton href={lessonHref(lesson.key)}>Open</PrimaryButton>
                      <SecondaryButton href={practiceHref(lesson)}>Retry</SecondaryButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
