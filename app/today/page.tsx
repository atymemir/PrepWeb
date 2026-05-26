'use client';
export const dynamic = 'force-dynamic';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "../lib/supabase";
import { errorMessage } from "../lib/errors";
import {
  confidenceLabel,
  pickWeakestAcrossSubjects,
  type SkillRow,
} from "../lib/learningSignals";
import { masteryFor, focusedPracticeHref, focusedLessonHref, subjectForTopic, type MasteryState } from "../lib/mastery";
import {
  pointsToNextDivision,
  type EngagementIdentity,
  type EngagementStatus,
} from "../lib/engagement";
import { normalizePlanTier, tierDefinition } from "../lib/productTiers";
import { getDurableEngagementSnapshot } from "../lib/engagementDurable";
import { Card, LoopRail, PageHeader, Pill, PrimaryButton, SecondaryButton } from "../ui/ui";

type Profile = {
  id: string;
  nickname: string | null;
  target_score: number | null;
  daily_study_hours: number | null;
  exam_date: string | null;
  weakest_area: string | null;
  current_level: string | null;
  plan_tier: string | null;
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

type Question = {
  id: string;
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

export default function TodayPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [skillsReading, setSkillsReading] = useState<SkillRow[]>([]);
  const [skillsMath, setSkillsMath] = useState<SkillRow[]>([]);
  const [dueReviewCount, setDueReviewCount] = useState<number>(0);
  const [identity, setIdentity] = useState<EngagementIdentity | null>(null);
  const [identityStatus, setIdentityStatus] = useState<EngagementStatus | null>(null);
  const [engagementNotice, setEngagementNotice] = useState<string | null>(null);

  const nickname = useMemo(() => profile?.nickname?.trim() || "Student", [profile]);
  const dleft = useMemo(() => daysUntil(profile?.exam_date ?? null), [profile]);
  const plan = useMemo(() => tierDefinition(normalizePlanTier(profile?.plan_tier ?? "free")), [profile?.plan_tier]);

  const countdownText = useMemo(() => {
    if (dleft === null) return "Set SAT date";
    if (dleft < 0) return "Update date";
    if (dleft === 0) return "SAT today";
    if (dleft === 1) return "1 day left";
    return `${dleft} days left`;
  }, [dleft]);

  const myRank = useMemo(() => {
    if (!profile) return null;
    const idx = leaderboard.findIndex((e) => e.user_id === profile.id);
    return idx === -1 ? null : idx + 1;
  }, [leaderboard, profile]);

  const myWeeklyPoints = useMemo(() => {
    if (!profile) return null;
    const me = leaderboard.find((e) => e.user_id === profile.id);
    return me ? Math.round(me.points) : null;
  }, [leaderboard, profile]);

  const weakestOverall = useMemo(() => {
    return pickWeakestAcrossSubjects(skillsReading, skillsMath);
  }, [skillsReading, skillsMath]);

  const weakestHref = useMemo(() => {
    if (!weakestOverall?.row?.subskill) return "/practice?subject=Reading";
    return focusedPracticeHref(weakestOverall.subject, weakestOverall.row.subskill, true);
  }, [weakestOverall]);

  const weakestLessonHref = useMemo(() => {
    if (!weakestOverall?.row?.subskill) return "/lessons";
    return focusedLessonHref(weakestOverall.row.subskill);
  }, [weakestOverall]);

  const completionRate = useMemo(() => {
    if (!identity || identity.totalSessions === 0) return null;
    return Math.round((identity.completedSessions / identity.totalSessions) * 100);
  }, [identity]);

  const masterySnapshot = useMemo(() => {
    const allRows = [...skillsReading, ...skillsMath];

    const counts = {
      Mastered: 0,
      Growing: 0,
      Unstable: 0,
      Untouched: 0,
    } as Record<MasteryState, number>;

    for (const row of allRows) {
      counts[masteryFor({ attempts: row.attempts, accuracy: row.accuracy })] += 1;
    }
    return counts;
  }, [skillsReading, skillsMath]);

  const unstableTargets = useMemo(() => {
    const merged = [
      ...skillsReading.map((row) => ({
        row,
        subject: subjectForTopic("Reading"),
        mastery: masteryFor({ attempts: row.attempts, accuracy: row.accuracy }),
      })),
      ...skillsMath.map((row) => ({
        row,
        subject: subjectForTopic("Math"),
        mastery: masteryFor({ attempts: row.attempts, accuracy: row.accuracy }),
      })),
    ]
      .filter((item) => item.mastery === "Unstable")
      .sort((a, b) => {
        const aAcc = a.row.accuracy ?? 0;
        const bAcc = b.row.accuracy ?? 0;
        if (aAcc !== bAcc) return aAcc - bAcc;
        if ((a.row.attempts ?? 0) !== (b.row.attempts ?? 0)) return b.row.attempts - a.row.attempts;
        return a.row.subskill.localeCompare(b.row.subskill);
      });

    return merged.slice(0, 3).map((item) => ({
      subject: item.subject,
      subskill: item.row.subskill,
      accuracyPct: Math.round((item.row.accuracy ?? 0) * 100),
      attempts: item.row.attempts,
      practiceHref: focusedPracticeHref(item.subject, item.row.subskill, true),
      lessonHref: focusedLessonHref(item.row.subskill),
    }));
  }, [skillsMath, skillsReading]);

  const priority = useMemo(() => {
    const firstSession = (identity?.totalSessions ?? 0) === 0;

    if (firstSession) {
      return {
        title: "Run your first signal block",
        reason:
          "Complete one focused 12-question practice block first. That unlocks reliable review pressure and mastery routing.",
        ctaHref: "/practice?subject=Reading",
        ctaLabel: "Start first practice",
        secondaryHref: "/practice?subject=Math",
        secondaryLabel: "Start with Math",
        pill: "First block",
      };
    }

    if (dueReviewCount > 0) {
      return {
        title: "Clear review first",
        reason:
          dueReviewCount === 1
            ? "You have 1 recovery item due. Review should come before more forward practice."
            : `You have ${dueReviewCount} recovery items due. Clear them before more forward practice.`,
        ctaHref: "/review",
        ctaLabel: "Start review",
        secondaryHref: weakestHref,
        secondaryLabel: "Skip to practice",
        pill: `${dueReviewCount} due`,
      };
    }

    if (weakestOverall?.row) {
      return {
        title: `Fix ${weakestOverall.row.subskill}`,
        reason: `Current weakest signal: ${Math.round(
          (weakestOverall.row.accuracy ?? 0) * 100
        )}% accuracy over ${weakestOverall.row.attempts} attempts in ${weakestOverall.subject}.`,
        ctaHref: weakestHref,
        ctaLabel: "Practice weakest",
        secondaryHref: weakestLessonHref,
        secondaryLabel: "Open lesson",
        pill: weakestOverall.subject,
      };
    }

    return {
      title: "Generate a clean signal",
      reason:
        "You need a little more data before weak-zone ranking becomes trustworthy. Run one focused set first.",
      ctaHref: "/practice?subject=Reading",
      ctaLabel: "Start practice",
      secondaryHref: "/skills",
      secondaryLabel: "Open skills",
      pill: "Fresh start",
    };
  }, [dueReviewCount, identity?.totalSessions, weakestOverall, weakestHref, weakestLessonHref]);

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

      let p = await supabase
        .from("profiles")
        .select("id,nickname,target_score,daily_study_hours,exam_date,weakest_area,current_level,plan_tier")
        .eq("id", userId)
        .single();

      if (p.error && String(p.error.message || "").toLowerCase().includes("plan_tier")) {
        p = await supabase
          .from("profiles")
          .select("id,nickname,target_score,daily_study_hours,exam_date,weakest_area,current_level")
          .eq("id", userId)
          .single();
      }

      if (p.error) throw new Error(p.error.message);
      const profileRow = p.data as Omit<Profile, "plan_tier"> & { plan_tier?: string | null };
      setProfile({
        ...profileRow,
        plan_tier: profileRow.plan_tier ?? "free",
      });

      try {
        const snapshot = await getDurableEngagementSnapshot();
        setIdentity(snapshot.identity);
        setIdentityStatus(snapshot.status);
        setEngagementNotice(null);
      } catch (engagementErr: unknown) {
        setIdentity(null);
        setIdentityStatus(null);
        setEngagementNotice(errorMessage(engagementErr, "Durable engagement backend is unavailable."));
      }

      const lb = await supabase.rpc("get_weekly_leaderboard");
      if (lb.error) throw new Error(lb.error.message);
      setLeaderboard((lb.data ?? []) as LeaderEntry[]);

      const sR = await supabase.rpc("get_skill_mastery", { p_subject: "Reading" });
      if (sR.error) throw new Error(sR.error.message);
      setSkillsReading((sR.data ?? []) as SkillRow[]);

      const sM = await supabase.rpc("get_skill_mastery", { p_subject: "Math" });
      if (sM.error) throw new Error(sM.error.message);
      setSkillsMath((sM.data ?? []) as SkillRow[]);

      const due = await supabase.rpc("get_due_review_questions", { p_limit: 50 });
      if (due.error) throw new Error(due.error.message);
      setDueReviewCount(((due.data ?? []) as Question[]).length);
    } catch (e: unknown) {
      setErr(errorMessage(e, "Failed to load Today."));
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch {}
    router.push("/login");
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
        label="Command Center"
        title="Today"
        subtitle={`Welcome, ${nickname} • ${countdownText}`}
        right={
          <button
            onClick={logout}
            className="text-sm font-semibold text-gray-600 hover:text-black underline"
          >
            Logout
          </button>
        }
      />

      {loading && (
        <Card title="Loading…" subtitle="Syncing your command center">
          <div className="text-sm text-gray-600">Please wait.</div>
        </Card>
      )}

      {!loading && err && (
        <Card title="Error" subtitle="Today could not load">
          <div className="text-sm text-red-600">{err}</div>
          <div className="mt-4 grid gap-3">
            <PrimaryButton onClick={load}>Try again</PrimaryButton>
            <SecondaryButton href="/profile">Profile</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && (
        <div className="grid gap-5">
          <LoopRail
            active={dueReviewCount > 0 ? "Review" : "Practice"}
            next={dueReviewCount > 0 ? "Review" : "Practice"}
            note={dueReviewCount > 0 ? "Clear debt first, then push forward." : "Push forward, then let review catch misses."}
          />

          {engagementNotice && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              {engagementNotice}
            </div>
          )}

          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] bg-[linear-gradient(145deg,#0f172a,#111827_46%,#0b1222)] shadow-xl">
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  Today mission
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{priority.title}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#d2dbec]">{priority.reason}</p>

                <div className="mt-6 grid gap-3 sm:max-w-xl sm:grid-cols-2">
                  <Link
                    href={priority.ctaHref}
                    className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0e1b34] transition hover:bg-[#ecf3ff]"
                  >
                    {priority.ctaLabel}
                  </Link>
                  <Link
                    href={priority.secondaryHref}
                    className="inline-flex items-center justify-center rounded-xl border border-[#4b628f] bg-white/5 px-4 py-3 text-sm font-semibold text-[#d7e3fb] transition hover:border-[#6f8ec7] hover:bg-white/10"
                  >
                    {priority.secondaryLabel}
                  </Link>
                </div>

                <div className="mt-6 h-2.5 rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${dueReviewCount > 0 ? "bg-[#8fc1ff]" : "bg-white"}`}
                    style={{ width: `${Math.max(14, Math.min(100, completionRate ?? 28))}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-[#c4cfe4]">
                  Session completion discipline: {completionRate ?? 0}%
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Recovery pressure</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight text-white">{dueReviewCount}</div>
                  <div className="mt-1 text-xs text-[#c5d1e8]">{dueReviewCount > 0 ? "Due now" : "Queue clear"}</div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Consistency</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight text-white">
                    {identity ? `${identity.streakDays}d` : "—"}
                  </div>
                  <div className="mt-1 text-xs text-[#c5d1e8]">
                    {identityStatus ? `${identityStatus.division.label} • L${identityStatus.level}` : "No status yet"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Mastery pressure</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight text-white">
                    {masterySnapshot.Unstable}
                  </div>
                  <div className="mt-1 text-xs text-[#c5d1e8]">Unstable subtopics</div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Current plan</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight text-white">
                    {plan.label}
                  </div>
                  <div className="mt-1 text-xs text-[#c5d1e8]">{plan.tagline}</div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-black/10 px-5 py-4 sm:px-6">
              <div className="grid gap-2 text-xs text-[#c5d1e8] sm:grid-cols-4">
                <div>
                  Unstable: <span className="font-semibold text-white">{masterySnapshot.Unstable}</span>
                </div>
                <div>
                  Growing: <span className="font-semibold text-white">{masterySnapshot.Growing}</span>
                </div>
                <div>
                  Mastered: <span className="font-semibold text-white">{masterySnapshot.Mastered}</span>
                </div>
                <div>
                  SAT window: <span className="font-semibold text-white">{countdownText}</span>
                </div>
              </div>
            </div>
          </section>

          {identity && identity.totalSessions === 0 && (
            <Card
              title="First-session route"
              subtitle="The fastest way to make this system useful."
              right={<Pill text="Start here" tone="accent" />}
              accent
            >
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">1. Practice</div>
                  <div className="mt-1 text-sm text-gray-700">Finish one full block for clean baseline signal.</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">2. Review</div>
                  <div className="mt-1 text-sm text-gray-700">Clear anything due so mistakes become active debt.</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">3. Skills</div>
                  <div className="mt-1 text-sm text-gray-700">Pick one weak subtopic and run targeted repair.</div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <PrimaryButton href="/practice?subject=Reading">Start first block</PrimaryButton>
                <SecondaryButton href="/practice?subject=Math">Start with Math</SecondaryButton>
              </div>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card
              title="Weakest live zone"
              subtitle="When review is clear, this is your highest-impact forward move."
              right={
                weakestOverall?.row ? (
                  <Pill text={`${confidenceLabel(weakestOverall.row.attempts)} confidence`} tone="accent" />
                ) : (
                  <Pill text="No signal yet" />
                )
              }
            >
              {weakestOverall?.row ? (
                <div className="grid gap-4">
                  <div>
                    <div className="text-xl font-semibold text-black">{weakestOverall.row.subskill}</div>
                    <div className="mt-1 text-sm text-gray-700">
                      {weakestOverall.subject} • {Math.round((weakestOverall.row.accuracy ?? 0) * 100)}% • n={weakestOverall.row.attempts}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <PrimaryButton href={weakestHref}>Practice weak zone</PrimaryButton>
                    <SecondaryButton href={weakestLessonHref}>Open lesson</SecondaryButton>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="text-sm text-gray-700">No stable weak-zone signal yet. Generate one fresh set.</div>
                  <PrimaryButton href="/practice?subject=Reading">Generate signal</PrimaryButton>
                </div>
              )}
            </Card>

            <Card title="Session pulse" subtitle="What changed most recently." accent>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-[#d4e5ff] bg-[#f3f8ff] p-4 text-sm text-gray-700">
                  Last block:
                  <span className="ml-1 font-semibold text-black">
                    {identity?.lastSession ? `${identity.lastSession.correct}/${identity.lastSession.answered}` : "No completed block yet"}
                  </span>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
                  Weekly points: <span className="font-semibold text-black">{myWeeklyPoints !== null ? myWeeklyPoints : "—"}</span>
                  <span className="mx-2 text-gray-300">•</span>
                  Rank <span className="font-semibold text-black">{myRank ? `#${myRank}` : "—"}</span>
                </div>
                {identity && identityStatus?.nextDivision && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
                    {pointsToNextDivision(identity)} XP to {identityStatus.nextDivision.label}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {unstableTargets.length > 0 && (
            <Card title="Subtopic strike list" subtitle="Run one precise repair route now.">
              <div className="grid gap-3">
                {unstableTargets.map((target, index) => (
                  <div key={`${target.subject}-${target.subskill}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-black">
                        #{index + 1} {target.subskill}
                      </div>
                      <Pill text={target.subject} tone="accent" />
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      {target.accuracyPct}% • n={target.attempts}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <SecondaryButton href={target.practiceHref}>Practice now</SecondaryButton>
                      <SecondaryButton href={target.lessonHref}>Open lesson</SecondaryButton>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex flex-wrap gap-3 text-sm">
            <Link className="inline-flex rounded-full border border-gray-300 bg-white px-3 py-2 font-semibold text-gray-700 hover:border-gray-400 hover:text-black" href="/review">
              Open recovery queue
            </Link>
            <Link className="inline-flex rounded-full border border-gray-300 bg-white px-3 py-2 font-semibold text-gray-700 hover:border-gray-400 hover:text-black" href="/history">
              Open history
            </Link>
            <Link className="inline-flex rounded-full border border-gray-300 bg-white px-3 py-2 font-semibold text-gray-700 hover:border-gray-400 hover:text-black" href="/skills">
              Open skills map
            </Link>
            <Link className="inline-flex rounded-full border border-gray-300 bg-white px-3 py-2 font-semibold text-gray-700 hover:border-gray-400 hover:text-black" href="/profile">
              Edit profile
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
