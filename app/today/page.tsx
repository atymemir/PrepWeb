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
import {
  pointsToNextDivision,
  type EngagementIdentity,
  type EngagementStatus,
} from "../lib/engagement";
import { getDurableEngagementSnapshot } from "../lib/engagementDurable";
import { Card, LoopRail, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";
import { IdentityStatusCard } from "../components/EngagementSystem";

type Profile = {
  id: string;
  nickname: string | null;
  target_score: number | null;
  daily_study_hours: number | null;
  exam_date: string | null;
  weakest_area: string | null;
  current_level: string | null;
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
    return `/practice?subject=${weakestOverall.subject}&subskill=${encodeURIComponent(
      weakestOverall.row.subskill
    )}`;
  }, [weakestOverall]);

  const weakestLessonHref = useMemo(() => {
    if (!weakestOverall?.row?.subskill) return "/lessons";
    return `/lesson/${encodeURIComponent(weakestOverall.row.subskill)}`;
  }, [weakestOverall]);

  const completionRate = useMemo(() => {
    if (!identity || identity.totalSessions === 0) return null;
    return Math.round((identity.completedSessions / identity.totalSessions) * 100);
  }, [identity]);

  const dailyMission = useMemo(() => {
    if (dueReviewCount > 0) {
      return {
        title: "Protect streak quality",
        note: "Clear due review first so daily consistency reflects real recovery, not only new attempts.",
        actionLabel: "Start review now",
        actionHref: "/review",
      };
    }

    if (weakestOverall?.row) {
      return {
        title: `Push ${weakestOverall.row.subskill}`,
        note: "Run a focused block on your weakest current signal, then let review schedule the misses.",
        actionLabel: "Target weak zone",
        actionHref: weakestHref,
      };
    }

    return {
      title: "Start a clean block",
      note: "Generate one fresh session today to keep identity momentum active.",
      actionLabel: "Open practice",
      actionHref: "/practice?subject=Reading",
    };
  }, [dueReviewCount, weakestOverall, weakestHref]);

  const priority = useMemo(() => {
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
  }, [dueReviewCount, weakestOverall, weakestHref, weakestLessonHref]);

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

      const p = await supabase
        .from("profiles")
        .select("id,nickname,target_score,daily_study_hours,exam_date,weakest_area,current_level")
        .eq("id", userId)
        .single();

      if (p.error) throw new Error(p.error.message);
      setProfile(p.data as Profile);

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
  <div className="grid gap-4">
    <LoopRail
      active={dueReviewCount > 0 ? "Review" : weakestOverall?.row ? "Practice" : "Practice"}
      note={
        dueReviewCount > 0
          ? "Recovery comes before fresh volume."
          : "Use today to generate signal, repair one weak zone, then let review catch misses."
      }
    />

    {identity && identityStatus && (
      <IdentityStatusCard
        identity={identity}
        status={identityStatus}
        title="Daily identity"
        subtitle={`${identityStatus.division.label} • Level ${identityStatus.level} • ${identity.streakDays}d streak`}
        note="This layer tracks completion discipline, accuracy, and consistency across every practice and review block."
      />
    )}

    {engagementNotice && (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        {engagementNotice}
      </div>
    )}

    <Card
      title="Daily mission"
      subtitle="One clear return reason every day: protect streak quality, then move your weak zone."
      right={<Pill text={dueReviewCount > 0 ? "Recovery pressure" : "Forward pressure"} tone="accent" />}
      accent
      prominence="prominent"
    >
      <div className="rounded-2xl border border-[#c7dbff] bg-[#f6faff] p-5">
        <div className="label label-accent">Mission</div>
        <div className="mt-2 text-2xl font-semibold tracking-tight text-black">{dailyMission.title}</div>
        <div className="mt-3 text-sm leading-relaxed text-gray-700">{dailyMission.note}</div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <PrimaryButton href={dailyMission.actionHref}>{dailyMission.actionLabel}</PrimaryButton>
          <SecondaryButton href="/leagues">Open community pressure</SecondaryButton>
        </div>

        {identity && identityStatus && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700">
              Streak guard: <span className="font-semibold text-black">{identity.streakDays}d</span>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700">
              Completion rate: <span className="font-semibold text-black">{completionRate ?? 0}%</span>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700">
              {identityStatus.nextDivision
                ? `${pointsToNextDivision(identity)} XP to ${identityStatus.nextDivision.label}`
                : "Top division reached"}
            </div>
          </div>
        )}
      </div>
    </Card>

    <Card
      title="Today’s priority"
      subtitle="One best next action for this session."
      right={<Pill text={priority.pill} tone="accent" />}
      accent
    >
      <div className="rounded-2xl border border-[#c7dbff] bg-[#f6faff] p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
          Priority
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight text-black">
          {priority.title}
        </div>
        <div className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-700">
          {priority.reason}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <PrimaryButton href={priority.ctaHref}>{priority.ctaLabel}</PrimaryButton>
          <SecondaryButton href={priority.secondaryHref}>{priority.secondaryLabel}</SecondaryButton>
        </div>
      </div>
    </Card>

    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <Card
        title="Recovery status"
        subtitle="Spaced review protects against repeated mistakes."
        right={
          <Pill
            text={dueReviewCount > 0 ? `${dueReviewCount} due` : "Clear"}
            tone={dueReviewCount > 0 ? "accent" : "success"}
          />
        }
      >
        <div className="text-sm leading-relaxed text-gray-700">
          {dueReviewCount > 0
            ? "Review is active. Clear due items now so mistakes do not stay live while you push forward."
            : "Nothing is due right now. That means you are free to focus on fresh practice or targeted repair."}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {dueReviewCount > 0 ? (
            <PrimaryButton href="/review">Open review</PrimaryButton>
          ) : (
            <SecondaryButton href="/review">Check review</SecondaryButton>
          )}
          <SecondaryButton href="/practice?subject=Reading">Start practice</SecondaryButton>
        </div>
      </Card>

      <Card
        title="Weak zone"
        subtitle="The weakest current signal across tracked subskills."
        right={
          weakestOverall?.row ? (
            <Pill text={`${confidenceLabel(weakestOverall.row.attempts)} confidence`} tone="accent" />
          ) : (
            <Pill text="No signal yet" />
          )
        }
      >
        {weakestOverall?.row ? (
          <>
            <div className="text-lg font-semibold text-black">{weakestOverall.row.subskill}</div>
            <div className="mt-1 text-sm text-gray-700">
              {weakestOverall.subject} • {weakestOverall.row.domain} • {weakestOverall.row.skill}
            </div>
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              {Math.round((weakestOverall.row.accuracy ?? 0) * 100)}% accuracy over{" "}
              {weakestOverall.row.attempts} attempts.
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <PrimaryButton href={weakestHref}>Practice this</PrimaryButton>
              <SecondaryButton href={weakestLessonHref}>Open lesson</SecondaryButton>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-gray-700">
              You do not have enough data yet for reliable weak-zone ranking.
            </div>
            <div className="mt-5 grid gap-3">
              <PrimaryButton href="/practice?subject=Reading">Generate signal</PrimaryButton>
            </div>
          </>
        )}
      </Card>
    </div>

    <Card title="Weekly snapshot" subtitle="Support metrics, not the main decision layer.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox
          label="Weekly points"
          value={myWeeklyPoints !== null ? String(myWeeklyPoints) : "—"}
          hint="Practice + review, weighted by accuracy"
          accent
        />
        <StatBox
          label="Global rank"
          value={myRank ? `#${myRank}` : "—"}
          hint="League position this week"
        />
        <StatBox
          label="Review due"
          value={String(dueReviewCount)}
          hint="Current recovery pressure"
          accent={dueReviewCount > 0}
        />
        <StatBox
          label="Countdown"
          value={countdownText}
          hint="Based on your SAT date"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-4 text-sm">
        <Link className="underline text-gray-700 hover:text-black" href="/skills">
          Open skills map
        </Link>
        <Link className="underline text-gray-700 hover:text-black" href="/lessons">
          Open lessons
        </Link>
        <Link className="underline text-gray-700 hover:text-black" href="/profile">
          Edit profile
        </Link>
      </div>
    </Card>
  </div>
)}
    </main>
  );
}
