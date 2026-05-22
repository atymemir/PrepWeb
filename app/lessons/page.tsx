'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "../lib/supabase";
import { LESSONS } from "../data/lessons";
import { sortWeakest, type SkillRow } from "../lib/learningSignals";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton } from "../ui/ui";

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

export default function LessonsPage() {
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

      setWeakSkills(sortWeakest(rows).slice(0, 4));
    } catch (e: any) {
      setErr(e?.message || "Failed to load lesson recommendations.");
      setWeakSkills([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWeakRecommendations();
  }, []);

  const lessons = LESSONS as Lesson[];

  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      const subjectOk = subject === "All" || lesson.subject === subject;
      const q = query.trim().toLowerCase();

      if (!q) return subjectOk;

      const haystack = [
        lesson.key,
        lesson.title,
        lesson.subject ?? "",
        lesson.domain ?? "",
        lesson.summary ?? "",
        ...(lesson.keyPoints ?? []),
        ...(lesson.commonTraps ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return subjectOk && haystack.includes(q);
    });
  }, [lessons, query, subject]);

  const recommendedLessons = useMemo(() => {
    if (!weakSkills.length) return [];
    const weakNames = new Set(weakSkills.map((s) => s.subskill.toLowerCase()));
    return lessons.filter((lesson) => weakNames.has(lesson.key.toLowerCase())).slice(0, 4);
  }, [lessons, weakSkills]);

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Lessons"
        subtitle="Concept repair layer. Read fast, then go straight into targeted practice."
        right={<Pill text={`${filteredLessons.length} visible`} />}
      />

      {loading && (
        <Card title="Loading…" subtitle="Building lesson recommendations">
          <div className="text-sm text-gray-600">Please wait.</div>
        </Card>
      )}

      {!loading && err && (
        <Card title="Error" subtitle="Lesson recommendations could not load">
          <div className="text-sm text-red-600">{err}</div>
          <div className="mt-4 grid gap-3">
            <PrimaryButton onClick={loadWeakRecommendations}>Try again</PrimaryButton>
            <SecondaryButton href="/today">Back to Today</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && (
        <div className="grid gap-4">
          {/* Recommended */}
          <Card
            title="Recommended from your weak skills"
            subtitle="Best theory review based on your current weak zones."
          >
            {recommendedLessons.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {recommendedLessons.map((lesson) => (
                  <Link
                    key={lesson.key}
                    href={`/lesson/${encodeURIComponent(lesson.key)}`}
                    className="rounded-2xl border border-gray-200 p-4 transition hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-black">{lesson.title}</div>
                      {lesson.subject ? <Pill text={lesson.subject} /> : null}
                    </div>
                    <div className="mt-2 text-sm leading-relaxed text-gray-600">
                      {lesson.summary}
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                      Open lesson → then go straight into targeted practice.
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div>
                <div className="text-sm text-gray-700">
                  No personalized recommendations yet. Once ALGA has enough practice data, this section becomes more useful.
                </div>
                <div className="mt-4 grid gap-3">
                  <PrimaryButton href="/practice?subject=Reading">Start practice</PrimaryButton>
                  <SecondaryButton href="/skills">Open skills</SecondaryButton>
                </div>
              </div>
            )}
          </Card>

          {/* Filters */}
          <Card title="Lesson library" subtitle="Search concepts, then repair and practice.">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {(["All", "Reading", "Math"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                      subject === s
                        ? "border-black bg-black text-white"
                        : "border-gray-300 bg-white text-gray-700"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <input
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                placeholder="Search lesson / subskill / domain…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              {filteredLessons.length === 0 ? (
                <div className="text-sm text-gray-600">
                  No lessons match “{query.trim()}”.
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredLessons.map((lesson) => (
                    <div
                      key={lesson.key}
                      className="rounded-2xl border border-gray-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-base font-semibold text-black">{lesson.title}</div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {lesson.subject ? <Pill text={lesson.subject} /> : null}
                            {lesson.domain ? <Pill text={lesson.domain} /> : null}
                          </div>
                          <div className="mt-3 text-sm leading-relaxed text-gray-600">
                            {lesson.summary}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <PrimaryButton href={`/lesson/${encodeURIComponent(lesson.key)}`}>
                          Open lesson
                        </PrimaryButton>
                        <SecondaryButton
                          href={`/practice?subject=${lesson.subject ?? "Reading"}&subskill=${encodeURIComponent(
                            lesson.key
                          )}`}
                        >
                          Practice this
                        </SecondaryButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
