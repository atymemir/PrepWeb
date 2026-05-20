'use client';
export const dynamic = 'force-dynamic';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/app/lib/supabase";

type Profile = {
  id: string;
  nickname: string | null;
  target_score: number | null;
  daily_study_hours: number | null;
  exam_date: string | null; // timestamptz
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

export default function TodayPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [skillsReading, setSkillsReading] = useState<SkillRow[]>([]);
  const [skillsMath, setSkillsMath] = useState<SkillRow[]>([]);
  const [subjectFocus, setSubjectFocus] = useState<"Reading" | "Math">("Reading");

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

  const weakestReading = useMemo(() => {
    if (!skillsReading.length) return null;
    const sorted = [...skillsReading].sort((a, b) => {
      const aScore = (a.accuracy ?? 0) + (a.attempts < 6 ? 0.15 : 0);
      const bScore = (b.accuracy ?? 0) + (b.attempts < 6 ? 0.15 : 0);
      if (aScore !== bScore) return aScore - bScore;
      return b.attempts - a.attempts;
    });
    return sorted[0];
  }, [skillsReading]);

  const weakestMath = useMemo(() => {
    if (!skillsMath.length) return null;
    const sorted = [...skillsMath].sort((a, b) => {
      const aScore = (a.accuracy ?? 0) + (a.attempts < 6 ? 0.15 : 0);
      const bScore = (b.accuracy ?? 0) + (b.attempts < 6 ? 0.15 : 0);
      if (aScore !== bScore) return aScore - bScore;
      return b.attempts - a.attempts;
    });
    return sorted[0];
  }, [skillsMath]);

  const weakest = subjectFocus === "Reading" ? weakestReading : weakestMath;

  const practiceHref = useMemo(() => {
    if (weakest?.subskill) {
      return `/practice?subject=${subjectFocus}&subskill=${encodeURIComponent(weakest.subskill)}`;
    }
    return `/practice?subject=${subjectFocus}`;
  }, [weakest, subjectFocus]);

  async function loadAll() {
    setLoading(true);
    setErr(null);

    try {
      const supabase = getSupabase(); // ✅ only inside function

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
      const prof = p.data as Profile;
      setProfile(prof);

      const lb = await supabase.rpc("get_weekly_leaderboard");
      if (lb.error) throw new Error(lb.error.message);
      setLeaderboard((lb.data ?? []) as LeaderEntry[]);

      const sR = await supabase.rpc("get_skill_mastery", { p_subject: "Reading" });
      if (sR.error) throw new Error(sR.error.message);
      setSkillsReading((sR.data ?? []) as SkillRow[]);

      const sM = await supabase.rpc("get_skill_mastery", { p_subject: "Math" });
      if (sM.error) throw new Error(sM.error.message);
      setSkillsMath((sM.data ?? []) as SkillRow[]);

      const w = prof?.weakest_area?.toLowerCase() ?? "";
      setSubjectFocus(w.includes("read") ? "Reading" : "Math");

    } catch (e: any) {
      setErr(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      const supabase = getSupabase(); // ✅ only inside function
      await supabase.auth.signOut();
    } catch {}
    router.push("/login");
  }

  useEffect(() => {
    // ✅ supabase called only inside loadAll
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Today</h1>
          <p className="text-sm text-gray-600 mt-1">
            Welcome, <span className="font-medium">{nickname}</span> • {countdownText}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadAll} className="text-sm underline text-gray-700">Refresh</button>
          <button onClick={logout} className="text-sm underline text-gray-700">Logout</button>
        </div>
      </div>

      {loading && (
        <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-gray-600 shadow-sm">
          Loading…
        </div>
      )}

      {err && (
        <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-red-600 shadow-sm">
          {err}
        </div>
      )}

      {!loading && !err && (
        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-gray-700">Recommended next</div>
                <div className="mt-1 text-xl font-semibold">
                  {weakest ? `Fix ${weakest.subskill}` : `Start ${subjectFocus} practice`}
                </div>

                <div className="mt-2 text-sm text-gray-600">
                  {weakest ? (
                    <>
                      Accuracy {Math.round((weakest.accuracy ?? 0) * 100)}% (n={weakest.attempts}) • Confidence{" "}
                      {confidenceLabel(weakest.attempts)}
                    </>
                  ) : (
                    <>Do one clean 12-question set to generate useful signals.</>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    className={`px-3 py-2 rounded-lg border text-sm ${subjectFocus === "Reading" ? "bg-black text-white" : "bg-white"}`}
                    onClick={() => setSubjectFocus("Reading")}
                  >
                    Reading
                  </button>
                  <button
                    className={`px-3 py-2 rounded-lg border text-sm ${subjectFocus === "Math" ? "bg-black text-white" : "bg-white"}`}
                    onClick={() => setSubjectFocus("Math")}
                  >
                    Math
                  </button>
                </div>

                <Link
                  className="rounded-lg bg-black text-white py-3 px-4 font-medium text-center"
                  href={practiceHref}
                >
                  Practice 12Q
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-gray-700">This week</div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div className="rounded-xl border p-4">
                <div className="text-xs text-gray-600">Weekly points</div>
                <div className="text-2xl font-semibold mt-1">{myWeeklyPoints ?? "—"}</div>
                <div className="text-xs text-gray-500 mt-1">Answered + review, adjusted by accuracy</div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-xs text-gray-600">Global rank</div>
                <div className="text-2xl font-semibold mt-1">{myRank ? `#${myRank}` : "—"}</div>
                <div className="text-xs text-gray-500 mt-1">Based on weekly points</div>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <Link className="text-sm underline" href="/leagues">Open leagues</Link>
              <Link className="text-sm underline" href="/skills">Open skills map</Link>
              <Link className="text-sm underline" href="/profile">Edit profile</Link>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-gray-700">Quick actions</div>
            <div className="mt-3 grid gap-3">
              <Link className="rounded-xl border p-4 hover:bg-gray-50" href="/practice?subject=Reading">
                Start Reading (12Q)
              </Link>
              <Link className="rounded-xl border p-4 hover:bg-gray-50" href="/practice?subject=Math">
                Start Math (12Q)
              </Link>
              {weakest && (
                <Link className="rounded-xl border p-4 hover:bg-gray-50" href={practiceHref}>
                  Practice weakest now: <span className="font-medium">{weakest.subskill}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}