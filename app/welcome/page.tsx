'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/app/lib/supabase";
import { getDurableEngagementSnapshot } from "@/app/lib/engagementDurable";
import { errorMessage } from "@/app/lib/errors";
import BrandWordmark from "@/app/components/BrandWordmark";
import VisualAnchorPanel from "@/app/components/VisualAnchorPanel";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton } from "@/app/ui/ui";

type SubjectTrack = "Reading" | "Math" | "Combined";
type ExamType = "sat" | "ap" | "both";
type StudyMode = "guided" | "free";

type ProfileRow = {
  id: string;
  nickname: string | null;
  target_score: number | null;
  exam_date: string | null;
  daily_study_hours: number | null;
  weakest_area: string | null;
  current_level: string | null;
};

type OnboardingPrefs = {
  examType: ExamType;
  targetOutcome: string;
  studyMode: StudyMode;
  completedAt?: string;
};

const ONBOARDING_KEY = "alga-prep-onboarding-v1";

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

function readPrefs(): OnboardingPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingPrefs;
  } catch {
    return null;
  }
}

function writePrefs(value: OnboardingPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(value));
}

export default function WelcomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [totalSessions, setTotalSessions] = useState<number | null>(null);

  const [examType, setExamType] = useState<ExamType>("sat");
  const [targetScore, setTargetScore] = useState("1400");
  const [targetOutcome, setTargetOutcome] = useState("AP 5");
  const [examDate, setExamDate] = useState("");
  const [studyMode, setStudyMode] = useState<StudyMode>("guided");
  const [track, setTrack] = useState<SubjectTrack>("Reading");
  const [dailyHours, setDailyHours] = useState("2");
  const [currentLevel, setCurrentLevel] = useState("Not sure yet");
  const [weakArea, setWeakArea] = useState("");

  const nickname = useMemo(() => profile?.nickname?.trim() || "Student", [profile]);
  const isFirstSession = (totalSessions ?? 0) === 0;

  const firstMission = useMemo(() => {
    if (isFirstSession) {
      return {
        title: "Complete your first 10-question skill check",
        note: "This creates your baseline and unlocks a precise daily plan.",
        href: `/practice?subject=${track}&mode=trainer`,
        label: "Start first skill check",
      };
    }

    if (weakArea.trim()) {
      return {
        title: "Review your biggest score opportunity",
        note: `${weakArea.trim()} is marked as a weak area. Run one focused set now.`,
        href: `/practice?subject=${track}&subskill=${encodeURIComponent(weakArea.trim())}&revisit=1`,
        label: "Practice weak area",
      };
    }

    return {
      title: "Follow your Today plan",
      note: "Your plan is ready. Open Today and complete the top mission first.",
      href: "/today",
      label: "Open Today",
    };
  }, [isFirstSession, track, weakArea]);

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
        .select("id,nickname,target_score,exam_date,daily_study_hours,weakest_area,current_level")
        .eq("id", userId)
        .single();

      if (profileErr) throw new Error(profileErr.message);

      const row = profileData as ProfileRow;
      setProfile(row);
      setTargetScore(String(row.target_score ?? 1400));
      setExamDate(isoToDateInput(row.exam_date));
      setDailyHours(String(row.daily_study_hours ?? 2));
      setCurrentLevel(row.current_level ?? "Not sure yet");
      setWeakArea(row.weakest_area ?? "");

      const prefs = readPrefs();
      if (prefs) {
        setExamType(prefs.examType);
        setTargetOutcome(prefs.targetOutcome || "AP 5");
        setStudyMode(prefs.studyMode);
      }

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

  async function saveSetup(): Promise<boolean> {
    if (!profile) return false;

    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const supabase = getSupabase();
      const payload = {
        target_score: clampTarget(targetScore),
        exam_date: dateInputToISO(examDate),
        daily_study_hours: Math.max(0, Math.min(12, Math.round(Number(dailyHours) || 2))),
        weakest_area: weakArea.trim() || null,
        current_level: currentLevel,
      };

      const { error } = await supabase.from("profiles").update(payload).eq("id", profile.id);

      if (error) throw new Error(error.message);

      writePrefs({
        examType,
        targetOutcome: targetOutcome.trim() || "AP 5",
        studyMode,
        completedAt: new Date().toISOString(),
      });

      setMsg("Setup saved. Your Today plan is ready.");
      await load();
      return true;
    } catch (e: unknown) {
      setErr(errorMessage(e, "Could not save setup."));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndOpenToday() {
    const ok = await saveSetup();
    if (ok) {
      router.push("/today?onboarding=1");
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
        label="Onboarding"
        title="Welcome to alga prep"
        subtitle="Set target and mode in two minutes, then launch the first decisive block."
        right={<Pill text={isFirstSession ? "First setup" : "Update setup"} tone="accent" />}
      />

      {loading && (
        <Card title="Loading onboarding" subtitle="Preparing your setup">
          <div className="space-y-2">
            <div className="state-skeleton h-3 w-2/3" />
            <div className="state-skeleton h-3 w-1/2" />
            <div className="state-skeleton h-24 w-full" />
          </div>
        </Card>
      )}

      {!loading && err && (
        <Card title="Onboarding unavailable" subtitle="We could not load your setup right now.">
          <div className="text-sm text-red-600">{err}</div>
          <div className="mt-4 grid gap-3 sm:max-w-md sm:grid-cols-2">
            <PrimaryButton onClick={() => void load()}>Try again</PrimaryButton>
            <SecondaryButton href="/today">Open Today anyway</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && (
        <div className="grid gap-4">
          <section className="premium-hero ink-surface overflow-hidden rounded-[30px] border border-[#22345e] shadow-xl">
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#486399] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  <BrandWordmark compact className="display-font font-bold text-[#bdd5ff]" /> launch
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  Set baseline once, then attack with clarity
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#d2dbec]">
                  One finished block unlocks your first strong recommendation in Today.
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <PrimaryButton onClick={() => void saveAndOpenToday()}>
                    {saving ? "Saving..." : "Save setup and launch Today"}
                  </PrimaryButton>
                  <SecondaryButton href={firstMission.href}>{firstMission.label}</SecondaryButton>
                </div>
              </div>

              <VisualAnchorPanel
                variant="onboarding"
                eyebrow="Launch outcome"
                title={firstMission.title}
                subtitle={firstMission.note}
                metrics={[
                  {
                    label: "First route",
                    value: firstMission.label,
                    note: "Immediate action after setup",
                    tone: "accent",
                  },
                  {
                    label: "What unlocks",
                    value: "Weak-skill priority",
                    note: "Command view in Today",
                    tone: "neutral",
                  },
                  {
                    label: "What proves progress",
                    value: "Payoff movement signal",
                    note: "Comparable before/after",
                    tone: "success",
                  },
                ]}
                footer="Setup ends in a decisive first block."
              />
            </div>
          </section>

          <Card title="Setup details" subtitle={`Only fields that change your first route, ${nickname}.`} accent>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="grid gap-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">Required now</div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Exam type</label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {([
                      { key: "sat", label: "SAT" },
                      { key: "ap", label: "AP" },
                      { key: "both", label: "Both" },
                    ] as const).map((item) => {
                      const active = examType === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setExamType(item.key)}
                          className={[
                            "rounded-xl border px-3 py-3 text-sm font-semibold transition",
                            active
                              ? "border-[#0e1b34] bg-[#0e1b34] text-white"
                              : "border-gray-300 bg-white text-gray-700 hover:border-gray-400",
                          ].join(" ")}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {examType !== "ap" && (
                  <div>
                    <label className="text-sm font-semibold text-gray-700">SAT target score</label>
                    <input
                      className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none"
                      value={targetScore}
                      onChange={(e) => setTargetScore(e.target.value)}
                      inputMode="numeric"
                    />
                    <div className="mt-1 text-xs text-gray-500">Planning target only. Not a score prediction.</div>
                  </div>
                )}

                {examType !== "sat" && (
                  <div>
                    <label className="text-sm font-semibold text-gray-700">AP target outcome</label>
                    <input
                      className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none"
                      value={targetOutcome}
                      onChange={(e) => setTargetOutcome(e.target.value)}
                      placeholder="Example: AP Calculus BC 5"
                    />
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold text-gray-700">Exam date</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none"
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">First practice section</label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
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
                </div>
              </div>

              <div className="grid gap-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7f9f]">Optional tuning</div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Current level</label>
                  <select
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                    value={currentLevel}
                    onChange={(e) => setCurrentLevel(e.target.value)}
                  >
                    <option>Not sure yet</option>
                    <option>Early foundation</option>
                    <option>Developing consistency</option>
                    <option>Near target but inconsistent</option>
                    <option>Final polishing</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Preferred daily workload (hours)</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none"
                    value={dailyHours}
                    onChange={(e) => setDailyHours(e.target.value)}
                    inputMode="numeric"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Weakest areas (if known)</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none"
                    value={weakArea}
                    onChange={(e) => setWeakArea(e.target.value)}
                    placeholder="Example: linear equations, transitions, punctuation"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Study style</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {([
                      { key: "guided", label: "Guided mode", note: "Follow Today recommendations." },
                      { key: "free", label: "Free practice", note: "Choose sessions manually." },
                    ] as const).map((item) => {
                      const active = studyMode === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setStudyMode(item.key)}
                          className={[
                            "rounded-xl border px-3 py-3 text-left text-sm font-semibold transition",
                            active
                              ? "border-[#0e1b34] bg-[#0e1b34] text-white"
                              : "border-gray-300 bg-white text-gray-700 hover:border-gray-400",
                          ].join(" ")}
                        >
                          <div>{item.label}</div>
                          <div className={`mt-1 text-xs ${active ? "text-[#d2dbec]" : "text-gray-500"}`}>{item.note}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <PrimaryButton onClick={() => void saveAndOpenToday()} disabled={saving}>
                {saving ? "Saving..." : "Save setup and launch Today"}
              </PrimaryButton>
              <SecondaryButton href={firstMission.href}>{firstMission.label}</SecondaryButton>
            </div>

            {msg ? <div className="mt-3 text-sm text-green-700">{msg}</div> : null}
          </Card>
        </div>
      )}
    </main>
  );
}
