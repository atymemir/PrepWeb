'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/app/lib/supabase";
import { getDurableEngagementSnapshot } from "@/app/lib/engagementDurable";
import { errorMessage } from "@/app/lib/errors";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton } from "@/app/ui/ui";

type SubjectTrack = "Reading" | "Math" | "Combined";

type ProfileRow = {
  id: string;
  nickname: string | null;
  target_score: number | null;
  exam_date: string | null;
};

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateInputToISO(dateStr: string): string | null {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

function clampTarget(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1400;
  return Math.max(800, Math.min(1600, Math.round(n)));
}

export default function WelcomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [totalSessions, setTotalSessions] = useState<number | null>(null);

  const [targetScore, setTargetScore] = useState("1400");
  const [examDate, setExamDate] = useState("");
  const [track, setTrack] = useState<SubjectTrack>("Reading");

  const nickname = useMemo(() => profile?.nickname?.trim() || "Student", [profile]);
  const isFirstSession = (totalSessions ?? 0) === 0;

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const supabase = getSupabase();
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw new Error(sessionErr.message);
      if (!sessionData.session) {
        router.push("/login?next=/welcome");
        return;
      }

      const userId = sessionData.session.user.id;

      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("id,nickname,target_score,exam_date")
        .eq("id", userId)
        .single();

      if (profileErr) throw new Error(profileErr.message);

      const row = profileData as ProfileRow;
      setProfile(row);
      setTargetScore(String(row.target_score ?? 1400));
      setExamDate(isoToDateInput(row.exam_date));

      try {
        const snapshot = await getDurableEngagementSnapshot();
        setTotalSessions(snapshot.identity.totalSessions ?? 0);
      } catch {
        setTotalSessions(null);
      }
    } catch (e: unknown) {
      setErr(errorMessage(e, "Failed to load onboarding."));
    } finally {
      setLoading(false);
    }
  }

  async function saveSetup() {
    if (!profile) return;

    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const supabase = getSupabase();
      const payload = {
        target_score: clampTarget(targetScore),
        exam_date: dateInputToISO(examDate),
      };

      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", profile.id);

      if (error) throw new Error(error.message);

      setMsg("Setup saved.");
      await load();
    } catch (e: unknown) {
      setErr(errorMessage(e, "Could not save setup."));
    } finally {
      setSaving(false);
    }
  }

  function startPractice() {
    router.push(`/practice?subject=${track}`);
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
        label="Onboarding"
        title="Welcome to alga"
        subtitle="Understand the loop, set your target, then launch your first serious block."
        right={<Pill text={isFirstSession ? "First session" : "Quick reset"} tone="accent" />}
      />

      {loading && (
        <Card title="Loading…" subtitle="Preparing your onboarding">
          <div className="text-sm text-gray-600">Please wait.</div>
        </Card>
      )}

      {!loading && err && (
        <Card title="Error" subtitle="Onboarding could not load">
          <div className="text-sm text-red-600">{err}</div>
          <div className="mt-4 grid gap-3 sm:max-w-md sm:grid-cols-2">
            <PrimaryButton onClick={() => void load()}>Try again</PrimaryButton>
            <SecondaryButton href="/today">Skip to Today</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && (
        <div className="grid gap-4">
          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#22345e] shadow-xl">
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#486399] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  20-second model
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">alga is your SAT execution system</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#d2dbec]">
                  Practice creates signal. Review clears debt. Skills and Lessons target weak zones. History proves movement. Coach keeps decisions sharp.
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <PrimaryButton onClick={startPractice}>Start first practice</PrimaryButton>
                  <SecondaryButton href="/today">Open Today mission</SecondaryButton>
                </div>
              </div>

              <div className="grid gap-2">
                {[
                  "Practice -> generate clear performance signal",
                  "Review -> recover due mistakes before new volume",
                  "Skills/Lessons -> repair one weak subtopic",
                  "History/Coach -> verify movement and next decision",
                ].map((line) => (
                  <div key={line} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-[#d9e6ff]">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <Card title="1-minute setup" subtitle={`Set only what matters, ${nickname}.`} accent>
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="grid gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Target score</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none"
                    value={targetScore}
                    onChange={(e) => setTargetScore(e.target.value)}
                    inputMode="numeric"
                  />
                  <div className="mt-1 text-xs text-gray-500">800-1600 goal (planning signal, not prediction).</div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">SAT date</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none"
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </div>

                <PrimaryButton onClick={() => void saveSetup()} disabled={saving}>
                  {saving ? "Saving…" : "Save setup"}
                </PrimaryButton>
                {msg && <div className="text-xs text-green-700">{msg}</div>}
              </div>

              <div className="rounded-2xl border border-[#c7dbff] bg-[#f6faff] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">Choose first track</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {(["Reading", "Math", "Combined"] as const).map((option) => {
                    const active = track === option;
                    return (
                      <button
                        key={option}
                        onClick={() => setTrack(option)}
                        className={[
                          "rounded-xl border px-3 py-3 text-sm font-semibold transition",
                          active
                            ? "border-[#0e1b34] bg-[#0e1b34] text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400",
                        ].join(" ")}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 text-xs text-gray-600">
                  {track === "Combined"
                    ? "Mixed block feels closer to test pressure."
                    : `${track} block gives cleaner early signal.`}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <PrimaryButton onClick={startPractice}>Start first 12Q block</PrimaryButton>
                  <SecondaryButton href="/today">Open Today mission</SecondaryButton>
                </div>
              </div>
            </div>
          </Card>

          <section className="rounded-2xl border border-gray-200 bg-white/92 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">Need product context first?</div>
            <div className="mt-2 text-sm text-gray-700">Read the short product model, then come back and launch your first session.</div>
            <div className="mt-3 grid gap-2 sm:max-w-md sm:grid-cols-2">
              <SecondaryButton href="/how-it-works">How alga works</SecondaryButton>
              <SecondaryButton href="/today">Skip onboarding</SecondaryButton>
            </div>
          </section>

          <div className="text-xs text-gray-500">
            Onboarding is intentionally short. The real product understanding comes from completing one full loop.
          </div>
        </div>
      )}
    </main>
  );
}
