'use client';
export const dynamic = 'force-dynamic';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "../lib/supabase";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";

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
  accuracy: number; // 0..1
  points: number;
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

function pickWeakest(rows: SkillRow[]): SkillRow | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => {
    const aScore = (a.accuracy ?? 0) + (a.attempts < 6 ? 0.15 : 0);
    const bScore = (b.accuracy ?? 0) + (b.attempts < 6 ? 0.15 : 0);
    if (aScore !== bScore) return aScore - bScore;
    return b.attempts - a.attempts;
  });
  return sorted[0] ?? null;
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
    const idx = leaderboard.findIndex(e => e.user_id === profile.id);
    if (idx === -1) return null;
    return idx + 1;
  }, [leaderboard, profile]);

  const myWeeklyPoints = useMemo(() => {
    if (!profile) return null;
    const me = leaderboard.find(e => e.user_id === profile.id);
    return me ? Math.round(me.points) : null;
  }, [leaderboard, profile]);

  const subjectFocus = useMemo<"Reading" | "Math">(() => {
    const w = (profile?.weakest_area ?? "").toLowerCase();
    return w.includes("read") ? "Reading" : "Math";
  }, [profile]);

  const weakest = useMemo(() => {
    return subjectFocus === "Reading"
      ? pickWeakest(skillsReading)
      : pickWeakest(skillsMath);
  }, [skillsReading, skillsMath, subjectFocus]);

  const nextPracticeHref = useMemo(() => {
    if (weakest?.subskill) {
      return `/practice?subject=${subjectFocus}&subskill=${encodeURIComponent(weakest.subskill)}`;
    }
    return `/practice?subject=${subjectFocus}`;
  }, [weakest, subjectFocus]);

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

      // Profile
      const p = await supabase
        .from("profiles")
        .select("id,nickname,target_score,daily_study_hours,exam_date,weakest_area,current_level")
        .eq("id", userId)
        .single();

      if (p.error) throw new Error(p.error.message);
      setProfile(p.data as Profile);

      // Weekly leaderboard
      const lb = await supabase.rpc("get_weekly_leaderboard");
      if (lb.error) throw new Error(lb.error.message);
      setLeaderboard((lb.data ?? []) as LeaderEntry[]);

      // Skills mastery
      const sR = await supabase.rpc("get_skill_mastery", { p_subject: "Reading" });
      if (sR.error) throw new Error(sR.error.message);
      setSkillsReading((sR.data ?? []) as SkillRow[]);

      const sM = await supabase.rpc("get_skill_mastery", { p_subject: "Math" });
      if (sM.error) throw new Error(sM.error.message);
      setSkillsMath((sM.data ?? []) as SkillRow[]);

      // Review due count (simple: ask for up to 50 and count)
      const due = await supabase.rpc("get_due_review_questions", { p_limit: 50 });
      if (due.error) throw new Error(due.error.message);
      const dueList = (due.data ?? []) as Question[];
      setDueReviewCount(dueList.length);

    } catch (e: any) {
      setErr(e?.message || "Failed to load Today.");
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Today"
        subtitle={`Welcome, ${nickname} • ${countdownText}`}
        right={
          <button onClick={logout} className="text-sm font-semibold text-gray-600 hover:text-black underline">
            Logout
          </button>
        }
      />

      {loading && (
        <Card title="Loading…" subtitle="Syncing your dashboard">
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
          {/* 1) Review due */}
          <Card
            title="Review due now"
            subtitle="Spaced repetition — clear what’s scheduled."
            right={<Pill text={dueReviewCount > 0 ? `${dueReviewCount} due` : "0 due"} />}
          >
            <div className="text-sm text-gray-700">
              {dueReviewCount > 0
                ? `You have ${dueReviewCount} questions scheduled. Clear them to keep mistakes from sticking.`
                : "Nothing is due right now. Good. New mistakes will show up here after practice."}
            </div>

            <div className="mt-4 grid gap-3">
              {dueReviewCount > 0 ? (
                <PrimaryButton href="/review">Start review</PrimaryButton>
              ) : (
                <SecondaryButton href="/review">Open review</SecondaryButton>
              )}
            </div>
          </Card>

          {/* 2) Recommended next */}
          <Card
            title="Recommended next"
            subtitle="Based on your weakest subskill."
            right={<Pill text={subjectFocus} />}
          >
            <div className="text-sm text-gray-700">
              {weakest ? (
                <>
                  Fix <span className="font-semibold">{weakest.subskill}</span> — accuracy{" "}
                  <span className="font-semibold">{Math.round((weakest.accuracy ?? 0) * 100)}%</span>{" "}
                  (n={weakest.attempts}) • confidence {confidenceLabel(weakest.attempts)}.
                </>
              ) : (
                "Do one clean 12Q set to generate useful skill signals."
              )}
            </div>

            <div className="mt-4 grid gap-3">
              <PrimaryButton href={nextPracticeHref}>Practice 12Q</PrimaryButton>
              <SecondaryButton href="/skills">Open skills map</SecondaryButton>
            </div>
          </Card>

          {/* 3) This week */}
          <Card title="This week" subtitle="Your weekly activity snapshot.">
            <div className="grid grid-cols-2 gap-4">
              <StatBox
                label="Weekly points"
                value={myWeeklyPoints !== null ? String(myWeeklyPoints) : "—"}
                hint="Practice + review, adjusted by accuracy"
              />
              <StatBox
                label="Global rank"
                value={myRank ? `#${myRank}` : "—"}
                hint="Based on weekly points"
              />
            </div>

            <div className="mt-4 flex gap-4 text-sm">
              <Link className="underline text-gray-700 hover:text-black" href="/leagues">Open leagues</Link>
              <Link className="underline text-gray-700 hover:text-black" href="/practice?subject=Reading">Practice</Link>
              <Link className="underline text-gray-700 hover:text-black" href="/profile">Edit profile</Link>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}