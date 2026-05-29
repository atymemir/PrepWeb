'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "../lib/supabase";
import { focusedLessonHref, focusedPracticeHref } from "../lib/mastery";
import { tierDefinition, tierTone, type PlanTier } from "../lib/productTiers";
import type { WeakSkillSignal } from "../lib/studentState";
import { useStudentState } from "../lib/useStudentState";
import { CoachStrategistCompanion } from "../components/PageVisualCompanions";
import { ActionDock, Card, LoopRail, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";

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

function coachHeadline(args: {
  dueReviewCount: number;
  weakestOverall: WeakSkillSignal | null;
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

  if (weakestOverall) {
    return {
      title: `Your best opportunity is ${weakestOverall.subskill}.`,
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
  const { state: studentState } = useStudentState({ dueLimit: 80, historyLimit: 64 });

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
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

  const nickname = studentState?.profile.nickname || "Student";
  const planTier = useMemo<PlanTier>(() => studentState?.profile.planTier ?? "free", [studentState?.profile.planTier]);
  const tier = useMemo(() => tierDefinition(planTier), [planTier]);
  const dleft = useMemo(() => daysUntil(studentState?.profile.examDate ?? null), [studentState?.profile.examDate]);

  const weakestOverall = studentState?.weakestSkill ?? null;

  const stableWeakAreas = useMemo(() => {
    return (studentState?.weakSkillTargets ?? [])
      .filter((row) => row.attempts >= 6)
      .slice(0, 3);
  }, [studentState?.weakSkillTargets]);

  const lowSignalCount = studentState?.lowSignalCount ?? 0;

  const myLeague = useMemo(() => {
    if (!viewerUserId) return null;
    const idx = leaderboard.findIndex((x) => x.user_id === viewerUserId);
    if (idx === -1) return null;
    return {
      rank: idx + 1,
      points: Math.round(leaderboard[idx].points),
    };
  }, [leaderboard, viewerUserId]);

  const activeDueReviewCount = studentState?.reviewDebt.dueCount ?? 0;

  const strategistNote = useMemo(() => {
    return coachHeadline({
      dueReviewCount: activeDueReviewCount,
      weakestOverall,
      dleft,
    });
  }, [activeDueReviewCount, weakestOverall, dleft]);

  const fallbackNextAction = useMemo(() => {
    if (activeDueReviewCount > 0) {
      return {
        title: "Clear the recovery queue",
        description: "Review is due. Do not stack new questions on top of unresolved mistakes.",
        primaryHref: "/review",
        primaryLabel: "Start review",
        secondaryHref: weakestOverall
          ? focusedPracticeHref(weakestOverall.subject, weakestOverall.subskill)
          : "/today",
        secondaryLabel: weakestOverall ? "Skip to weakest practice" : "Back to Today",
      };
    }

    if (weakestOverall) {
      return {
        title: `Repair ${weakestOverall.subskill}`,
        description: `Current weakest zone in ${weakestOverall.subject}: ${weakestOverall.accuracyPct}% over ${weakestOverall.attempts} attempts.`,
        primaryHref: focusedPracticeHref(weakestOverall.subject, weakestOverall.subskill),
        primaryLabel: "Practice weakest",
        secondaryHref: focusedLessonHref(weakestOverall.subskill),
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
  }, [activeDueReviewCount, weakestOverall]);

  const effectiveNextAction = useMemo(() => {
    if (!studentState) return fallbackNextAction;
    return {
      title: studentState.recommendedAction.title,
      description: `${studentState.recommendedAction.reason} ${studentState.recommendedAction.payoff}`,
      primaryHref: studentState.recommendedAction.primaryHref,
      primaryLabel: studentState.recommendedAction.primaryLabel,
      secondaryHref: studentState.recommendedAction.secondaryHref,
      secondaryLabel: studentState.recommendedAction.secondaryLabel,
    };
  }, [studentState, fallbackNextAction]);

  const coachSnapshot = useMemo(() => {
    return {
      nickname,
      examCountdownDays: dleft,
      dueReviewCount: activeDueReviewCount,
      weeklyRank: myLeague?.rank ?? null,
      weeklyPoints: myLeague?.points ?? null,
      stableWeakAreas: stableWeakAreas.map((row) => ({
        subject: row.subject,
        subskill: row.subskill,
        domain: row.domain,
        skill: row.skill,
        attempts: row.attempts,
        accuracy: row.accuracy,
      })),
      lowSignalCount,
      nextAction: effectiveNextAction,
    };
  }, [nickname, dleft, activeDueReviewCount, myLeague, stableWeakAreas, lowSignalCount, effectiveNextAction]);

  const threeStepPlan = useMemo(() => {
    if (activeDueReviewCount > 0 && weakestOverall) {
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
          title: `Target ${weakestOverall.subskill}`,
          text: "Immediately follow recovery with narrow repair on the weakest live signal.",
          href: focusedPracticeHref(weakestOverall.subject, weakestOverall.subskill),
          label: "Practice weakest",
        },
        {
          step: "3",
          title: "Lock the concept",
          text: "Use the lesson if the weakness is conceptual, not just execution-based.",
          href: focusedLessonHref(weakestOverall.subskill),
          label: "Open lesson",
        },
      ];
    }

    if (weakestOverall) {
      return [
        {
          step: "1",
          title: `Repair ${weakestOverall.subskill}`,
          text: "Your weakest live signal deserves first attention.",
          href: focusedPracticeHref(weakestOverall.subject, weakestOverall.subskill),
          label: "Practice weakest",
        },
        {
          step: "2",
          title: "Read the repair note",
          text: "If the problem is conceptual, use the lesson before repeating more questions.",
          href: focusedLessonHref(weakestOverall.subskill),
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
  }, [activeDueReviewCount, weakestOverall]);

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

      setViewerUserId(userId);

      const lbRes = await supabase.rpc("get_weekly_leaderboard");
      if (lbRes.error) throw new Error(lbRes.error.message);

      setLeaderboard((lbRes.data ?? []) as LeaderEntry[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load coach.");
    } finally {
      setLoading(false);
    }
  }

  async function generateCoachNote() {
    if (aiLoading) return;
    if (!tier.limits.coachAi) {
      setAiError("AI strategist is available on Pro and Ultimate.");
      return;
    }
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
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "Failed to generate coach note.");
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (!cancelled) await load();
    };

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen">
      <PageHeader
        label="Coach"
        title="Coach"
        subtitle={`Action guidance for ${nickname}. Start with one clear step.`}
        right={
          <div className="flex items-center gap-2">
            <Pill text={`${tier.label} plan`} tone={tierTone(planTier)} />
            <Pill text="Action mode" tone="accent" />
          </div>
        }
      />

      {loading && (
        <Card title="Loading coach" subtitle="Building your action view">
          <div className="space-y-2">
            <div className="state-skeleton h-3 w-2/3" />
            <div className="state-skeleton h-3 w-1/2" />
            <div className="state-skeleton h-24 w-full" />
          </div>
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
        <div className="grid gap-5">
          <LoopRail
            active="Coach"
            next={activeDueReviewCount > 0 ? "Review" : "Practice"}
            note="Coach should point to action, not replace practice."
          />

          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] bg-[linear-gradient(145deg,#0f172a,#111827_46%,#0b1222)] shadow-xl">
            <div className="p-5 sm:p-6">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  Do this now
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">{effectiveNextAction.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#d2dbec]">
                  {effectiveNextAction.description}
                </p>
                <div className="mt-5 grid gap-3 sm:max-w-xl sm:grid-cols-2">
                  <Link
                    href={effectiveNextAction.primaryHref}
                    className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0f1b33] transition hover:bg-[#ecf3ff]"
                  >
                    {effectiveNextAction.primaryLabel}
                  </Link>
                  <Link
                    href={effectiveNextAction.secondaryHref}
                    className="inline-flex items-center justify-center rounded-xl border border-[#506894] bg-white/5 px-4 py-3 text-sm font-semibold text-[#d7e3fb] transition hover:border-[#6f8ec7] hover:bg-white/10"
                  >
                    {effectiveNextAction.secondaryLabel}
                  </Link>
                </div>
              </div>

              <div className="mt-5">
                <CoachStrategistCompanion
                  due={activeDueReviewCount}
                  weakCount={stableWeakAreas.length}
                  aiWindow={tier.limits.coachAi ? `${tier.limits.coachRateLimitPer10Min}/10m` : "Locked"}
                  division={tier.label}
                />
              </div>
            </div>
          </section>

          {studentState && (
            <Card title="Why this matters" subtitle="Context from the same student state used across Today, Practice, and Review." right={<Pill text="State-based" tone="accent" />}>
              <div className="grid gap-2 sm:grid-cols-2">
                {studentState.contextualMessages.coach.slice(0, 4).map((message) => (
                  <div key={message.id} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
                    {message.text}
                    {message.actionHref && message.actionLabel && (
                      <div className="mt-2">
                        <Link href={message.actionHref} className="text-xs font-semibold text-[#004aad] underline">
                          {message.actionLabel}
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card
            title="Ask Coach"
            subtitle="Get a short answer with a clear next step."
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
                  Coach response
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
                {tier.limits.coachAi ? (
                  <>
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
                      Ask specific prompts, for example: What should I do in the next 25 minutes?
                    </div>
                  </>
                ) : (
                  <>
                    <Link
                      href="/pricing"
                      className="inline-flex items-center justify-center rounded-xl bg-[#004aad] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#003b88]"
                    >
                      Unlock AI strategist
                    </Link>
                    <div className="flex items-center text-xs text-gray-500">
                      Pro and Ultimate unlock coach generation.
                    </div>
                  </>
                )}
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
              title="Do this now"
              subtitle="Start here before anything else."
              right={<Pill text="Now" tone="accent" />}
              accent
            >
              <div className="text-lg font-semibold text-black">{effectiveNextAction.title}</div>
              <div className="mt-2 text-sm leading-relaxed text-gray-700">
                {effectiveNextAction.description}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <PrimaryButton href={effectiveNextAction.primaryHref}>{effectiveNextAction.primaryLabel}</PrimaryButton>
                <SecondaryButton href={effectiveNextAction.secondaryHref}>{effectiveNextAction.secondaryLabel}</SecondaryButton>
              </div>
            </Card>

            <Card title="Why this recommendation" subtitle="The data behind this next step." accent>
              <div className="grid gap-4 sm:grid-cols-2">
                <StatBox
                  label="Mistakes waiting"
                  value={String(activeDueReviewCount)}
                  hint="Recovery pressure"
                  accent={activeDueReviewCount > 0}
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
                  label="Low-data skills"
                  value={String(lowSignalCount)}
                  hint="Needs more evidence"
                />
              </div>

            </Card>
          </div>

          <Card
            title="What to do after"
            subtitle="Follow this sequence so your next session stays focused."
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
            <Card title="Skills that need attention" subtitle="These are stable weak areas, not random low-sample noise.">
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
                            {row.accuracyPct}% over {row.attempts} attempts • {row.confidence} confidence
                          </div>
                        </div>

                        <Link
                          href={focusedPracticeHref(row.subject, row.subskill)}
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

            <Card title="Ask Coach a specific question" subtitle="Short, specific prompts produce better action plans.">
              <div className="grid gap-2 text-sm leading-relaxed text-gray-700">
                <div>Use prompts tied to immediate execution, for example:</div>
                <div>- What should I do in the next 30 minutes?</div>
                <div>- Should I review first or run a timed set?</div>
                <div>- What should I do after this review block?</div>
              </div>

              <div className="mt-4 rounded-xl border border-[#d9e7ff] bg-[#f8fbff] p-4 text-sm text-gray-700">
                Guardrail: no score promises and no generic motivation. The answer should make the next action clearer.
              </div>
              <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
                Current plan: <span className="font-semibold text-black">{tier.label}</span>
                <span className="mx-2 text-gray-300">•</span>
                Coach AI:{" "}
                <span className="font-semibold text-black">
                  {tier.limits.coachAi ? `${tier.limits.coachRateLimitPer10Min} requests / 10m` : "Locked"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <SecondaryButton href="/today">Back to Today</SecondaryButton>
                <SecondaryButton href="/skills">Open Skills</SecondaryButton>
              </div>
            </Card>
          </div>
        </div>
      )}
      {!loading && !err && (
        <ActionDock
          title="Coach action"
          note={effectiveNextAction.description}
          primary={{ label: effectiveNextAction.primaryLabel, href: effectiveNextAction.primaryHref }}
          secondary={{ label: effectiveNextAction.secondaryLabel, href: effectiveNextAction.secondaryHref }}
        />
      )}
    </main>
  );
}
