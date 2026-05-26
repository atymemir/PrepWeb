'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "../lib/supabase";
import { errorMessage } from "../lib/errors";
import {
  pointsToNextDivision,
  type EngagementIdentity,
  type EngagementStatus,
} from "../lib/engagement";
import { getDurableEngagementSnapshot } from "../lib/engagementDurable";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";
import { IdentityStatusCard } from "../components/EngagementSystem";

type Profile = {
  id: string;
  nickname: string | null;
  target_score: number | null;
  daily_study_hours: number | null;
  weakest_area: string | null;
  current_level: string | null;
  exam_date: string | null;
};

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateInputToISO(dateStr: string): string | null {
  if (!dateStr) return null;
  // store as UTC midnight
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function clampNumberString(v: string, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [identity, setIdentity] = useState<EngagementIdentity | null>(null);
  const [identityStatus, setIdentityStatus] = useState<EngagementStatus | null>(null);
  const [engagementNotice, setEngagementNotice] = useState<string | null>(null);

  // editable fields
  const [nickname, setNickname] = useState("");
  const [targetScore, setTargetScore] = useState("1400");
  const [dailyHours, setDailyHours] = useState("2");
  const [examDate, setExamDate] = useState(""); // YYYY-MM-DD

  const daysLeft = useMemo(() => daysUntil(profile?.exam_date ?? null), [profile]);
  const countdownText = useMemo(() => {
    if (daysLeft === null) return "Set SAT date";
    if (daysLeft < 0) return "Update date";
    if (daysLeft === 0) return "SAT today";
    if (daysLeft === 1) return "1 day left";
    return `${daysLeft} days left`;
  }, [daysLeft]);

  const displayName = useMemo(() => nickname.trim() || profile?.nickname?.trim() || "Student", [nickname, profile]);

  async function ensureAuth(): Promise<string | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    if (!data.session) {
      router.push("/login");
      return null;
    }
    return data.session.user.id;
  }

  async function loadProfile() {
    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const userId = await ensureAuth();
      if (!userId) return;

      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nickname,target_score,daily_study_hours,weakest_area,current_level,exam_date")
        .eq("id", userId)
        .single();

      if (error) throw new Error(error.message);

      const p = data as Profile;
      setProfile(p);

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

      setNickname(p.nickname ?? "");
      setTargetScore(String(p.target_score ?? 1400));
      setDailyHours(String(p.daily_study_hours ?? 2));
      setExamDate(isoToDateInput(p.exam_date));
    } catch (e: unknown) {
      setErr(errorMessage(e, "Failed to load profile."));
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!profile) return;

    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const payload: Partial<Profile> = {
        nickname: nickname.trim() || null,
        target_score: clampNumberString(targetScore, 800, 1600, 1400),
        daily_study_hours: clampNumberString(dailyHours, 0, 12, 2),
        exam_date: dateInputToISO(examDate),
      };

      const supabase = getSupabase();
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", profile.id);

      if (error) throw new Error(error.message);

      setMsg("Saved.");
      await loadProfile();
    } catch (e: unknown) {
      setErr(errorMessage(e, "Save failed."));
    } finally {
      setSaving(false);
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
      if (!cancelled) await loadProfile();
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
        title="Profile"
        subtitle="Personalize your plan. Keep it honest and simple."
        right={
          <button onClick={logout} className="text-sm font-semibold text-gray-600 hover:text-black underline">
            Logout
          </button>
        }
      />

      <Card
        title="Your plan"
        subtitle="These settings drive your Today dashboard and urgency."
        right={<Pill text={countdownText} />}
      >
        {loading && <div className="text-sm text-gray-600">Loading…</div>}

        {!loading && err && (
          <div>
            <div className="text-sm text-red-600">{err}</div>
            <div className="mt-4 grid gap-3">
              <PrimaryButton onClick={loadProfile}>Try again</PrimaryButton>
              <SecondaryButton href="/today">Back to Today</SecondaryButton>
            </div>
          </div>
        )}

        {!loading && !err && (
          <div className="grid gap-4">
            {identity && identityStatus && (
              <IdentityStatusCard
                identity={identity}
                status={identityStatus}
                title="Personal status"
                subtitle={`${identityStatus.division.label} • Level ${identityStatus.level}`}
                note="Your engagement identity updates when you complete practice or review blocks."
              />
            )}

            {engagementNotice && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                {engagementNotice}
              </div>
            )}

            {identity && identityStatus?.nextDivision && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
                {pointsToNextDivision(identity)} XP to {identityStatus.nextDivision.label}.
                Keep daily streak quality by clearing due review before stacking fresh practice.
              </div>
            )}

            {msg && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                {msg}
              </div>
            )}

            {/* Quick summary row */}
            <div className="grid grid-cols-2 gap-4">
              <StatBox label="Name" value={displayName} hint="Shown in community" />
              <StatBox label="Target" value={`${clampNumberString(targetScore, 800, 1600, 1400)}`} hint="Goal (not prediction)" />
            </div>

            {/* Form */}
            <div>
              <label className="text-sm font-semibold text-gray-700">Nickname</label>
              <input
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                placeholder="Student"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700">Target score</label>
                <input
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value)}
                  inputMode="numeric"
                />
                <div className="mt-2 text-xs text-gray-500">800–1600. This is a goal, not a prediction.</div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Study hours/day</label>
                <input
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  value={dailyHours}
                  onChange={(e) => setDailyHours(e.target.value)}
                  inputMode="numeric"
                />
                <div className="mt-2 text-xs text-gray-500">0–12 hours. Keep it realistic.</div>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">SAT date</label>
              <input
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
              <div className="mt-2 text-xs text-gray-500">Used for countdown and urgency.</div>
            </div>

            <div className="grid gap-3">
              <PrimaryButton onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </PrimaryButton>
              <SecondaryButton href="/today">Back to Today</SecondaryButton>
            </div>

            <div className="flex gap-4 text-sm">
              <a className="underline text-gray-700 hover:text-black" href="/skills">Skills</a>
              <a className="underline text-gray-700 hover:text-black" href="/leagues">Community</a>
              <a className="underline text-gray-700 hover:text-black" href="/review">Review</a>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
