'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "../lib/supabase";
import { Card, LoopRail, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";

type Profile = {
  id: string;
  nickname: string | null;
  target_score: number | null;
  daily_study_hours: number | null;
  exam_date: string | null;
  weakest_area: string | null;
  current_level: string | null;
};

type SkillRow = {
  domain: string;
  skill: string;
  subskill: string;
  attempts: number;
  correct: number;
  accuracy: number; // 0..1
};

type Question = {
  id: string;
};

type LeaderEntry = {
  user_id: string;
  nickname: string;
  answered: number;
  correct: number;
  review_answered: number;
  accuracy: number;
  points: number;
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function confidenceLabel(n: number): "Low" | "Medium" | "High" {
  if (n < 6) return "Low";
  if (n < 15) return "Medium";
  return "High";
}

function weaknessScore(row: SkillRow): number {
  return (row.accuracy ?? 0) + (row.attempts < 6 ? 0.12 : 0);
}

function sortWeakest(rows: SkillRow[]) {
  return [...rows].sort((a, b) => {
    const aScore = weaknessScore(a);
    const bScore = weaknessScore(b);
    if (aScore !== bScore) return aScore - bScore;
    return b.attempts - a.attempts;
  });
}

function pct(n: number | null | undefined) {
  return Math.round((n ?? 0) * 100);
}

function coachHeadline(args: {
  dueReviewCount: number;
  weakestOverall: { subject: "Reading" | "Math"; row: SkillRow } | null;
  dleft: number | null;
}) {
  const { dueReviewCount, weakestOverall, dleft } = args;

  if (dueReviewCount > 0) {
    return {
      title: "Your priority is recovery, not more volume.",
      body:
        dueReviewCount === 1
          ? "You have 1 review item due. Clear it before adding more forward work."
          : `You have ${dueReviewCount} review items due. Clear them before adding more forward work.`,
      tone: "accent" as const,
    };
  }

  if (weakestOverall?.row) {
    return {
      title: `Your best opportunity is ${weakestOverall.row.subskill}.`,
      body: `This is the weakest current signal in ${weakestOverall.subject}. Fixing it now should improve your next practice loop more than broad unfocused work.`,
      tone: "accent" as const,
    };
  }

  if (dleft !== null && dleft <= 30 && dleft >= 0) {
    return {
      title: "You need clean signal and disciplined selection.",
      body:
        "Your exam window is close enough that wasted sessions matter. Keep practice tight, recovery honest, and weak-skill work targeted.",
      tone: "danger" as const,
    };
  }

  return {
    title: "Your job is to generate clean signal and act on it.",
    body:
      "You do not need more noise. You need clear weak-zone evidence, targeted repair, and consistent review.",
    tone: "neutral" as const,
  };
}

export default function CoachPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [skillsReading, setSkillsReading] = useState<SkillRow[]>([]);
  const [skillsMath, setSkillsMath] = useState<SkillRow[]>([]);
  const [dueReviewCount, setDueReviewCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCoach, setAiCoach] = useState<null | {
    coach_note_title: string;
    coach_note_body: string;
    top_issues: { title: string; detail: string }[];
    three_step_plan: { step: "1" | "2" | "3"; title: string; detail: string }[];
    tone_label: "Focused" | "Urgent" | "Rebuild" | "Advance";
  }>(null);

  const nickname = profile?.nickname?.trim() || "Student";
  const dleft = useMemo(() => daysUntil(profile?.exam_date ?? null), [profile]);

  const weakestReading = useMemo(() => sortWeakest(skillsReading)[0] ?? null, [skillsReading]);
  const weakestMath = useMemo(() => sortWeakest(skillsMath)[0] ?? null, [skillsMath]);

  const weakestOverall = useMemo(() => {
    if (!weakestReading && !weakestMath) return null;
    if (!weakestReading) return { subject: "Math" as const, row: weakestMath! };
    if (!weakestMath) return { subject: "Reading" as const, row: weakestReading };

    const rScore = weaknessScore(weakestReading);
    const mScore = weaknessScore(weakestMath);

    return rScore <= mScore
      ? { subject: "Reading" as const, row: weakestReading }
      : { subject: "Math" as const, row: weakestMath };
  }, [weakestReading, weakestMath]);

  const stableWeakAreas = useMemo(() => {
    return sortWeakest([...skillsReading, ...skillsMath]).filter((r) => r.attempts >= 6).slice(0, 3);
  }, [skillsReading, skillsMath]);

  const lowSignalCount = useMemo(() => {
    return [...skillsReading, ...skillsMath].filter((r) => r.attempts < 6).length;
  }, [skillsReading, skillsMath]);

  const myLeague = useMemo(() => {
    if (!profile) return null;
    const idx = leaderboard.findIndex((x) => x.user_id === profile.id);
    if (idx === -1) return null;
    return {
      rank: idx + 1,
      points: Math.round(leaderboard[idx].points),
    };
  }, [leaderboard, profile]);

  const strategistNote = useMemo(() => {
    return coachHeadline({
      dueReviewCount,
      weakestOverall,
      dleft,
    });
  }, [dueReviewCount, weakestOverall, dleft]);

  const nextAction = useMemo(() => {
    if (dueReviewCount > 0) {
      return {
        title: "Clear the recovery queue",
        description: "Review is due. Do not stack new questions on top of unresolved mistakes.",
        primaryHref: "/review",
        primaryLabel: "Start review",
        secondaryHref: weakestOverall?.row
          ? `/practice?subject=${weakestOverall.subject}&subskill=${encodeURIComponent(weakestOverall.row.subskill)}`
          : "/today",
        secondaryLabel: weakestOverall?.row ? "Skip to weakest practice" : "Back to Today",
      };
    }

    if (weakestOverall?.row) {
      return {
        title: `Repair ${weakestOverall.row.subskill}`,
        description: `Current weakest zone in ${weakestOverall.subject}: ${pct(
          weakestOverall.row.accuracy
        )}% over ${weakestOverall.row.attempts} attempts.`,
        primaryHref: `/practice?subject=${weakestOverall.subject}&subskill=${encodeURIComponent(
          weakestOverall.row.subskill
        )}`,
        primaryLabel: "Practice weakest",
        secondaryHref: `/lesson/${encodeURIComponent(weakestOverall.row.subskill)}`,
        secondaryLabel: "Open lesson",
      };
    }

    return {
      title: "Generate cleaner evidence",
      description:
        "You do not have enough stable weakness signal yet. One focused set will improve the quality of your recommendations.",
      primaryHref: "/practice?subject=Reading",
      primaryLabel: "Start Reading practice",
      secondaryHref: "/practice?subject=Math",
      secondaryLabel: "Start Math practice",
    };
  }, [dueReviewCount, weakestOverall]);

  const coachSnapshot = useMemo(() => {
    return {
      nickname,
      examCountdownDays: dleft,
      dueReviewCount,
      weeklyRank: myLeague?.rank ?? null,
      weeklyPoints: myLeague?.points ?? null,
      stableWeakAreas: stableWeakAreas.map((row) => ({
        subject: skillsReading.includes(row) ? "Reading" as const : "Math" as const,
        subskill: row.subskill,
        domain: row.domain,
        skill: row.skill,
        attempts: row.attempts,
        accuracy: row.accuracy,
      })),
      lowSignalCount,
      nextAction,
    };
  }, [nickname, dleft, dueReviewCount, myLeague, stableWeakAreas, lowSignalCount, nextAction, skillsReading]);

  const threeStepPlan = useMemo(() => {
    if (dueReviewCount > 0 && weakestOverall?.row) {
      return [
        {
          step: "1",
          title: "Clear due review",
          text: "Recover active mistakes first so they stop contaminating new work.",
          href: "/review",
          label: "Open review",
        },
        {
          step: "2",
          title: `Target ${weakestOverall.row.subskill}`,
          text: "Immediately follow recovery with narrow repair on the weakest live signal.",
          href: `/practice?subject=${weakestOverall.subject}&subskill=${encodeURIComponent(
            weakestOverall.row.subskill
          )}`,
          label: "Practice weakest",
        },
        {
          step: "3",
          title: "Lock the concept",
          text: "Use the lesson if the weakness is conceptual, not just execution-based.",
          href: `/lesson/${encodeURIComponent(weakestOverall.row.subskill)}`,
          label: "Open lesson",
        },
      ];
    }

    if (weakestOverall?.row) {
      return [
        {
          step: "1",
          title: `Repair ${weakestOverall.row.subskill}`,
          text: "Your weakest live signal deserves first attention.",
          href: `/practice?subject=${weakestOverall.subject}&subskill=${encodeURIComponent(
            weakestOverall.row.subskill
          )}`,
          label: "Practice weakest",
        },
        {
          step: "2",
          title: "Read the repair note",
          text: "If the problem is conceptual, use the lesson before repeating more questions.",
          href: `/lesson/${encodeURIComponent(weakestOverall.row.subskill)}`,
          label: "Open lesson",
        },
        {
          step: "3",
          title: "Re-check the map",
          text: "Return to the skills layer and confirm whether the weak signal improves.",
          href: "/skills",
          label: "Open skills",
        },
      ];
    }

    return [
      {
        step: "1",
        title: "Generate signal",
        text: "You need more evidence before strategy becomes precise.",
        href: "/practice?subject=Reading",
        label: "Start practice",
      },
      {
        step: "2",
        title: "Check recovery later",
        text: "Wrong answers should flow into review instead of being forgotten.",
        href: "/review",
        label: "Open review",
      },
      {
        step: "3",
        title: "Inspect the map",
        text: "Once enough rows stabilize, your next repair route becomes clearer.",
        href: "/skills",
        label: "Open skills",
      },
    ];
  }, [dueReviewCount, weakestOverall]);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const supabase = getSupabase();

      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw new Error(sessErr.message);

      const session = sessionData.session;
      if (!session) {
        router.push("/login");
        return;
      }

      const userId = session.user.id;

      const profileRes = await supabase
        .from("profiles")
        .select("id,nickname,target_score,daily_study_hours,exam_date,weakest_area,current_level")
        .eq("id", userId)
        .single();

      if (profileRes.error) throw new Error(profileRes.error.message);
      setProfile(profileRes.data as Profile);

      const [readingRes, mathRes, dueRes, lbRes] = await Promise.all([
        supabase.rpc("get_skill_mastery", { p_subject: "Reading" }),
        supabase.rpc("get_skill_mastery", { p_subject: "Math" }),
        supabase.rpc("get_due_review_questions", { p_limit: 50 }),
        supabase.rpc("get_weekly_leaderboard"),
      ]);

      if (readingRes.error) throw new Error(readingRes.error.message);
      if (mathRes.error) throw new Error(mathRes.error.message);
      if (dueRes.error) throw new Error(dueRes.error.message);
      if (lbRes.error) throw new Error(lbRes.error.message);

      setSkillsReading((readingRes.data ?? []) as SkillRow[]);
      setSkillsMath((mathRes.data ?? []) as SkillRow[]);
      setDueReviewCount(((dueRes.data ?? []) as Question[]).length);
      setLeaderboard((lbRes.data ?? []) as LeaderEntry[]);
    } catch (e: any) {
      setErr(e?.message || "Failed to load coach.");
    } finally {
      setLoading(false);
    }
  }

  async function generateCoachNote() {
    if (aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const supabase = getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You need to sign in.");
      }

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(coachSnapshot),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate coach note.");
      }
      setAiCoach(data);
    } catch (e: any) {
      setAiError(e?.message || "Failed to generate coach note.");
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Coach"
        subtitle={`Personal strategist for ${nickname}. Use this page to understand what matters now.`}
        right={<Pill text="Strategist" tone="accent" />}
      />

      {loading && (
        <Card title="Loading…" subtitle="Building your strategist view">
          <div className="text-sm text-gray-600">Please wait.</div>
        </Card>
      )}

      {!loading && err && (
        <Card title="Error" subtitle="Coach could not load">
          <div className="text-sm text-red-600">{err}</div>
          <div className="mt-4 grid gap-3">
            <PrimaryButton onClick={load}>Try again</PrimaryButton>
            <SecondaryButton href="/today">Back to Today</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && (
        <div className="grid gap-4">
          <LoopRail
            active="Coach"
            note="Coach should interpret the loop, not replace it."
          />

          <Card
            title="Strategist note"
            subtitle="Personalized interpretation of your current training state."
            right={
              <Pill
                text={
                  aiCoach?.tone_label ??
                  (strategistNote.tone === "danger" ? "Urgent" : "Focused")
                }
                tone={
                  aiCoach?.tone_label === "Urgent"
                    ? "danger"
                    : aiCoach?.tone_label === "Rebuild"
                    ? "danger"
                    : "accent"
                }
              />
            }
            accent
          >
            <div className="rounded-2xl border border-[#c7dbff] bg-[#f6faff] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
                Personal strategist
              </div>
              {aiLoading ? (
                <div className="mt-3 text-sm text-gray-600">Generating strategist note…</div>
              ) : aiError ? (
                <div className="mt-3 text-sm text-red-600">{aiError}</div>
              ) : aiCoach ? (
                <>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-black">
                    {aiCoach.coach_note_title}
                  </div>
                  <div className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-700">
                    {aiCoach.coach_note_body}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-black">
                    {strategistNote.title}
                  </div>
                  <div className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-700">
                    {strategistNote.body}
                  </div>
                </>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={generateCoachNote}
                  disabled={aiLoading}
                  className="inline-flex items-center justify-center rounded-xl bg-[#004aad] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#003b88] disabled:opacity-60"
                >
                  {aiLoading
                    ? "Generating strategist note..."
                    : aiCoach
                    ? "Refresh strategist note"
                    : "Generate strategist note"}
                </button>
                <div className="flex items-center text-xs text-gray-500">
                  AI analysis is optional and may take 5-15 seconds.
                </div>
              </div>
            </div>
          </Card>

          {aiCoach && (
            <Card
              title="Top issues"
              subtitle="What is most likely holding performance back right now."
              right={<Pill text="AI interpretation" tone="accent" />}
            >
              <div className="grid gap-3">
                {aiCoach.top_issues.map((issue, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 p-4">
                    <div className="font-semibold text-black">{issue.title}</div>
                    <div className="mt-2 text-sm leading-relaxed text-gray-700">
                      {issue.detail}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card
              title="Best next action"
              subtitle="Do this before you start improvising."
              right={<Pill text="Now" tone="accent" />}
            >
              <div className="text-lg font-semibold text-black">{nextAction.title}</div>
              <div className="mt-2 text-sm leading-relaxed text-gray-700">
                {nextAction.description}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <PrimaryButton href={nextAction.primaryHref}>{nextAction.primaryLabel}</PrimaryButton>
                <SecondaryButton href={nextAction.secondaryHref}>{nextAction.secondaryLabel}</SecondaryButton>
              </div>
            </Card>

            <Card title="Context snapshot" subtitle="Supporting facts behind the recommendation.">
              <div className="grid gap-4 sm:grid-cols-2">
                <StatBox
                  label="Review due"
                  value={String(dueReviewCount)}
                  hint="Recovery pressure"
                  accent={dueReviewCount > 0}
                />
                <StatBox
                  label="Exam countdown"
                  value={
                    dleft === null
                      ? "Unset"
                      : dleft < 0
                      ? "Passed"
                      : dleft === 0
                      ? "Today"
                      : `${dleft}d`
                  }
                  hint="Based on profile date"
                />
                <StatBox
                  label="Stable weak areas"
                  value={String(stableWeakAreas.length)}
                  hint="At least 6 attempts"
                  accent={stableWeakAreas.length > 0}
                />
                <StatBox
                  label="Low-signal rows"
                  value={String(lowSignalCount)}
                  hint="Needs more evidence"
                />
              </div>

              {myLeague && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  League snapshot: rank #{myLeague.rank} with {myLeague.points} weekly points.
                </div>
              )}
            </Card>
          </div>

          <Card
            title="Your 3-step route"
            subtitle="Do not try to fix everything at once. Follow a sequence."
            right={<Pill text="Action plan" tone="accent" />}
          >
            <div className="grid gap-3">
              {threeStepPlan.map((item) => (
                <div key={item.step} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex items-start gap-4">
                    <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#c7dbff] bg-[#eef4ff] text-sm font-semibold text-[#004aad]">
                      {item.step}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold text-black">{item.title}</div>
                      <div className="mt-2 text-sm leading-relaxed text-gray-700">{item.text}</div>

                      <div className="mt-4 max-w-xs">
                        <PrimaryButton href={item.href}>{item.label}</PrimaryButton>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Strongest current concerns" subtitle="These are the weakest stable signals, not random low-sample noise.">
              {stableWeakAreas.length > 0 ? (
                <div className="grid gap-3">
                  {stableWeakAreas.map((row, i) => (
                    <div key={`${row.subskill}-${i}`} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold text-black">{row.subskill}</div>
                          <div className="mt-1 text-xs text-gray-600">
                            {row.domain} • {row.skill}
                          </div>
                          <div className="mt-2 text-sm text-gray-700">
                            {pct(row.accuracy)}% over {row.attempts} attempts • {confidenceLabel(row.attempts)} confidence
                          </div>
                        </div>

                        <Link
                          href={`/practice?subject=${skillsReading.includes(row) ? "Reading" : "Math"}&subskill=${encodeURIComponent(row.subskill)}`}
                          className="text-sm font-semibold text-[#004aad] underline hover:text-[#003b88]"
                        >
                          Repair
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-700">
                  No stable weak zones yet. Generate more evidence before trying to over-interpret the map.
                </div>
              )}
            </Card>

            <Card title="AI guardrails" subtitle="Keep the coach useful, grounded, and cheap.">
              <div className="text-sm leading-relaxed text-gray-700">
                This page is driven by deterministic performance logic first. AI should only explain the signals already present:
                due review, weak zones, sample size, and the next action.
              </div>

              <div className="mt-4 rounded-xl border border-[#d9e7ff] bg-[#f8fbff] p-4 text-sm text-gray-700">
                Guardrail: no score promises, no generic motivation, no broad chat. The output should make the next session clearer.
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <SecondaryButton href="/today">Back to Today</SecondaryButton>
                <SecondaryButton href="/skills">Open Skills</SecondaryButton>
              </div>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}
