'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/app/lib/supabase";

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
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [nickname, setNickname] = useState("");
  const [targetScore, setTargetScore] = useState("1400");
  const [dailyHours, setDailyHours] = useState("2");
  const [examDate, setExamDate] = useState("");

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
      const supabase = getSupabase();
      const userId = await ensureAuth();
      if (!userId) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("id,nickname,target_score,daily_study_hours,weakest_area,current_level,exam_date")
        .eq("id", userId)
        .single();

      if (error) throw new Error(error.message);

      const p = data as Profile;
      setProfile(p);
      setNickname(p.nickname ?? "");
      setTargetScore(String(p.target_score ?? 1400));
      setDailyHours(String(p.daily_study_hours ?? 2));
      setExamDate(isoToDateInput(p.exam_date));
    } catch (e: any) {
      setErr(e?.message || "Failed to load profile.");
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
      const supabase = getSupabase();

      const payload: Partial<Profile> = {
        nickname: nickname.trim() || null,
        target_score: Number.isFinite(Number(targetScore)) ? Number(targetScore) : 1400,
        daily_study_hours: Number.isFinite(Number(dailyHours)) ? Number(dailyHours) : 2,
        exam_date: dateInputToISO(examDate),
      };

      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", profile.id);

      if (error) throw new Error(error.message);

      setMsg("Saved.");
      await loadProfile();
    } catch (e: any) {
      setErr(e?.message || "Failed to save.");
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
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Profile</h1>
          <p className="text-sm text-gray-600 mt-1">Personalize your plan.</p>
        </div>
        <button onClick={logout} className="text-sm underline text-gray-700">
          Logout
        </button>
      </div>

      <div className="mt-6 rounded-2xl border bg-white shadow-sm">
        {loading && <div className="p-4 text-sm text-gray-600">Loading…</div>}
        {err && <div className="p-4 text-sm text-red-600">{err}</div>}
        {msg && <div className="p-4 text-sm text-green-700">{msg}</div>}

        {!loading && !err && (
          <div className="p-6 space-y-5">
            <div>
              <label className="text-sm font-medium">Nickname</label>
              <input
                className="mt-2 w-full rounded-lg border p-3"
                placeholder="Student"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Target score</label>
                <input
                  className="mt-2 w-full rounded-lg border p-3"
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Study hours/day</label>
                <input
                  className="mt-2 w-full rounded-lg border p-3"
                  value={dailyHours}
                  onChange={(e) => setDailyHours(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">SAT date</label>
              <input
                className="mt-2 w-full rounded-lg border p-3"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
              <div className="text-xs text-gray-500 mt-2">
                Used for countdown and urgency.
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="w-full rounded-lg bg-black text-white py-3 font-medium disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}